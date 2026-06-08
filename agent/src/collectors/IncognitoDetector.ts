import { IncognitoCheckResult } from "../types/agent.types";

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * IncognitoDetector — phát hiện cửa sổ trình duyệt đang ở chế độ ẩn danh
 * dựa trên title của cửa sổ.
 *
 * Tại sao dùng title?
 *  - Tất cả trình duyệt lớn đều nhúng từ khóa vào title bar khi ẩn danh.
 *  - Không cần quyền đặc biệt, không cần inject code vào browser.
 *  - Hoạt động được ngay cả khi trình duyệt không trong focus.
 */
export class IncognitoDetector {
  /**
   * Map từ tên browser → danh sách keyword nhận diện chế độ ẩn danh.
   * Key là lowercase để so sánh không phân biệt hoa/thường.
   */
  private static readonly INCOGNITO_KEYWORDS: readonly string[] = [
    // Chrome / Chromium
    "incognito",
    // Firefox
    "private browsing",
    // Edge
    "inprivate",
    // Opera
    "private",
    // Brave
    "private window",
    // Safari (macOS — phòng trường hợp agent chạy cross-platform sau này)
    "private — safari",
  ];

  private readonly keywords: readonly string[];

  constructor(extraKeywords: string[] = []) {
    // Cho phép inject thêm keyword từ ngoài (mở rộng sau này)
    this.keywords = [
      ...IncognitoDetector.INCOGNITO_KEYWORDS,
      ...extraKeywords.map((k) => k.toLowerCase().trim()),
    ];
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Kiểm tra title cửa sổ có chứa keyword ẩn danh không.
   * @param windowTitle - Title của active window (lấy từ WindowMonitor).
   */
  public check(windowTitle: string): IncognitoCheckResult {
    if (!windowTitle || windowTitle.trim() === "") {
      return { isIncognito: false, matchedKeyword: null };
    }

    const normalizedTitle = windowTitle.toLowerCase();

    for (const keyword of this.keywords) {
      if (normalizedTitle.includes(keyword)) {
        return { isIncognito: true, matchedKeyword: keyword };
      }
    }

    return { isIncognito: false, matchedKeyword: null };
  }
}
