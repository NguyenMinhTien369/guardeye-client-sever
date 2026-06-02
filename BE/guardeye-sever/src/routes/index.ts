import { Router } from "express";
import authRoutes from "../features/auth/auth.routes";
// import tradeRoutes from '../features/trade/trade.routes';

const router = Router();

router.use("/auth", authRoutes);
// router.use('/trades', tradeRoutes);

export default router;
