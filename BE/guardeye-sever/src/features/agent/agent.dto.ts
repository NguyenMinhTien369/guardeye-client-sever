// src/features/agent/agent.dto.ts

// -----------------------------------------------------------------------------
// AGENT DTO - Định nghĩa cấu trúc dữ liệu cho luồng Agent ↔ Backend
// Đồng bộ với agent.types.ts phía Agent client.
//
// Lưu ý: Agent hiện tại chỉ thu thập WindowEvent.
// HistoryEvent đã được loại bỏ khỏi Agent — không nhận ở đây.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

// ── Event DTOs (body của từng event trong mảng events[]) ──────────────────────

/**
 * WindowEventDto — shape của một window event trong payload sync.
 * Ánh xạ 1-1 với WindowEvent interface trong agent.types.ts.
 */
export interface WindowEventDto {
  type: "window";

  /** ISO 8601 — thời điểm Agent ghi nhận sự kiện */
  timestamp: string;

  /** Title bar của cửa sổ (vd: "YouTube - Google Chrome") */
  title: string;

  /** Tên tiến trình (vd: "chrome.exe", "msedge.exe") */
  processName: string;
}

/** Union type của tất cả event Agent có thể gửi (hiện tại chỉ có window) */
export type AgentEventDto = WindowEventDto;

// ── Sync Request ──────────────────────────────────────────────────────────────

/**
 * SyncRequestDto — body của request POST /api/v1/agent/sync.
 * Agent gửi batch events lên server định kỳ (mặc định mỗi 5 phút).
 * Đồng bộ với SyncPayload trong agent.types.ts.
 *
 * Header bắt buộc: X-Device-Token: <deviceToken>
 */
export interface SyncRequestDto {
  /** Token định danh thiết bị (phải khớp với header X-Device-Token) */
  deviceToken: string;

  /** ISO 8601 — thời điểm Agent gửi request. Server dùng để detect clock skew */
  sentAt: string;

  /**
   * Số event trong batch này.
   * Server PHẢI validate: eventCount === events.length, nếu không trả 400.
   */
  eventCount: number;

  /** Mảng event thu thập được kể từ lần sync trước */
  events: AgentEventDto[];
}

// ── Status Request ─────────────────────────────────────────────────────────────

/**
 * StatusQueryDto — query params của request GET /api/v1/agent/status.
 * Agent poll trạng thái pause định kỳ (mặc định mỗi 30 giây).
 *
 * Header ưu tiên: X-Device-Token: <deviceToken>
 * Query param (fallback): ?deviceToken=<token>
 */
export interface StatusQueryDto {
  /** Token định danh thiết bị (fallback nếu header không truyền được) */
  deviceToken?: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// ── Sync Response ──────────────────────────────────────────────────────────────

/**
 * SyncResponseDto — shape đầy đủ của response từ POST /api/v1/agent/sync.
 * Đồng bộ với SyncResponse trong agent.types.ts — flat structure (không lồng data).
 *
 * HTTP status:
 *   200 — lưu thành công → Agent đọc savedCount rồi clear buffer
 *   400 — schema lỗi hoặc eventCount mismatch → Agent giữ nguyên buffer
 *   401 — deviceToken không hợp lệ → Agent log cảnh báo
 *   429 — rate limit → Agent retry lần sau
 *   5xx — lỗi server tạm thời → Agent retry lần sau
 */
export interface SyncResponseDto {
  success: boolean;

  /**
   * Số event server đã lưu thành công.
   * Agent dùng để verify rồi quyết định clear buffer.
   * Có mặt khi success = true.
   */
  savedCount?: number;

  /** Mô tả kết quả. Luôn có mặt — Agent log để debug */
  message?: string;
}

// ── Status Response ────────────────────────────────────────────────────────────

/**
 * AgentStatusResponseDto — shape của response từ GET /api/v1/agent/status.
 * Đồng bộ với PauseStatusResponse trong agent.types.ts — flat structure.
 *
 * HTTP status:
 *   200 — trả về trạng thái hiện tại
 *   401 — deviceToken không hợp lệ
 */
export interface AgentStatusResponseDto {
  /** true = Agent phải dừng thu thập data ngay lập tức */
  paused: boolean;

  /**
   * ISO 8601 — thời điểm trạng thái pause có hiệu lực.
   * undefined nếu chưa từng pause.
   */
  since?: string;

  /**
   * Lý do tạm dừng — Agent in ra log để debug.
   * undefined nếu phụ huynh không điền lý do.
   */
  reason?: string;
}
