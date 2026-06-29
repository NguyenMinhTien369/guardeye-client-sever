// src/features/screenshot/screenshot.dto.ts

// -----------------------------------------------------------------------------
// SCREENSHOT DTO — Định nghĩa data contract giữa Agent ↔ Backend ↔ Dashboard FE
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs (Agent → Server)
// -----------------------------------------------------------------------------

/**
 * UploadScreenshotQueryDto — query params của POST /api/v1/agent/screenshot.
 *
 * File ảnh được gửi qua multipart/form-data field "screenshot".
 * Metadata gửi kèm qua query string để tách biệt khỏi binary payload.
 *
 * Header bắt buộc: X-Device-Token: <deviceToken>
 */
export interface UploadScreenshotQueryDto {
  /** Thứ tự ảnh trong batch: 0 = tấm đầu, 1 = tấm giữa, 2 = tấm cuối */
  captureIndex: string; // string vì query param luôn là string, service sẽ parse

  /** ISO 8601 — thời điểm Agent thực sự chụp ảnh */
  capturedAt: string;

  /** Tiêu đề cửa sổ trình duyệt tại thời điểm trigger chụp */
  triggerTitle: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs (Server → Client)
// -----------------------------------------------------------------------------

/**
 * ScreenshotUploadResponseDto — response sau khi upload thành công.
 * Agent dùng để log và confirm.
 */
export interface ScreenshotUploadResponseDto {
  success: true;
  screenshotId: string;
  fileName: string;
  message: string;
}

/**
 * ScreenshotItemDto — một ảnh trong danh sách trả về Dashboard.
 */
export interface ScreenshotItemDto {
  id: string;
  deviceId: string;
  triggerTitle: string;

  /** URL đầy đủ để FE hiển thị ảnh, VD: "http://localhost:5000/uploads/screenshots/abc.jpg" */
  imageUrl: string;

  captureIndex: 0 | 1 | 2;
  capturedAt: string; // ISO 8601
  dateKey: string;
  createdAt: string;
}

/**
 * GetScreenshotsQueryDto — query params của GET /api/v1/screenshots/device/:deviceId.
 */
export interface GetScreenshotsQueryDto {
  /** Filter theo ngày dạng "YYYY-MM-DD". Nếu không truyền → lấy hôm nay */
  dateKey?: string;

  /** Trang hiện tại (mặc định: 1) */
  page?: string;

  /** Số ảnh mỗi trang (mặc định: 20, tối đa: 100) */
  limit?: string;
}

/**
 * GetScreenshotsResponseDto — response của GET /api/v1/screenshots/device/:deviceId.
 */
export interface GetScreenshotsResponseDto {
  screenshots: ScreenshotItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dateKey: string;
}
