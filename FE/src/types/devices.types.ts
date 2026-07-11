// ===== Enums =====
export type DeviceStatus = "pending" | "active" | "inactive";

// ===== Device Entity (DeviceResponseDto từ BE) =====
export interface Device {
  id: string;
  childId: string;
  parentId: string;
  deviceName: string;
  monitoredUsers: string[];
  status: DeviceStatus;
  isPaused: boolean;
  pausedSince: string | null;
  pausedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Request DTOs =====

// POST /children/:childId/devices
export interface CreateDeviceRequest {
  deviceName: string;
  monitoredUsers: string[];
}

// PATCH /devices/:id/pause
export interface PauseDeviceRequest {
  pausedUntil?: string; // ISO string — nếu không truyền thì pause vô thời hạn
}

// ===== Response DTOs =====

export interface DevicesApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

// GET /devices — trả về mảng thẳng
export type GetAllDevicesResponse = DevicesApiResponse<Device[]>;

// POST /children/:childId/devices — trả về deviceToken DUY NHẤT 1 LẦN
export interface CreateDeviceResponseData {
  deviceToken: string;       // UUID — copy vào agent/config.json
  monitoredUsers: string[];
  device: Device;
  message: string;
}
export type CreateDeviceResponse = DevicesApiResponse<CreateDeviceResponseData>;

// PATCH /devices/:id/pause | /resume
export interface PauseResumeResponseData {
  device: Device;
  message: string;
}
export type PauseResumeResponse = DevicesApiResponse<PauseResumeResponseData>;

// DELETE /devices/:id
export type DeleteDeviceResponse = DevicesApiResponse<{ deletedId?: string }>;

// ===== Form State =====
export interface CreateDeviceFormData {
  childId: string;
  deviceName: string;
  monitoredUsers: string[]; // mảng username đã thêm
  userInput: string;        // text đang nhập trong tag input
}

export interface CreateDeviceFormErrors {
  childId?: string;
  deviceName?: string;
  monitoredUsers?: string;
}

export interface PauseFormData {
  pauseType: "indefinite" | "until";
  pausedUntil: string; // ISO local datetime string
}
