import mongoose, { Document, Schema, Model } from "mongoose";

// Các trạng thái kết nối của thiết bị
export enum DeviceStatus {
  pending  = "pending",   // Chưa cài agent
  active   = "active",    // Agent đang chạy
  inactive = "inactive",  // Agent không ping về
}

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

export interface IDevice extends Document {
  // Foreign keys
  childId:  mongoose.Types.ObjectId; // Trẻ được giám sát — quan hệ 1-1 (unique)
  parentId: mongoose.Types.ObjectId; // Phụ huynh sở hữu   — quan hệ 1-N

  // Thông tin thiết bị
  deviceName:     string;
  monitoredUsers: string[]; // Danh sách Windows username được giám sát, VD: ["Minh", "Con"]

  // Trạng thái kết nối
  status: DeviceStatus; // pending | active | inactive

  // Trạng thái pause
  isPaused:    boolean;
  pausedSince: Date | null;
  pausedUntil: Date | null; // Hết thời điểm này thì tự resume

  // Trường nhạy cảm — select: false, không bao giờ trả về client
  deviceToken?: string; // UUID định danh thiết bị (tương đương device_token)

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type DeviceModel = Model<IDevice>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const deviceSchema = new Schema<IDevice, DeviceModel>(
  {
    childId: {
      type: Schema.Types.ObjectId,
      ref: "Child",
      required: [true, "Child ID là bắt buộc"],
      unique: true,  // Đảm bảo quan hệ 1-1: mỗi trẻ chỉ có tối đa 1 thiết bị
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Parent ID là bắt buộc"],
      index: true,   // Index vì thường dùng để query danh sách device của 1 user
    },
    deviceToken: {
      type: String,
      required: [true, "Device token là bắt buộc"],
      unique: true,  // Mỗi thiết bị vật lý có UUID duy nhất
      select: false, // Không bao giờ trả về client — thông tin nhạy cảm
    },
    deviceName: {
      type: String,
      required: [true, "Tên thiết bị là bắt buộc"],
      trim: true,
      minlength: [2, "Tên thiết bị phải có ít nhất 2 ký tự"],
      maxlength: [100, "Tên thiết bị không được vượt quá 100 ký tự"],
    },
    monitoredUsers: {
      type: [String],
      default: [],  // Danh sách Windows username cần giám sát
    },
    status: {
      type: String,
      enum: Object.values(DeviceStatus),
      default: DeviceStatus.pending,
      index: true,
    },
    isPaused: {
      type: Boolean,
      default: false,
      index: true,
    },
    pausedSince: {
      type: Date,
      default: null,
    },
    pausedUntil: {
      type: Date,
      default: null, // Hết thời điểm này agent sẽ tự động resume
    },
  },
  {
    timestamps: true,
  },
);

// -----------------------------------------------------------------------------
// 3. DATA TRANSFORM
// -----------------------------------------------------------------------------

deviceSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // deviceToken là trường nhạy cảm — không bao giờ để lọt ra ngoài
    delete ret.deviceToken;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 4. EXPORT
// -----------------------------------------------------------------------------

const Device = mongoose.model<IDevice, DeviceModel>("Device", deviceSchema);

export default Device;
