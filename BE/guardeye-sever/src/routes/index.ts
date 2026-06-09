import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
import childrenRoutes from "../features/children/children.routes";
// import tradeRoutes from '../features/trade/trade.routes';

const router = Router();

router.use("/auth", authRoutes);
router.use("/children", childrenRoutes);
// router.use('/trades', tradeRoutes);

export default router;
