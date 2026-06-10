import mongoose, { Document, Schema, Model } from "mongoose";

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

// ── WindowEvent ────────────────────────────────────────────────────────────────

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

  /** Agent phát hiện cửa sổ đang ở chế độ ẩn danh dựa trên title */
  isIncognito: boolean;

  /** Ngày thu thập dạng "YYYY-MM-DD" — dùng để group by day nhanh */
  dateKey: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type WindowEventModel = Model<IWindowEvent>;

// ── HistoryEvent ───────────────────────────────────────────────────────────────

/**
 * IHistoryEvent — một URL trong lịch sử duyệt web của Chrome/Edge.
 * Lưu vào collection `historyevents`.
 */
export interface IHistoryEvent extends Document {
  /** Thiết bị gửi event này */
  deviceId: mongoose.Types.ObjectId; // ref: 'Device'

  /** Phụ huynh sở hữu (denormalized để Dashboard query 1 hop) */
  ownerId: mongoose.Types.ObjectId; // ref: 'User'

  /** Thời điểm Agent thu thập */
  timestamp: Date;

  /** URL đầy đủ (vd: "https://www.youtube.com/watch?v=abc") */
  url: string;

  /** Tiêu đề trang web */
  title: string;

  /** Trình duyệt ghi nhận URL này */
  browser: "chrome" | "edge" | "unknown";

  /** Thời điểm trình duyệt ghi nhận lượt truy cập (từ SQLite của browser) */
  visitTime: Date;

  /** Domain trích ra từ url — dùng để group "top sites" nhanh */
  domain: string;

  /** Ngày thu thập dạng "YYYY-MM-DD" */
  dateKey: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type HistoryEventModel = Model<IHistoryEvent>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

// ── WindowEvent Schema ─────────────────────────────────────────────────────────

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
    isIncognito: {
      type: Boolean,
      required: [true, "isIncognito là bắt buộc"],
      default: false,
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

// ── HistoryEvent Schema ────────────────────────────────────────────────────────

const historyEventSchema = new Schema<IHistoryEvent, HistoryEventModel>(
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
    url: {
      type: String,
      required: [true, "URL là bắt buộc"],
      trim: true,
      maxlength: [2048, "URL không được vượt quá 2048 ký tự"],
    },
    title: {
      type: String,
      required: [true, "Title là bắt buộc"],
      trim: true,
      maxlength: [500, "Title không được vượt quá 500 ký tự"],
    },
    browser: {
      type: String,
      enum: {
        values: ["chrome", "edge", "unknown"],
        message: "Browser phải là chrome, edge hoặc unknown",
      },
      required: [true, "Browser là bắt buộc"],
    },
    visitTime: {
      type: Date,
      required: [true, "Visit time là bắt buộc"],
    },
    domain: {
      type: String,
      required: [true, "Domain là bắt buộc"],
      trim: true,
      index: true,
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

// Index compound cho Dashboard: xem lịch sử 1 thiết bị theo visit time
historyEventSchema.index({ deviceId: 1, visitTime: -1 });

// Index cho "Top domain" query
historyEventSchema.index({ deviceId: 1, domain: 1 });

// TTL Index: tự động xóa event cũ hơn 90 ngày
historyEventSchema.index(
  { visitTime: 1 },
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

historyEventSchema.set("toJSON", {
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

export const HistoryEvent = mongoose.model<IHistoryEvent, HistoryEventModel>(
  "HistoryEvent",
  historyEventSchema,
);
