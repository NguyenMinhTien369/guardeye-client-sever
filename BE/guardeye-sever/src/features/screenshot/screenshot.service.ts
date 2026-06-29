// src/features/screenshot/screenshot.service.ts

// -----------------------------------------------------------------------------
// SCREENSHOT SERVICE — Business Logic Layer.
// Xử lý upload file, lưu metadata, và trả danh sách ảnh cho Dashboard.
// -----------------------------------------------------------------------------

import path from "path";
import { ENV } from "../../shared/config/env";
import screenshotRepository from "./screenshot.repository";
import Device from "../devices/devices.model";
import {
  UploadScreenshotQueryDto,
  GetScreenshotsQueryDto,
  ScreenshotItemDto,
  GetScreenshotsResponseDto,
  ScreenshotUploadResponseDto,
} from "./screenshot.dto";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Tạo imageUrl đầy đủ từ filePath tương đối.
 * VD: "screenshots/abc.jpg" → "http://localhost:5000/uploads/screenshots/abc.jpg"
 */
function buildImageUrl(filePath: string): string {
  return `${ENV.BASE_URL}/uploads/${filePath}`;
}

/** Trích dateKey dạng "YYYY-MM-DD" từ ISO string */
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

const screenshotService = {
  /**
   * Xử lý upload một ảnh screenshot từ Agent.
   *
   * Flow:
   * 1. File ảnh đã được lưu vào disk bởi multer middleware
   * 2. Service lưu metadata vào MongoDB
   * 3. Trả ScreenshotUploadResponseDto
   *
   * @param file     - Multer file object (đã được lưu trên disk)
   * @param query    - Metadata từ query params (captureIndex, capturedAt, triggerTitle)
   * @param deviceId - Từ req.device._id (set bởi verifyDeviceToken middleware)
   * @param ownerId  - Từ req.ownerId (set bởi verifyDeviceToken middleware)
   */
  async handleUpload(
    file: Express.Multer.File,
    query: UploadScreenshotQueryDto,
    deviceId: string,
    ownerId: string,
  ): Promise<ScreenshotUploadResponseDto> {
    // filePath = đường dẫn tương đối từ thư mục uploads/
    // VD: file.path = "uploads/screenshots/abc-123.jpg" → filePath = "screenshots/abc-123.jpg"
    const filePath = path.relative("uploads", file.path).replace(/\\/g, "/");

    const doc = await screenshotRepository.save({
      deviceId,
      ownerId,
      triggerTitle: query.triggerTitle,
      filePath,
      fileName: file.filename,
      captureIndex: parseInt(query.captureIndex) as 0 | 1 | 2,
      capturedAt: query.capturedAt,
    });

    return {
      success: true,
      screenshotId: (doc._id as any).toString(),
      fileName: file.filename,
      message: `Đã lưu ảnh chụp màn hình tấm ${parseInt(query.captureIndex) + 1}/3`,
    };
  },

  /**
   * Lấy danh sách ảnh của 1 device cho Dashboard.
   *
   * Bảo mật: kiểm tra device thuộc về owner trước khi trả dữ liệu.
   *
   * @param deviceId - ID device cần xem
   * @param ownerId  - ID phụ huynh đang đăng nhập (từ JWT)
   * @param query    - Filter params (dateKey, page, limit)
   */
  async getScreenshots(
    deviceId: string,
    ownerId: string,
    query: GetScreenshotsQueryDto,
  ): Promise<GetScreenshotsResponseDto> {
    // 1. Kiểm tra ownership — device phải thuộc về phụ huynh đang đăng nhập
    const device = await Device.findById(deviceId).select("parentId");
    if (!device) {
      throw new Error("Thiết bị không tồn tại");
    }
    if (device.parentId.toString() !== ownerId) {
      throw new Error("Bạn không có quyền xem dữ liệu thiết bị này");
    }

    // 2. Parse pagination
    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20")));

    // 3. Lấy dữ liệu
    const dateKey = query.dateKey || todayDateKey();
    const { screenshots, total } = await screenshotRepository.getByDevice(
      deviceId,
      { dateKey, page, limit },
    );

    // 4. Map sang DTO — thêm imageUrl đầy đủ
    const screenshotItems: ScreenshotItemDto[] = screenshots.map((s: any) => ({
      id: s._id.toString(),
      deviceId: s.deviceId.toString(),
      triggerTitle: s.triggerTitle,
      imageUrl: buildImageUrl(s.filePath),
      captureIndex: s.captureIndex,
      capturedAt: s.capturedAt.toISOString(),
      dateKey: s.dateKey,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      screenshots: screenshotItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dateKey,
    };
  },
};

export default screenshotService;
