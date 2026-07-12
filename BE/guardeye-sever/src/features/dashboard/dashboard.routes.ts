/*
// CODE CŨ (TỪ NHÁNH CỦA BẠN TRƯỚC KHI PULL):
// src/features/dashboard/dashboard.routes.ts

// -----------------------------------------------------------------------------
// DASHBOARD ROUTES — Endpoint dành cho Dashboard FE (phụ huynh xem dữ liệu).
// Tất cả route đều yêu cầu authenticate (JWT Bearer).
// -----------------------------------------------------------------------------

import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";

const router = Router();

// Tất cả route dashboard đều yêu cầu đăng nhập
router.use(authenticate);

// GET /api/v1/dashboard/device/:deviceId/activity
// Lấy lịch sử hoạt động (WindowEvent) của 1 thiết bị
// Query: ?dateKey=YYYY-MM-DD&page=1&limit=30
router.get("/device/:deviceId/activity", dashboardController.getActivity);

export default router;
*/

// CODE MỚI TRÊN GITHUB:
import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authenticate } from "../../shared/middlewares/auth.middleware";

const router = Router();

// Lấy dashboard cho 1 childId cụ thể.
router.get("/:childId", authenticate, dashboardController.getDashboardSummary.bind(dashboardController));

// GET /api/v1/dashboard/device/:deviceId/activity
// Lấy lịch sử hoạt động (WindowEvent) của 1 thiết bị
router.get("/device/:deviceId/activity", authenticate, dashboardController.getActivity.bind(dashboardController));

export default router;
