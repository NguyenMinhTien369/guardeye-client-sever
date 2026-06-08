// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                     GUARDEYE — AGENT TYPE CONTRACT                      ║
// ║                                                                          ║
// ║  File duy nhất chứa toàn bộ interface/type của Agent.                   ║
// ║  Chia thành 4 phần:                                                      ║
// ║    1. CONFIG       — cấu hình Agent cần để khởi động                    ║
// ║    2. EVENTS       — data contract quan trọng nhất (Agent → Server)      ║
// ║    3. API CONTRACT — shape của HTTP request/response                     ║
// ║    4. INTERNAL     — type Agent tự dùng, Backend không cần quan tâm     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════════════════════════
// PHẦN 1 — CONFIG
// Thông tin Agent đọc từ config.json để khởi động.
// Backend KHÔNG cần type này — chỉ để tham khảo.
// ════════════════════════════════════════════════════════════════════════════

export interface AgentConfig {
  /** UUID định danh thiết bị — dùng để xác thực với Server. */
  deviceToken: string;

  /** Base URL của Backend (vd: https://api.guardeye.io). */
  serverUrl: string;

  /** Danh sách Windows username cần monitor (vd: ["an", "binh"]). */
  monitoredUsers: string[];

  /**
   * Interval gửi batch events lên server (milliseconds).
   * Mặc định: 300_000 (5 phút).
   */
  syncIntervalMs: number;

  /**
   * Interval của main loop thu thập window (milliseconds).
   * Mặc định: 5_000 (5 giây).
   */
  mainLoopIntervalMs: number;

  /**
   * Interval poll trạng thái pause từ server (milliseconds).
   * Mặc định: 30_000 (30 giây).
   */
  pausePollIntervalMs: number;
}

// ════════════════════════════════════════════════════════════════════════════
// PHẦN 2 — EVENTS (Data Contract quan trọng nhất)
// Dữ liệu Agent thu thập và gửi lên Server.
// Backend dùng để lưu DB và hiển thị trên Dashboard.
// ════════════════════════════════════════════════════════════════════════════

/**
 * WindowEvent — ghi nhận cửa sổ đang được focus tại thời điểm collect.
 * Agent tạo mỗi khi active window thay đổi (dedup theo title).
 */
export interface WindowEvent {
  type: "window";

  /** ISO 8601 — thời điểm Agent ghi nhận sự kiện. */
  timestamp: string;

  /** Title bar của cửa sổ (vd: "YouTube - Google Chrome"). */
  title: string;

  /** Tên tiến trình (vd: "chrome.exe", "msedge.exe"). */
  processName: string;

  /** Agent phát hiện cửa sổ đang ở chế độ ẩn danh dựa trên title. */
  isIncognito: boolean;
}

/**
 * HistoryEvent — một URL trong lịch sử duyệt web của Chrome/Edge.
 * Agent đọc từ SQLite của browser mỗi tick.
 */
export interface HistoryEvent {
  type: "history";

  /** ISO 8601 — thời điểm Agent đọc được URL này. */
  timestamp: string;

  /** URL đầy đủ (vd: "https://www.youtube.com/watch?v=abc"). */
  url: string;

  /** Tiêu đề trang web. */
  title: string;

  /** Trình duyệt ghi nhận URL này. */
  browser: "chrome" | "edge" | "unknown";

  /** ISO 8601 — thời điểm trình duyệt ghi nhận lượt truy cập (từ SQLite). */
  visitTime: string;
}

/**
 * AgentEvent — union type bao gồm mọi loại event Agent có thể gửi.
 * Backend dùng `event.type` để phân loại trước khi lưu vào collection phù hợp.
 */
export type AgentEvent = WindowEvent | HistoryEvent;

// ════════════════════════════════════════════════════════════════════════════
// PHẦN 3 — API CONTRACT (Agent ↔ Server)
// Shape chính xác của HTTP request/response giữa Agent và Backend.
// Backend PHẢI implement đúng 2 endpoint này.
// ════════════════════════════════════════════════════════════════════════════

