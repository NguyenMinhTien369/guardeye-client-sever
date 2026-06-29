// src/features/screenshot/screenshot.routes.ts

// -----------------------------------------------------------------------------
// SCREENSHOT ROUTES — 2 router tách biệt:
//   1. agentScreenshotRouter  — dành cho Agent desktop (X-Device-Token)
//   2. dashboardScreenshotRouter — dành cho Dashboard FE (JWT Bearer)
//
// Đăng ký trong src/routes/index.ts:
//   router.use('/agent', agentScreenshotRouter);         → POST /api/v1/agent/screenshot
//   router.use('/screenshots', dashboardScreenshotRouter); → GET  /api/v1/screenshots/device/:deviceId
// -----------------------------------------------------------------------------

import { Router } from "express";
import multer from "multer";
import * as screenshotController from "./screenshot.controller";
import { verifyDeviceToken } from "../agent/agent.middleware";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { screenshotUpload } from "./screenshot.upload";
import { validateQuery, uploadQuerySchema, getScreenshotsQuerySchema } from "./screenshot.validation";

// =============================================================================
// ROUTER 1: Agent Routes — /api/v1/agent/screenshot
// =============================================================================

export const agentScreenshotRouter = Router();

// -----------------------------------------------------------------------------
// POST /api/v1/agent/screenshot
// Agent upload 1 ảnh chụp màn hình.
//
// Header bắt buộc: X-Device-Token: <deviceToken>
// Body: multipart/form-data { screenshot: File }
// Query: ?captureIndex=0&capturedAt=<ISO>&triggerTitle=<string>
//
// Response:
//   201 — upload thành công → { screenshotId, fileName, message }
//   400 — thiếu file hoặc query không hợp lệ
//   401 — deviceToken không hợp lệ
//   403 — device bị vô hiệu hóa
//   413 — file quá lớn (>5MB)
// -----------------------------------------------------------------------------
agentScreenshotRouter.post(
  "/screenshot",
  verifyDeviceToken,                                  // ① Xác thực Agent
  screenshotUpload.single("screenshot"),              // ② Multer: lưu file → req.file
  (req: any, res: any, next: any) => {                // ③ Bắt lỗi Multer (file type/size)
    next();
  },
  validateQuery(uploadQuerySchema),                   // ④ Validate query params
  screenshotController.uploadScreenshot,              // ⑤ Xử lý logic
);

// =============================================================================
// ROUTER 2: Dashboard Routes — /api/v1/screenshots/*
// =============================================================================

export const dashboardScreenshotRouter = Router();

// -----------------------------------------------------------------------------
// GET /api/v1/screenshots/device/:deviceId
// Phụ huynh lấy danh sách ảnh của 1 thiết bị.
//
// Header bắt buộc: Authorization: Bearer <accessToken>
// Path: /device/:deviceId
// Query: ?dateKey=YYYY-MM-DD&page=1&limit=20
//
// Response:
//   200 — { screenshots[], total, page, limit, totalPages, dateKey }
//   401 — chưa đăng nhập
//   403 — không có quyền xem thiết bị này
//   404 — thiết bị không tồn tại
// -----------------------------------------------------------------------------
dashboardScreenshotRouter.get(
  "/device/:deviceId",
  authenticate,                                       // ① Xác thực JWT
  validateQuery(getScreenshotsQuerySchema),           // ② Validate query params
  screenshotController.getScreenshots,                // ③ Trả dữ liệu
);
