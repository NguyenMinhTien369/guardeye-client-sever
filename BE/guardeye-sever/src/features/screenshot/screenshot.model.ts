// src/features/screenshot/screenshot.model.ts

// -----------------------------------------------------------------------------
// SCREENSHOT MODEL — Lưu metadata ảnh chụp màn hình từ Agent.
// File ảnh thực tế được lưu trên disk (uploads/screenshots/).
// -----------------------------------------------------------------------------

import mongoose, { Document, Schema, Model } from "mongoose";

// -----------------------------------------------------------------------------
// 1. INTERFACE
// -----------------------------------------------------------------------------

export interface IScreenshot extends Document {
  /** Thiết bị gửi ảnh lên */
  deviceId: mongoose.Types.ObjectId; // ref: 'Device'

  /** Phụ huynh sở hữu — denormalized để Dashboard query 1 hop */
  ownerId: mongoose.Types.ObjectId; // ref: 'User'

  /**
   * Tiêu đề cửa sổ trình duyệt tại thời điểm trigger.
   * VD: "YouTube - Google Chrome" → Agent biết đây là lúc user vừa navigate
   */
  triggerTitle: string;

  /** Đường dẫn tương đối file ảnh (VD: "screenshots/abc-123.jpg") */
  filePath: string;

  /** Tên file gốc để truy xuất nhanh */
  fileName: string;

  /** Thứ tự ảnh trong batch: 0 = chụp ngay, 1 = sau 3.3s, 2 = sau 6.6s */
  captureIndex: 0 | 1 | 2;

  /** ISO 8601 — thời điểm Agent thực sự chụp (từ phía Agent) */
  capturedAt: Date;

  /** Ngày dạng "YYYY-MM-DD" — dùng để filter nhanh trên Dashboard */
  dateKey: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type ScreenshotModel = Model<IScreenshot>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const screenshotSchema = new Schema<IScreenshot, ScreenshotModel>(
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
    triggerTitle: {
      type: String,
      required: [true, "Trigger title là bắt buộc"],
      trim: true,
      maxlength: [500, "Trigger title không được vượt quá 500 ký tự"],
    },
    filePath: {
      type: String,
      required: [true, "File path là bắt buộc"],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, "File name là bắt buộc"],
      trim: true,
    },
    captureIndex: {
      type: Number,
      enum: {
        values: [0, 1, 2],
        message: "captureIndex phải là 0, 1 hoặc 2",
      },
      required: [true, "captureIndex là bắt buộc"],
    },
    capturedAt: {
      type: Date,
      required: [true, "capturedAt là bắt buộc"],
    },
    dateKey: {
      type: String,
      required: [true, "dateKey là bắt buộc"],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────────

// Dashboard: xem ảnh của 1 device theo thời gian (mới nhất trước)
screenshotSchema.index({ deviceId: 1, capturedAt: -1 });

// Dashboard: filter ảnh theo ngày
screenshotSchema.index({ deviceId: 1, dateKey: 1 });

// TTL Index: tự động xóa metadata cũ hơn 90 ngày
// (Lưu ý: file vật lý trên disk cần cleanup riêng bằng cron job)
screenshotSchema.index(
  { capturedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 3600 },
);

// ── Data Transform ─────────────────────────────────────────────────────────────

screenshotSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 3. EXPORT
// -----------------------------------------------------------------------------

export const Screenshot = mongoose.model<IScreenshot, ScreenshotModel>(
  "Screenshot",
  screenshotSchema,
);
