// src/features/devices/devices.dto.ts

// -----------------------------------------------------------------------------
// DEVICES DTO - Định nghĩa cấu trúc dữ liệu cho quản lý thiết bị giám sát
// -----------------------------------------------------------------------------

import { DeviceStatus } from "./devices.model";

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

// [CREATE] Phụ huynh tạo thiết bị mới cho một đứa trẻ
// childId lấy từ URL param (:childId) — không cần truyền trong body
// deviceToken do server tự sinh UUID — client không được tự đặt
export interface CreateDeviceRequestDto {
  deviceName:     string;   // Tên thân thiện để phụ huynh nhận ra thiết bị, VD: "Laptop của Minh"
  monitoredUsers: string[]; // Danh sách Windows username cần giám sát, VD: ["MinhCup", "Guest"]
}

// [PAUSE] Tạm dừng giám sát thiết bị
export interface PauseDeviceRequestDto {
  pausedUntil?: string; // ISO date string — nếu không truyền thì pause vô thời hạn
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// [SINGLE] Thông tin một thiết bị trả về client trong các request thông thường
// Không chứa deviceToken — token chỉ xuất hiện đúng 1 lần khi tạo mới
export interface DeviceResponseDto {
  id:             string;
  childId:        string;
  parentId:       string;
  deviceName:     string;
  monitoredUsers: string[];
  status:         DeviceStatus;
  isPaused:       boolean;
  pausedSince:    Date | null;
  pausedUntil:    Date | null;
  createdAt:      Date;
  updatedAt:      Date;
}

// [CREATE] Response đặc biệt sau khi tạo thiết bị thành công
// deviceToken được trả về DUY NHẤT 1 LẦN này — phụ huynh copy vào agent
// Sau đó server KHÔNG BAO GIỜ trả token này nữa (select: false trong model)
export interface CreateDeviceResponseDto {
  deviceToken:    string;   // UUID — copy vào agent/config.json
  monitoredUsers: string[]; // Danh sách user — copy vào agent/config.json
  device:         DeviceResponseDto;
  message:        string;
}

// [DELETE] Response sau khi xóa thiết bị thành công
export interface DeleteDeviceResponseDto {
  message:   string;
  deletedId: string;
}

// [PAUSE / RESUME] Response sau khi pause hoặc resume giám sát
export interface PauseResumeDeviceResponseDto {
  device:  DeviceResponseDto;
  message: string;
}
