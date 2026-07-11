import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
import childrenRoutes from "../features/children/children.routes";
import devicesRoutes, { devicesByChildRouter } from "../features/devices/devices.routes";
import agentRoutes from "../features/agent/agent.routes";
import {
  agentScreenshotRouter,
  dashboardScreenshotRouter,
} from "../features/screenshot/screenshot.routes";
// import tradeRoutes from '../features/trade/trade.routes';
import aiRoutes from '../features/ai/ai.routes'; // Import router AI
import dashboardRoutes from '../features/dashboard/dashboard.routes'; // Dashboard FE

const router = Router();

router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);

// Thêm route AI vào hệ thống
router.use('/ai', aiRoutes);

// GET /api/v1/dashboard/device/:deviceId/activity — Phụ huynh xem lịch sử WindowEvent
router.use('/dashboard', dashboardRoutes);

// POST /api/v1/children/:childId/devices
router.use("/children/:childId/devices", devicesByChildRouter);

// GET /api/v1/devices, PATCH /api/v1/devices/:id/pause|resume, DELETE /api/v1/devices/:id
router.use("/devices", devicesRoutes);

// POST /api/v1/agent/sync — Agent gửi batch events
// GET  /api/v1/agent/status — Agent poll trạng thái pause
router.use("/agent", agentRoutes);

// POST /api/v1/agent/screenshot — Agent upload ảnh chụp màn hình
router.use("/agent", agentScreenshotRouter);

// GET /api/v1/screenshots/device/:deviceId — Phụ huynh xem ảnh
router.use("/screenshots", dashboardScreenshotRouter);

// router.use('/trades', tradeRoutes);

export default router;
