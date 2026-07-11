// src/features/dashboard/dashboard.controller.ts

// -----------------------------------------------------------------------------
// DASHBOARD CONTROLLER — HTTP handlers cho Dashboard FE.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import dashboardService from "./dashboard.service";
import { OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  AuthFailureError,
  ForbiddenError,
} from "../../shared/core/error.response";

/**
 * GET /api/v1/dashboard/device/:deviceId/activity
 *
 * Phụ huynh lấy lịch sử hoạt động (WindowEvent) của 1 thiết bị.
 * Middleware pipeline: authenticate → getActivity
 *
 * Path params:
 *   - deviceId: ObjectId của thiết bị
 *
 * Query params:
 *   - dateKey?: "YYYY-MM-DD" (mặc định: hôm nay)
 *   - page?:    number       (mặc định: 1)
 *   - limit?:   number       (mặc định: 30, tối đa: 100)
 */
export const getActivity = async (
  req: Request<{ deviceId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      next(new AuthFailureError("Vui lòng đăng nhập để xem dữ liệu"));
      return;
    }

    const { deviceId } = req.params;
    const ownerId = req.user._id.toString();
    const { dateKey, page, limit } = req.query as {
      dateKey?: string;
      page?: string;
      limit?: string;
    };

    const result = await dashboardService.getActivity(deviceId, ownerId, {
      dateKey,
      page:  page  ? parseInt(page)  : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    new OKResponse({
      message: "Lấy lịch sử hoạt động thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lấy dữ liệu thất bại";

    if (message.includes("không có quyền")) {
      next(new ForbiddenError(message));
      return;
    }

    next(new BadRequestError(message));
  }
};
