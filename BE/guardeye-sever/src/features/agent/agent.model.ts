import mongoose, { Document, Schema, Model } from "mongoose";

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// Đồng bộ với WindowEvent trong agent.types.ts phía Agent client.
// HistoryEvent đã được loại bỏ khỏi Agent — không lưu ở đây.
// -----------------------------------------------------------------------------

/**
 * IWindowEvent — một cửa sổ đang active được Agent thu thập.
 * Lưu vào collection `windowevents`.
 */
export interface IWindowEvent extends Document {
  /** Thiết bị gửi event này */
  deviceId: mongoose.Types.ObjectId; // ref: 'Device'

  /** Phụ huynh sở hữu (denormalized để Dashboard query 1 hop) */
  ownerId: mongoose.Types.ObjectId; // ref: 'User'

  /** Thời điểm Agent thu thập (ISO 8601 từ Agent, convert sang Date) */
  timestamp: Date;

  /** Title bar của cửa sổ (vd: "YouTube - Google Chrome") */
  title: string;

  /** Tên tiến trình (vd: "chrome.exe", "msedge.exe") */
  processName: string;

  /** Ngày thu thập dạng "YYYY-MM-DD" — dùng để group by day nhanh */
  dateKey: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type WindowEventModel = Model<IWindowEvent>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const windowEventSchema = new Schema<IWindowEvent, WindowEventModel>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: [true, "Device ID là bắt buộc"],
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID là bắt buộc"],
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, "Timestamp là bắt buộc"],
    },
    title: {
      type: String,
      required: [true, "Title là bắt buộc"],
      trim: true,
      maxlength: [500, "Title không được vượt quá 500 ký tự"],
    },
    processName: {
      type: String,
      required: [true, "Process name là bắt buộc"],
      trim: true,
      maxlength: [100, "Process name không được vượt quá 100 ký tự"],
    },
    dateKey: {
      type: String,
      required: [true, "Date key là bắt buộc"],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index compound cho Dashboard: xem lịch sử 1 thiết bị theo thời gian
windowEventSchema.index({ deviceId: 1, timestamp: -1 });

// Index cho biểu đồ thống kê: group by day
windowEventSchema.index({ deviceId: 1, dateKey: 1 });

// TTL Index: tự động xóa event cũ hơn 90 ngày
windowEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 90 * 24 * 3600 },
);

// -----------------------------------------------------------------------------
// 3. DATA TRANSFORM
// -----------------------------------------------------------------------------

windowEventSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 4. EXPORT
// -----------------------------------------------------------------------------

export const WindowEvent = mongoose.model<IWindowEvent, WindowEventModel>(
  "WindowEvent",
  windowEventSchema,
);