// ── Endpoint 1: POST /api/agent/sync ────────────────────────────────────────
// Agent gửi batch events lên server định kỳ (mặc định mỗi 5 phút).
// Header bắt buộc: X-Device-Token: <deviceToken>

/**
 * SyncPayload — body của request POST /api/agent/sync.
 */
export interface SyncPayload {
  /** Token định danh thiết bị (trùng với header X-Device-Token). */
  deviceToken: string;

  /** Mảng event thu thập được kể từ lần sync trước. */
  events: AgentEvent[];

  /** ISO 8601 — thời điểm Agent gửi request. Server dùng để detect clock skew. */
  sentAt: string;

  /**
   * Số event trong batch này.
   * Server PHẢI validate: savedCount === events.length, nếu không trả 400.
   */
  eventCount: number;
}

/**
 * SyncResponse — body của response từ POST /api/agent/sync.
 *
 * HTTP status:
 *   200 — lưu thành công (Agent clear buffer)
 *   400 — schema lỗi hoặc eventCount mismatch (Agent giữ buffer)
 *   401 — deviceToken không hợp lệ (Agent log cảnh báo)
 *   5xx — lỗi server tạm thời (Agent retry lần sau)
 */
export interface SyncResponse {
  success: boolean;

  /** Số event server đã lưu thành công. Agent dùng để verify. */
  savedCount?: number;

  /** Mô tả lỗi nếu success = false. */
  message?: string;
}

// ── Endpoint 2: GET /api/agent/status ───────────────────────────────────────
// Agent poll trạng thái pause định kỳ (mặc định mỗi 30 giây).
// Query param: ?deviceToken=<token>
// Header: X-Device-Token: <deviceToken>

/**
 * PauseStatusResponse — body của response từ GET /api/agent/status.
 *
 * HTTP status:
 *   200 — trả về trạng thái hiện tại
 *   401 — deviceToken không hợp lệ
 */
export interface PauseStatusResponse {
  /** true = Agent phải dừng thu thập data ngay lập tức. */
  paused: boolean;

  /** ISO 8601 — thời điểm trạng thái này có hiệu lực (optional). */
  since?: string;

  /** Lý do tạm dừng — hiển thị trong log Agent (optional). */
  reason?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// PHẦN 4 — INTERNAL (Agent tự dùng, Backend không cần quan tâm)
// Các type phục vụ logic nội bộ của Agent.
// Được đặt đây để agent.types.ts là file duy nhất cần đọc.
// ════════════════════════════════════════════════════════════════════════════

/**
 * IncognitoCheckResult — kết quả kiểm tra chế độ ẩn danh của một cửa sổ.
 * Trả về bởi IncognitoDetector.check(windowTitle).
 */
export interface IncognitoCheckResult {
  isIncognito: boolean;

  /** Keyword nào trigger kết quả (dùng để debug/log). null nếu không phát hiện. */
  matchedKeyword: string | null;
}

/**
 * BrowserProfile — đại diện cho một profile của Chrome hoặc Edge.
 * HistoryReader discover các profile này trên máy người dùng.
 */
export interface BrowserProfile {
  /** Trình duyệt của profile này. */
  browser: "chrome" | "edge" | "unknown";

  /** Đường dẫn tuyệt đối đến file History (SQLite) của profile. */
  historyPath: string;

  /** Label để ghi log (vd: "Chrome - Default", "Edge - Profile 1"). */
  label: string;
}

/**
 * ChromiumHistoryRow — một row từ bảng `urls` trong SQLite của Chrome/Edge.
 * Dùng nội bộ bởi HistoryReader khi query DB.
 *
 * Lưu ý: last_visit_time là microseconds kể từ 1601-01-01 (Windows FILETIME),
 * không phải Unix timestamp thông thường.
 */
export interface ChromiumHistoryRow {
  url: string;
  title: string;

  /** Microseconds kể từ 1601-01-01 00:00:00 UTC (Windows FILETIME epoch). */
  last_visit_time: number;
}
