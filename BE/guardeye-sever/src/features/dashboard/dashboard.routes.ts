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
