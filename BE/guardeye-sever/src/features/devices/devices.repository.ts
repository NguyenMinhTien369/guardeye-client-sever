import Device, { IDevice } from "./devices.model";
import { CreateDeviceRequestDto } from "./devices.dto";

// -----------------------------------------------------------------------------
// DEVICES REPOSITORY
// Chịu trách nhiệm tương tác với database qua Mongoose Model cho thực thể Device.
// -----------------------------------------------------------------------------

export class DevicesRepository {
  // ---------------------------------------------------------------------------
  // WRITE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tạo thiết bị mới — nhận đầy đủ data đã được service chuẩn bị (kể cả deviceToken).
   */
  async create(data: {
    parentId:       string;
    childId:        string;
    deviceToken:    string;
  } & CreateDeviceRequestDto): Promise<IDevice> {
    const device = new Device(data);
    return device.save();
  }

  /**
   * Xóa thiết bị theo ID và parentId — đảm bảo phụ huynh chỉ xóa thiết bị của mình.
   */
  async deleteByIdAndParent(deviceId: string, parentId: string): Promise<IDevice | null> {
    return Device.findOneAndDelete({ _id: deviceId, parentId });
  }

  // ---------------------------------------------------------------------------
  // READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tìm tất cả thiết bị thuộc về một phụ huynh.
   */
  async findAllByParent(parentId: string): Promise<IDevice[]> {
    return Device.find({ parentId });
  }

  /**
   * Tìm thiết bị theo ID và parentId — đảm bảo phụ huynh chỉ thấy thiết bị của mình.
   */
  async findByIdAndParent(deviceId: string, parentId: string): Promise<IDevice | null> {
    return Device.findOne({ _id: deviceId, parentId });
  }

  /**
   * Kiểm tra một childId đã có thiết bị chưa — dùng để validate quan hệ 1-1.
   */
  async findByChildId(childId: string): Promise<IDevice | null> {
    return Device.findOne({ childId });
  }

  /**
   * Tìm thiết bị theo ID và lấy kèm deviceToken (select: false nên phải chỉ định rõ).
   * Chỉ dùng nội bộ — KHÔNG bao giờ trả kết quả trực tiếp ra controller.
   */
  async findByIdWithToken(deviceId: string): Promise<IDevice | null> {
    return Device.findById(deviceId).select("+deviceToken");
  }
}

export default new DevicesRepository();
