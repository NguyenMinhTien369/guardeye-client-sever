import api from "./api";
import { DASHBOARD_ENDPOINTS } from "../constants/api";

// -----------------------------------------------------------------------------
// DASHBOARD SERVICE
// 2 hàm gọi API: lịch sử WindowEvent + danh sách ảnh chụp màn hình.
// Dùng axios instance đã setup Bearer token interceptor.
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
   * GET /dashboard/device/:deviceId/activity
   * Lấy lịch sử WindowEvent của 1 thiết bị theo ngày.
   */
  async getActivity(
    deviceId: string,
    params?: { dateKey?: string; page?: number; limit?: number }
  ): Promise<ActivityResponse> {
    const response = await api.get<ApiResponse<ActivityResponse>>(
      DASHBOARD_ENDPOINTS.ACTIVITY(deviceId),
      { params }
    );
    return response.data.data;
  },

  /**
   * GET /screenshots/device/:deviceId
   * Lấy danh sách ảnh chụp màn hình của 1 thiết bị theo ngày.
   */
  async getScreenshots(
    deviceId: string,
    params?: { dateKey?: string; page?: number; limit?: number }
  ): Promise<ScreenshotsResponse> {
    const response = await api.get<ApiResponse<ScreenshotsResponse>>(
      DASHBOARD_ENDPOINTS.SCREENSHOTS(deviceId),
      { params }
    );
    return response.data.data;
  },
};
