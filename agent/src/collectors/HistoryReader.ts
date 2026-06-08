import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import Database from "better-sqlite3";
import { HistoryEvent, BrowserProfile, ChromiumHistoryRow } from "../types/agent.types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Chrome/Edge lưu timestamp dạng microseconds kể từ 1601-01-01.
 * Cần trừ đi delta để convert sang Unix epoch (milliseconds).
 * Delta = số ms giữa 1601-01-01 và 1970-01-01.
 */
const CHROMIUM_EPOCH_DELTA_MS = 11_644_473_600_000;

/** Số URL tối đa đọc mỗi lần collect — tránh flood buffer. */
const MAX_URLS_PER_COLLECT = 50;

/** Timeout tự dọn file temp (ms) — xóa sau 10 phút dù có lỗi. (Tạm thời chưa dùng) */

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * HistoryReader — đọc lịch sử duyệt web từ SQLite của Chrome/Edge.
 *
 * VẤN ĐỀ CỐT LÕI:
 *  Chrome/Edge giữ file History bị lock (SQLITE_BUSY / "database is locked")
 *  khi trình duyệt đang chạy. Giải pháp: copy file sang %TEMP% trước khi mở.
 *
 * LUỒNG:
 *  1. Dò tìm tất cả browser profile có file History.
 *  2. Với mỗi profile: copy History → %TEMP%/parental-agent-{hash}.db
 *  3. Mở file temp bằng better-sqlite3 ở chế độ read-only.
 *  4. Query các URL mới hơn lastReadTime.
 *  5. Xóa file temp.
 *  6. Cập nhật lastReadTime.
 */
export class HistoryReader {
  /** Map: historyPath → timestamp lần đọc cuối (tránh đọc lại URL cũ). */
  private lastReadTime: Map<string, Date> = new Map();

  /** Tập hợp path file temp đang tồn tại — để cleanup khi có lỗi đột ngột. */
  private activeTempFiles: Set<string> = new Set();

