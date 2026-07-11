// src/features/dashboard/dashboard.service.ts

// -----------------------------------------------------------------------------
// DASHBOARD SERVICE — Business logic cho Dashboard FE.
// Kiểm tra quyền sở hữu trước khi trả dữ liệu WindowEvent.
// -----------------------------------------------------------------------------

import dashboardRepository, { GetActivityParams } from "./dashboard.repository";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface GetActivityResponse {
  events: Array<{
    id: string;
    deviceId: string;
    timestamp: string;
    title: string;
    processName: string;
    dateKey: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dateKey: string;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

const dashboardService = {
  /**
   * Lấy lịch sử hoạt động (WindowEvent) của 1 thiết bị cho Dashboard.
   *
   * @param deviceId  - ID thiết bị cần xem
   * @param ownerId   - ID phụ huynh đang đăng nhập (từ JWT)
   * @param params    - Filter: dateKey, page, limit
   */
  async getActivity(
    deviceId: string,
    ownerId: string,
    params: { dateKey?: string; page?: number; limit?: number },
  ): Promise<GetActivityResponse> {
    // 1. Kiểm tra ownership — thiết bị phải thuộc về phụ huynh đang đăng nhập
    const isOwner = await dashboardRepository.verifyDeviceOwnership(deviceId, ownerId);
    if (!isOwner) {
      throw new Error("Bạn không có quyền xem dữ liệu thiết bị này");
    }

    // 2. Parse & clamp pagination
    const page  = Math.max(1, params.page  || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const dateKey = params.dateKey || new Date().toISOString().slice(0, 10);

    // 3. Query từ repository
    const { events, total } = await dashboardRepository.getWindowEvents(
      deviceId,
      { dateKey, page, limit },
    );

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dateKey,
    };
  },
};

export default dashboardService;
