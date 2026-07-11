import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";

const router = Router();

// Lấy dashboard cho 1 childId cụ thể.
router.get("/:childId", authenticate, dashboardController.getDashboardSummary.bind(dashboardController));

export default router;
