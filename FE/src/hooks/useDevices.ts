import { useState, useCallback } from "react";
import { devicesService } from "../services/devices.service";
import type {
  Device,
  CreateDeviceRequest,
  PauseDeviceRequest,
  CreateDeviceResponseData,
} from "../types/devices.types";

// -----------------------------------------------------------------------------
// useDevices Hook
// Quản lý toàn bộ state và actions cho trang Devices.
// -----------------------------------------------------------------------------

interface UseDevicesReturn {
  devices: Device[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  // Actions — mỗi action map 1-1 với 1 API
  loadDevices: () => Promise<void>;
  createDevice: (childId: string, data: CreateDeviceRequest) => Promise<CreateDeviceResponseData>;
  pauseDevice: (id: string, data?: PauseDeviceRequest) => Promise<void>;
  resumeDevice: (id: string) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
}

export function useDevices(): UseDevicesReturn {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * API 2: GET /devices — Load danh sách
   */
  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await devicesService.getAll();
      setDevices(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải danh sách thiết bị";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * API 1: POST /children/:childId/devices — Tạo thiết bị
   * Trả về CreateDeviceResponseData để trang chính lấy deviceToken hiển thị
   */
  const createDevice = useCallback(
    async (childId: string, data: CreateDeviceRequest): Promise<CreateDeviceResponseData> => {
      setIsSubmitting(true);
      try {
        const response = await devicesService.create(childId, data);
        const responseData = response.data!;
        // Thêm device mới vào đầu danh sách
        setDevices((prev) => [responseData.device, ...prev]);
        return responseData;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  /**
   * API 3: PATCH /devices/:id/pause — Tạm dừng
   * Sau khi pause thành công, cập nhật device trong danh sách
   */
  const pauseDevice = useCallback(async (id: string, data: PauseDeviceRequest = {}) => {
    setIsSubmitting(true);
    try {
      const response = await devicesService.pause(id, data);
      if (response.data?.device) {
        setDevices((prev) =>
          prev.map((d) => (d.id === id ? response.data!.device : d))
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * API 4: PATCH /devices/:id/resume — Tiếp tục giám sát
   * Sau khi resume, cập nhật lại device trong danh sách
   */
  const resumeDevice = useCallback(async (id: string) => {
    setIsSubmitting(true);
    try {
      const response = await devicesService.resume(id);
      if (response.data?.device) {
        setDevices((prev) =>
          prev.map((d) => (d.id === id ? response.data!.device : d))
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * API 5: DELETE /devices/:id — Xóa thiết bị
   * Sau khi xóa thành công, loại khỏi danh sách
   */
  const deleteDevice = useCallback(async (id: string) => {
    setIsSubmitting(true);
    try {
      await devicesService.remove(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    devices,
    isLoading,
    isSubmitting,
    error,
    loadDevices,
    createDevice,
    pauseDevice,
    resumeDevice,
    deleteDevice,
  };
}
