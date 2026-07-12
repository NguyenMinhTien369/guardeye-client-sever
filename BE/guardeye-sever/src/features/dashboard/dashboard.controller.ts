/*
// CODE CŨ (TỪ NHÁNH CỦA BẠN TRƯỚC KHI PULL):
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
*/

// CODE MỚI TRÊN GITHUB:
import { Request, Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  AuthFailureError,
  ForbiddenError,
} from "../../shared/core/error.response";

export class DashboardController {
  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const childId = (req.params.childId as string) || "default";
      
      const dashboardData = await dashboardService.getDashboardSummary(childId);
      
      new OKResponse({
        message: "Get Dashboard Summary successfully",
        data: dashboardData
      }).send(res);
    } catch (error) {
      next(error);
    }
  }

  async getActivity(req: Request<{ deviceId: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(new AuthFailureError("Vui lòng đăng nhập để xem dữ liệu"));
        return;
      }

      const { deviceId } = req.params;
      const ownerId = req.user._id.toString();
      const { startDate, endDate, search, sort, page, limit } = req.query as {
        startDate?: string;
        endDate?: string;
        search?: string;
        sort?: string;
        page?: string;
        limit?: string;
      };

      const result = await dashboardService.getActivity(deviceId, ownerId, {
        startDate,
        endDate,
        search,
        sort,
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
  }
}

export const dashboardController = new DashboardController();