  constructor() {
    // Đăng ký cleanup khi process thoát
    this.registerExitCleanup();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Thu thập tất cả history mới từ Chrome + Edge kể từ lần collect trước.
   * Không throw — trả về mảng rỗng nếu lỗi toàn bộ.
   */
  public async collect(): Promise<HistoryEvent[]> {
    const profiles = this.discoverBrowserProfiles();

    if (profiles.length === 0) {
      return [];
    }

    const allEvents: HistoryEvent[] = [];

    for (const profile of profiles) {
      try {
        const events = await this.readProfileHistory(profile);
        allEvents.push(...events);
      } catch (err) {
        // Một profile lỗi không được ảnh hưởng profile khác
        console.error(
          `[HistoryReader] Lỗi đọc profile "${profile.label}": ${(err as Error).message}`,
        );
      }
    }

    return allEvents;
  }

  // ─── Profile Discovery ───────────────────────────────────────────────────────

  /**
   * Dò tìm tất cả profile của Chrome và Edge trên máy.
   *
   * Chrome:  %LOCALAPPDATA%\Google\Chrome\User Data\{Profile}\History
   * Edge:    %LOCALAPPDATA%\Microsoft\Edge\User Data\{Profile}\History
   *
   * Mỗi browser có thể có nhiều profile: Default, Profile 1, Profile 2, ...
   */
  private discoverBrowserProfiles(): BrowserProfile[] {
    const localAppData = process.env["LOCALAPPDATA"] ?? "";

    if (!localAppData) {
      console.warn(
        "[HistoryReader] Không tìm thấy biến môi trường LOCALAPPDATA.",
      );
      return [];
    }

    const browserRoots: Array<{ browser: BrowserProfile["browser"]; userDataPath: string }> =
      [
        {
          browser: "chrome",
          userDataPath: path.join(
            localAppData,
            "Google",
            "Chrome",
            "User Data",
          ),
        },
        {
          browser: "edge",
          userDataPath: path.join(
            localAppData,
            "Microsoft",
            "Edge",
            "User Data",
          ),
        },
      ];

    const profiles: BrowserProfile[] = [];

    for (const { browser, userDataPath } of browserRoots) {
      if (!fs.existsSync(userDataPath)) {
        continue;
      }

      // Tên thư mục profile hợp lệ: "Default", "Profile 1", "Profile 2", ...
      const profileDirs = this.getProfileDirectories(userDataPath);

      for (const profileDir of profileDirs) {
        const historyPath = path.join(userDataPath, profileDir, "History");

        if (fs.existsSync(historyPath)) {
          profiles.push({
            browser,
            historyPath,
            label: `${browser} - ${profileDir}`,
          });
        }
      }
    }

    return profiles;
  }

  /**
   * Liệt kê thư mục profile trong User Data.
   * Chỉ lấy "Default" và các thư mục bắt đầu bằng "Profile ".
   */
  private getProfileDirectories(userDataPath: string): string[] {
    try {
      return fs
        .readdirSync(userDataPath, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            (entry.name === "Default" || entry.name.startsWith("Profile ")),
        )
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  // ─── Core Read Logic ─────────────────────────────────────────────────────────

  /**
   * Đọc history của một browser profile.
   * Toàn bộ luồng: copy → query → cleanup.
   */
  private async readProfileHistory(
    profile: BrowserProfile,
  ): Promise<HistoryEvent[]> {
    const tempPath = this.buildTempPath(profile.historyPath);

    try {
      // BƯỚC 1: Copy file History sang %TEMP% để tránh "database is locked"
      await this.copyToTemp(profile.historyPath, tempPath);

      // BƯỚC 2: Query trên file temp (read-only, an toàn)
      const events = this.queryHistory(tempPath, profile);

      return events;
    } finally {
      // BƯỚC 3: Luôn xóa file temp dù query thành công hay thất bại
      this.deleteTempFile(tempPath);
    }
  }

  /**
   * Copy file History gốc sang thư mục %TEMP%.
   *
   * Dùng fs.copyFileSync với flag COPYFILE_EXCL tránh ghi đè nếu
   * một lần chạy trước đó bị crash và để lại file cũ.
   */
  private async copyToTemp(
    sourcePath: string,
    tempPath: string,
  ): Promise<void> {
    // Xóa file temp cũ nếu còn sót lại từ lần trước
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    try {
      fs.copyFileSync(sourcePath, tempPath);
      this.activeTempFiles.add(tempPath);
    } catch (err) {
      throw new Error(
        `Không thể copy History file sang temp: ${(err as Error).message}` +
          `\n  Source: ${sourcePath}` +
          `\n  Dest:   ${tempPath}`,
      );
    }
  }

  /**
   * Query SQLite trên file temp.
   * Dùng better-sqlite3 ở chế độ readonly — nhanh, đồng bộ, an toàn.
   */
  private queryHistory(
    tempPath: string,
    profile: BrowserProfile,
  ): HistoryEvent[] {
    let db: Database.Database | null = null;

    try {
      // readonly: true — không bao giờ ghi vào file của người dùng
      db = new Database(tempPath, { readonly: true, fileMustExist: true });

      const since = this.lastReadTime.get(profile.historyPath);
      const sinceChromium = since
        ? this.toChromiumTimestamp(since)
        : // Nếu lần đầu, chỉ lấy 1 giờ gần nhất để tránh flood
          this.toChromiumTimestamp(new Date(Date.now() - 60 * 60 * 1000));

      const rows = db
        .prepare<[number, number], ChromiumHistoryRow>(
          `SELECT url, title, last_visit_time
           FROM urls
           WHERE last_visit_time > ?
           ORDER BY last_visit_time DESC
           LIMIT ?`,
        )
        .all(sinceChromium, MAX_URLS_PER_COLLECT);

      // Cập nhật lastReadTime ngay sau khi query thành công
      this.lastReadTime.set(profile.historyPath, new Date());

      return rows.map((row) => this.rowToEvent(row, profile.browser));
    } catch (err) {
      throw new Error(
        `SQLite query thất bại trên "${profile.label}": ${(err as Error).message}`,
      );
    } finally {
      // Đóng DB trước khi xóa file temp
      try {
        db?.close();
      } catch {
        // Ignore lỗi đóng DB
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Tạo path file temp duy nhất cho mỗi profile.
   * Dùng hash của historyPath để tránh conflict khi chạy nhiều profile song song.
   */
  private buildTempPath(historyPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(historyPath)
      .digest("hex")
      .slice(0, 8);

    return path.join(os.tmpdir(), `parental-agent-history-${hash}.db`);
  }

  /**
   * Convert JavaScript Date → Chromium timestamp.
   * Chromium dùng microseconds từ 1601-01-01.
   */
  private toChromiumTimestamp(date: Date): number {
    return (date.getTime() + CHROMIUM_EPOCH_DELTA_MS) * 1000;
  }

  /**
   * Convert Chromium timestamp → JavaScript Date.
   */
  private chromiumTimestampToDate(chromiumTs: number): Date {
    return new Date(chromiumTs / 1000 - CHROMIUM_EPOCH_DELTA_MS);
  }

  /**
   * Chuyển một DB row thành HistoryEvent chuẩn.
   */
  private rowToEvent(
    row: ChromiumHistoryRow,
    browser: BrowserProfile["browser"],
  ): HistoryEvent {
    return {
      type: "history",
      timestamp: new Date().toISOString(),
      url: row.url ?? "",
      title: row.title ?? "",
      browser,
      visitTime: this.chromiumTimestampToDate(
        row.last_visit_time,
      ).toISOString(),
    };
  }

  /**
   * Xóa file temp, đồng thời remove khỏi activeTempFiles set.
   */
  private deleteTempFile(tempPath: string): void {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      this.activeTempFiles.delete(tempPath);
    } catch (err) {
      // Không throw — log warning và tiếp tục
      console.warn(
        `[HistoryReader] Không thể xóa file temp "${tempPath}": ` +
          `${(err as Error).message}`,
      );
    }
  }

  /**
   * Đăng ký cleanup toàn bộ file temp khi process thoát đột ngột
   * (SIGINT, SIGTERM, uncaughtException...).
   */
  private registerExitCleanup(): void {
    const cleanup = () => {
      for (const tempPath of this.activeTempFiles) {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch {
          // Silent — đang trong quá trình thoát
        }
      }
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
  }
}
