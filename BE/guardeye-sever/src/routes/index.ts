import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
import childrenRoutes from "../features/children/children.routes";
import devicesRoutes, { devicesByChildRouter } from "../features/devices/devices.routes";
// import tradeRoutes from '../features/trade/trade.routes';

const router = Router();

router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);

// POST /api/v1/children/:childId/devices
router.use("/children/:childId/devices", devicesByChildRouter);

// GET /api/v1/devices, PATCH /api/v1/devices/:id/pause|resume, DELETE /api/v1/devices/:id
router.use("/devices", devicesRoutes);

// router.use('/trades', tradeRoutes);

export default router;
