import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import devicesRepository from "./devices.repository";
import {
  CreateDeviceRequestDto,
  CreateDeviceResponseDto,
  DeviceResponseDto,
  PauseDeviceRequestDto,
  PauseResumeDeviceResponseDto,
} from "./devices.dto";
import { IDevice } from "./devices.model";
import { BadRequestError, NotFoundError } from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// DEVICES SERVICE
// Chứa business logic cho quản lý thiết bị giám sát.
// -----------------------------------------------------------------------------

// Đường dẫn tới config.json của agent — chỉ dùng trong môi trường development
const AGENT_CONFIG_PATH = path.resolve(__dirname, "../../../../../agent/config.json");

export class DevicesService {
  /**
   * Chuyển đổi từ Mongoose document sang DTO sạch để trả về client.
   * Không bao giờ chứa deviceToken trong output này.
   */
  private toResponseDto(device: IDevice): DeviceResponseDto {
    return {
      id:             device._id.toString(),
      childId:        device.childId.toString(),
      parentId:       device.parentId.toString(),
      deviceName:     device.deviceName,
      monitoredUsers: device.monitoredUsers,
      status:         device.status,
      isPaused:       device.isPaused,
      pausedSince:    device.pausedSince,
      pausedUntil:    device.pausedUntil,
      createdAt:      device.createdAt,
      updatedAt:      device.updatedAt,
    };
  }

  /**
   * [DEV ONLY] Ghi deviceToken và monitoredUsers vào agent/config.json.
   * Chỉ chạy khi NODE_ENV !== "production" để tránh rủi ro môi trường thật.
   */
  private writeAgentConfig(deviceToken: string, monitoredUsers: string[]): void {
    if (process.env.NODE_ENV === "production") return;

    try {
      // Đọc config hiện tại để giữ nguyên các trường khác (serverUrl, intervals...)
      const existing = fs.existsSync(AGENT_CONFIG_PATH)
        ? JSON.parse(fs.readFileSync(AGENT_CONFIG_PATH, "utf-8"))
        : {};

      const updated = {
        ...existing,
        deviceToken,
        monitoredUsers,
      };

      fs.writeFileSync(AGENT_CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
      console.log("[DEV] agent/config.json đã được cập nhật với deviceToken mới.");
    } catch (err) {
      // Không throw — lỗi ghi config không nên làm fail cả request tạo thiết bị
      console.warn("[DEV] Không thể ghi agent/config.json:", err);
    }
  }

  /**
   * Tạo thiết bị mới cho một đứa trẻ.
   * - childId lấy từ URL param (đã validate ở controller)
   * - parentId lấy từ JWT token (req.user)
   * - deviceToken do server tự sinh UUID — không nhận từ client
   *
   * Ở môi trường development: tự động ghi token vào agent/config.json
   */
  async create(
    parentId: string,
    childId:  string,
    data:     CreateDeviceRequestDto
  ): Promise<CreateDeviceResponseDto> {
    // Kiểm tra quan hệ 1-1: một trẻ chỉ được gắn đúng 1 thiết bị
    const existing = await devicesRepository.findByChildId(childId);
    if (existing) {
      throw new BadRequestError(
        "Trẻ này đã có thiết bị được đăng ký. Mỗi trẻ chỉ có thể gắn một thiết bị."
      );
    }

    // Server tự sinh UUID — client không được tự đặt token
    const deviceToken = randomUUID();

    const device = await devicesRepository.create({
      parentId,
      childId,
      deviceToken,
      ...data,
    });

    // [DEV ONLY] Ghi vào config.json để agent có thể chạy ngay mà không cần copy tay
    this.writeAgentConfig(deviceToken, device.monitoredUsers);

    return {
      deviceToken,                         // Trả về DUY NHẤT 1 LẦN — sau này không thể lấy lại
      monitoredUsers: device.monitoredUsers,
      device:         this.toResponseDto(device),
      message:        "Đăng ký thiết bị thành công. Hãy sao chép deviceToken vào agent trước khi đóng trang này.",
    };
  }

  /**
   * Lấy danh sách tất cả thiết bị của phụ huynh đang đăng nhập.
   */
  async getAll(parentId: string): Promise<DeviceResponseDto[]> {
    const devices = await devicesRepository.findAllByParent(parentId);
    return devices.map((d) => this.toResponseDto(d));
  }

  /**
   * Tạm dừng giám sát thiết bị.
   * - Không truyền pausedUntil → pause vô thời hạn (mở lại bằng tay)
   * - Truyền pausedUntil → agent tự động resume khi hết giờ
   */
  async pause(
    deviceId: string,
    parentId: string,
    dto:      PauseDeviceRequestDto
  ): Promise<PauseResumeDeviceResponseDto> {
    // Xác minh ownership trước khi cho phép thao tác
    const device = await devicesRepository.findByIdAndParent(deviceId, parentId);
    if (!device) {
      throw new NotFoundError("Không tìm thấy thiết bị");
    }

    const pausedSince = new Date();
    // Nếu có deadline → parse sang Date; không có → null (vô thời hạn)
    const pausedUntil = dto.pausedUntil ? new Date(dto.pausedUntil) : null;

    const updated = await devicesRepository.pauseDevice(deviceId, pausedSince, pausedUntil);
    if (!updated) {
      throw new NotFoundError("Không tìm thấy thiết bị để tạm dừng");
    }

    return {
      device:  this.toResponseDto(updated),
      message: pausedUntil
        ? `Thiết bị đã được tạm dừng đến ${pausedUntil.toISOString()}.`
        : "Thiết bị đã được tạm dừng.",
    };
  }

  /**
   * Tiếp tục giám sát sau khi tạm dừng — reset toàn bộ trạng thái pause.
   */
  async resume(
    deviceId: string,
    parentId: string
  ): Promise<PauseResumeDeviceResponseDto> {
    // Xác minh ownership trước khi cho phép thao tác
    const device = await devicesRepository.findByIdAndParent(deviceId, parentId);
    if (!device) {
      throw new NotFoundError("Không tìm thấy thiết bị");
    }

    const updated = await devicesRepository.resumeDevice(deviceId);
    if (!updated) {
      throw new NotFoundError("Không tìm thấy thiết bị để tiếp tục");
    }

    return {
      device:  this.toResponseDto(updated),
      message: "Thiết bị đã được tiếp tục giám sát.",
    };
  }

  /**
   * Xóa thiết bị theo ID — chỉ cho phép phụ huynh sở hữu thực hiện.
   */
  async remove(deviceId: string, parentId: string): Promise<void> {
    const device = await devicesRepository.deleteByIdAndParent(deviceId, parentId);
    if (!device) {
      throw new NotFoundError("Không tìm thấy thiết bị để xóa");
    }
  }
}

export default new DevicesService();
