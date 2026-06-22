import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserGuardOptions {
  /** Danh sách username được phép monitor (lấy từ config). */
  monitoredUsers: string[];
  /** So sánh case-insensitive (mặc định: true). */
  caseInsensitive?: boolean;
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * UserGuard — kiểm tra xem user đang đăng nhập có nằm trong danh sách
 * monitoredUsers của config hay không.
 *
 * Tại sao cần guard này?
 *  - Một máy Windows có thể có nhiều account.
 *  - Agent chỉ nên thu thập data của account được phụ huynh chỉ định,
 *    tránh vô tình monitor tài khoản admin hay guest.
 */
export class UserGuard {
  private readonly monitoredUsers: Set<string>;
  private readonly caseInsensitive: boolean;

  /** Cache kết quả kiểm tra để không gọi os.userInfo() mỗi 5s. */
  private cachedUsername: string | null = null;
  private cachedResult: boolean | null = null;

  constructor(options: UserGuardOptions) {
    this.caseInsensitive = options.caseInsensitive ?? true;

    // Normalize danh sách ngay khi khởi tạo — O(1) lookup sau đó
    this.monitoredUsers = new Set(
      options.monitoredUsers.map((u) =>
        this.caseInsensitive ? u.toLowerCase().trim() : u.trim(),
      ),
    );
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Trả về true nếu user hiện tại được phép monitor.
   *
   * Cache kết quả theo username:
   *  - Username hầu như không đổi trong suốt session → cache an toàn.
   *  - Nếu có switch user (hiếm), cache tự invalidate vì username thay đổi.
   */
  public isAllowed(): boolean {
    try {
      const username = this.getCurrentUsername();

      // Cache hit — username không đổi, trả về kết quả cũ
      if (username === this.cachedUsername && this.cachedResult !== null) {
        return this.cachedResult;
      }

      // Cache miss — tính lại và lưu cache
      const normalized = this.caseInsensitive
        ? username.toLowerCase()
        : username;

      this.cachedUsername = username;
      this.cachedResult = this.monitoredUsers.has(normalized);

      return this.cachedResult;
    } catch (err) {
      // Nếu không lấy được username (hiếm gặp), fail-safe: không monitor
      console.error(
        `[UserGuard] Không lấy được username hệ thống: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Trả về username thực tế đang chạy process (dùng để log/debug). */
  public getCurrentUsername(): string {
    return os.userInfo().username;
  }

  /** Trả về danh sách user được monitor (đã normalize). */
  public getMonitoredUsers(): string[] {
    return Array.from(this.monitoredUsers);
  }

  /**
   * Buộc xóa cache — dùng khi config được reload hoặc
   * trong unit test để reset trạng thái.
   */
  public invalidateCache(): void {
    this.cachedUsername = null;
    this.cachedResult = null;
  }
}
