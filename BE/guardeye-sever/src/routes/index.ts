import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
import childrenRoutes from "../features/children/children.routes";
import devicesRoutes from "../features/devices/devices.routes";
import dashboardRoutes from "../features/dashboard/dashboard.routes";
// import tradeRoutes from '../features/trade/trade.routes';

const router = Router();

router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);
router.use("/devices", devicesRoutes);
router.use("/dashboard", dashboardRoutes);
// router.use('/trades', tradeRoutes);

export default router;
