import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
import childrenRoutes from "../features/children/children.routes";
import devicesRoutes, { devicesByChildRouter } from "../features/devices/devices.routes";
import agentRoutes from "../features/agent/agent.routes";
// import tradeRoutes from '../features/trade/trade.routes';
import aiRoutes from '../features/ai/ai.routes'; // Import router AI

const router = Router();

router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);

// Thêm route AI vào hệ thống
router.use('/ai', aiRoutes);

// POST /api/v1/children/:childId/devices
router.use("/children/:childId/devices", devicesByChildRouter);

// GET /api/v1/devices, PATCH /api/v1/devices/:id/pause|resume, DELETE /api/v1/devices/:id
router.use("/devices", devicesRoutes);

// POST /api/v1/agent/sync — Agent gửi batch events
// GET  /api/v1/agent/status — Agent poll trạng thái pause
router.use("/agent", agentRoutes);

// router.use('/trades', tradeRoutes);

export default router;
