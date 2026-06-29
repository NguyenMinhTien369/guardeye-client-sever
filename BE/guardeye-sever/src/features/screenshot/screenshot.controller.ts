// src/features/screenshot/screenshot.controller.ts

// -----------------------------------------------------------------------------
// SCREENSHOT CONTROLLER — HTTP handlers.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import screenshotService from "./screenshot.service";
import { UploadScreenshotQueryDto, GetScreenshotsQueryDto } from "./screenshot.dto";
import { OKResponse, CreatedResponse } from "../../shared/core/success.response";
import { BadRequestError, AuthFailureError, ForbiddenError } from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// AGENT ENDPOINT
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/agent/screenshot
 *
 * Agent upload một ảnh screenshot lên server.
 * Middleware pipeline: verifyDeviceToken → multer → validateQuery → uploadScreenshot
 *
 * Body: multipart/form-data
 *   - screenshot: File (JPG/PNG, max 5MB)
 *
 * Query params:
 *   - captureIndex: "0" | "1" | "2"
 *   - capturedAt: ISO 8601 string
 *   - triggerTitle: string (tên cửa sổ trình duyệt khi trigger)
 */
export const uploadScreenshot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Multer đã lưu file vào disk — nếu không có file thì 400
    if (!req.file) {
      next(new BadRequestError("File ảnh (field: screenshot) là bắt buộc"));
      return;
    }

    if (!req.device) {
      next(new AuthFailureError("Device chưa được xác thực"));
      return;
    }

    const deviceId = (req.device as any)._id.toString();
    const ownerId = req.ownerId!;
    const query = req.query as unknown as UploadScreenshotQueryDto;

    const result = await screenshotService.handleUpload(
      req.file,
      query,
      deviceId,
      ownerId,
    );

    new CreatedResponse({
      message: result.message,
      data: result,
    }).send(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload ảnh thất bại";
    next(new BadRequestError(message));
  }
};

// -----------------------------------------------------------------------------
// DASHBOARD ENDPOINT
// -----------------------------------------------------------------------------

/**
 * GET /api/v1/screenshots/device/:deviceId
 *
 * Phụ huynh lấy danh sách ảnh chụp màn hình của 1 thiết bị.
 * Middleware pipeline: authenticate → getScreenshots
 *
 * Path params:
 *   - deviceId: ObjectId của thiết bị
 *
 * Query params:
 *   - dateKey?: "YYYY-MM-DD" (mặc định: hôm nay)
 *   - page?: number (mặc định: 1)
 *   - limit?: number (mặc định: 20, tối đa: 100)
 */
export const getScreenshots = async (
  req: Request<{ deviceId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      next(new AuthFailureError("Vui lòng đăng nhập để xem dữ liệu"));
      return;
    }

    const { deviceId } = req.params;
    const ownerId = req.user._id.toString();
    const query = req.query as unknown as GetScreenshotsQueryDto;

    const result = await screenshotService.getScreenshots(
      deviceId,
      ownerId,
      query,
    );

    new OKResponse({
      message: "Lấy danh sách ảnh chụp màn hình thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lấy dữ liệu thất bại";

    // Ownership violation → 403 Forbidden
    if (message.includes("không có quyền")) {
      next(new ForbiddenError(message));
      return;
    }

    next(new BadRequestError(message));
  }
};
