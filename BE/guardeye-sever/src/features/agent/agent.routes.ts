// src/features/agent/agent.routes.ts

// -----------------------------------------------------------------------------
// AGENT ROUTES
// Các endpoint dành riêng cho Agent (desktop client) gọi lên server.
//
// Thứ tự middleware trong mỗi route:
//   verifyDeviceToken → [validate] → controller
//
// Lưu ý bảo mật:
//   - KHÔNG dùng authenticate (JWT Bearer) — Agent dùng X-Device-Token thay thế.
//   - verifyDeviceToken xác thực token, gắn req.device + req.ownerId.
// -----------------------------------------------------------------------------

import { Router } from "express";
import * as agentController from "./agent.controller";
import { verifyDeviceToken } from "./agent.middleware";
import { validate, validateQuery, syncBodySchema, statusQuerySchema } from "./agent.validation";

const router = Router();

// -----------------------------------------------------------------------------
// POST /api/v1/agent/sync
// Agent gửi batch events lên server định kỳ (mặc định mỗi 5 phút).
//
// Header bắt buộc: X-Device-Token: <deviceToken>
// Body: SyncRequestDto { deviceToken, sentAt, eventCount, events[] }
//
// Response:
//   200 — lưu thành công → { success, savedCount, message }
//   400 — body không hợp lệ hoặc eventCount mismatch
//   401 — deviceToken không hợp lệ
//   403 — thiết bị bị vô hiệu hóa
//   500 — lỗi server
// -----------------------------------------------------------------------------
router.post(
  "/sync",
  verifyDeviceToken,       // ① Xác thực X-Device-Token, gắn req.device + req.ownerId
  validate(syncBodySchema), // ② Validate body theo Zod schema
  agentController.sync,    // ③ Xử lý và lưu events
);

// -----------------------------------------------------------------------------
// GET /api/v1/agent/status
// Agent poll trạng thái pause định kỳ (mặc định mỗi 30 giây).
//
// Header ưu tiên: X-Device-Token: <deviceToken>
// Query fallback: ?deviceToken=<token>
//
// Response:
//   200 — { success, data: { paused, since?, reason? } }
//   401 — deviceToken không hợp lệ
//   403 — thiết bị bị vô hiệu hóa
// -----------------------------------------------------------------------------
router.get(
  "/status",
  verifyDeviceToken,              // ① Xác thực X-Device-Token
  validateQuery(statusQuerySchema), // ② Validate query params (deviceToken optional)
  agentController.getStatus,     // ③ Trả trạng thái pause
);

export default router;
