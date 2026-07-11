import { Request, Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { OKResponse } from "../../shared/core/success.response";

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
}

export const dashboardController = new DashboardController();
