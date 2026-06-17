import activeWin, { Result as ActiveWinResult } from "active-win";
import { WindowEvent } from "../types/agent.types";
import { IncognitoDetector } from "./IncognitoDetector";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WindowMonitorOptions {
  incognitoDetector?: IncognitoDetector;
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * WindowMonitor — lấy thông tin cửa sổ đang được focus.
 *
 * Dùng thư viện `active-win` (cross-platform, không cần native addon riêng).
 * Mỗi lần collect() được gọi từ main loop (5s), trả về một WindowEvent
 * hoặc null nếu không lấy được.
 */


export class WindowMonitor {
  private readonly incognitoDetector: IncognitoDetector;

  /** Title của lần collect trước — tránh đẩy event trùng lặp vào buffer. */
  private lastWindowTitle: string | null = null;

  constructor(options: WindowMonitorOptions = {}) {
    this.incognitoDetector =
      options.incognitoDetector ?? new IncognitoDetector();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Thu thập thông tin active window.
   * - Trả về null nếu không có cửa sổ nào đang focus (desktop, screensaver).
   * - Trả về null nếu title không đổi so với lần trước (dedup).
   * - Không throw — mọi lỗi đều được catch nội bộ.
   */
  public async collect(): Promise<WindowEvent | null> {
    try {
      const win = await activeWin();

      if (!win) {
        return null;
      }

      const title = win.title || "Unknown";
      const processName = this.extractProcessName(win);

      // Dedup — chỉ emit event khi cửa sổ thực sự thay đổi
      if (title === this.lastWindowTitle) {
        return null;
      }
      this.lastWindowTitle = title;

      const { isIncognito } = this.incognitoDetector.check(title);

      const event: WindowEvent = {
        type: "window",
        timestamp: new Date().toISOString(),
        title,
        processName,
        isIncognito,
      };

      return event;
    } catch (err) {
      console.error(
        `[WindowMonitor] Lỗi khi lấy active window: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Lấy tên process từ kết quả active-win.
   * active-win trả về owner.name (display name) và owner.path.
   * Ưu tiên lấy basename của path để nhất quán hơn.
   */
  private extractProcessName(win: ActiveWinResult): string {
    try {
      if (win.owner?.path) {
        // "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" → "chrome.exe"
        const parts = win.owner.path.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1] ?? win.owner.name ?? "unknown";
      }
      return win.owner?.name ?? "unknown";
    } catch {
      return "unknown";
    }
  }
}
