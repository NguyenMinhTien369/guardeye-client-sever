import api from "./api";
import { DEVICES_ENDPOINTS } from "../constants/api";
import type {
  GetAllDevicesResponse,
  CreateDeviceRequest,
  CreateDeviceResponse,
  PauseDeviceRequest,
  PauseResumeResponse,
  DeleteDeviceResponse,
} from "../types/devices.types";

// -----------------------------------------------------------------------------
// DEVICES SERVICE
// 5 hàm gọi API khớp hoàn toàn với BE endpoints.
// Tất cả đều dùng axios instance đã setup Bearer token interceptor.
// -----------------------------------------------------------------------------

export const devicesService = {
  /**
   * API 2: GET /devices
   * Lấy danh sách tất cả thiết bị của phụ huynh đang đăng nhập.
   */
  async getAll(): Promise<GetAllDevicesResponse> {
    const response = await api.get<GetAllDevicesResponse>(
      DEVICES_ENDPOINTS.BASE
    );
    return response.data;
  },

  /**
   * API 1: POST /children/:childId/devices
   * Tạo thiết bị mới cho một trẻ cụ thể.
   * - childId nằm trong URL param (không phải body)
   * - deviceToken trả về DUY NHẤT 1 LẦN trong response này
   * Body: { deviceName, monitoredUsers[] }
   */
  async create(
    childId: string,
    data: CreateDeviceRequest
  ): Promise<CreateDeviceResponse> {
    const response = await api.post<CreateDeviceResponse>(
      DEVICES_ENDPOINTS.BY_CHILD(childId),
      data
    );
    return response.data;
  },

  /**
   * API 3: PATCH /devices/:id/pause
   * Tạm dừng giám sát.
   * - Không truyền pausedUntil → pause vô thời hạn
   * - Truyền pausedUntil (ISO string) → agent tự resume khi hết giờ
   */
  async pause(
    id: string,
    data: PauseDeviceRequest = {}
  ): Promise<PauseResumeResponse> {
    const response = await api.patch<PauseResumeResponse>(
      DEVICES_ENDPOINTS.PAUSE(id),
      data
    );
    return response.data;
  },

  /**
   * API 4: PATCH /devices/:id/resume
   * Tiếp tục giám sát sau khi tạm dừng — không cần body.
   */
  async resume(id: string): Promise<PauseResumeResponse> {
    const response = await api.patch<PauseResumeResponse>(
      DEVICES_ENDPOINTS.RESUME(id)
    );
    return response.data;
  },

  /**
   * API 5: DELETE /devices/:id
   * Xóa thiết bị.
   */
  async remove(id: string): Promise<DeleteDeviceResponse> {
    const response = await api.delete<DeleteDeviceResponse>(
      DEVICES_ENDPOINTS.BY_ID(id)
    );
    return response.data;
  },
};
