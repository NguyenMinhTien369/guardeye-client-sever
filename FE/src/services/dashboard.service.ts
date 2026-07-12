import api from "./api";
import { DASHBOARD_ENDPOINTS } from "../constants/api";
import type { DashboardResponseDto } from "../types/dashboard.types";

// -----------------------------------------------------------------------------
// DASHBOARD SERVICE
// -----------------------------------------------------------------------------

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindowEventItem {
  id: string;
  deviceId: string;
  timestamp: string;
  title: string;
  processName: string;
  dateKey: string;
}

export interface ActivityResponse {
  events: WindowEventItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dateKey: string;
}

export interface ScreenshotItem {
  id: string;
  deviceId: string;
  triggerTitle: string;
  imageUrl: string;
  captureIndex: number;
  capturedAt: string;
  dateKey: string;
  createdAt: string;
}

export interface ScreenshotsResponse {
  screenshots: ScreenshotItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dateKey: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const dashboardService = {
  /**
   * GET /dashboard/:childId
   */
  async getDashboardSummary(childId: string): Promise<DashboardResponseDto> {
    const response = await api.get<{ data: DashboardResponseDto }>(
      DASHBOARD_ENDPOINTS.SUMMARY(childId)
    );
    return response.data.data;
  },

  /**
   * GET /dashboard/device/:deviceId/activity
   */
  async getActivity(
    deviceId: string,
    params?: { startDate?: string; endDate?: string; search?: string; sort?: string; page?: number; limit?: number }
  ): Promise<ActivityResponse> {
    const response = await api.get<ApiResponse<ActivityResponse>>(
      DASHBOARD_ENDPOINTS.ACTIVITY(deviceId),
      { params }
    );
    return response.data.data;
  },

  /**
   * GET /screenshots/device/:deviceId
   */
  async getScreenshots(
    deviceId: string,
    params?: { startDate?: string; endDate?: string; search?: string; sort?: string; page?: number; limit?: number }
  ): Promise<ScreenshotsResponse> {
    const response = await api.get<ApiResponse<ScreenshotsResponse>>(
      DASHBOARD_ENDPOINTS.SCREENSHOTS(deviceId),
      { params }
    );
    return response.data.data;
  },
};
