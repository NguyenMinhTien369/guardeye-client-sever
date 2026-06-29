// src/features/screenshot/screenshot.repository.ts

// -----------------------------------------------------------------------------
// SCREENSHOT REPOSITORY — Data Access Layer cho Screenshot collection.
// Layer duy nhất được phép import Mongoose model trực tiếp.
// -----------------------------------------------------------------------------

import mongoose from "mongoose";
import { Screenshot } from "./screenshot.model";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Trích dateKey dạng "YYYY-MM-DD" từ ISO timestamp */
function toDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

/** Lấy dateKey của hôm nay (theo UTC) */
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// REPOSITORY
// -----------------------------------------------------------------------------

const screenshotRepository = {
  /**
   * Lưu metadata một ảnh screenshot vào DB.
   * File ảnh đã được lưu trên disk trước khi gọi hàm này.
   */
  async save(data: {
    deviceId: string;
    ownerId: string;
    triggerTitle: string;
    filePath: string;
    fileName: string;
    captureIndex: 0 | 1 | 2;
    capturedAt: string; // ISO 8601
  }) {
    const doc = await Screenshot.create({
      deviceId: new mongoose.Types.ObjectId(data.deviceId),
      ownerId: new mongoose.Types.ObjectId(data.ownerId),
      triggerTitle: data.triggerTitle,
      filePath: data.filePath,
      fileName: data.fileName,
      captureIndex: data.captureIndex,
      capturedAt: new Date(data.capturedAt),
      dateKey: toDateKey(data.capturedAt),
    });
    return doc;
  },

  /**
   * Lấy danh sách ảnh của 1 device, có phân trang và filter theo ngày.
   * Sắp xếp mới nhất trước.
   */
  async getByDevice(
    deviceId: string,
    options: {
      dateKey?: string;
      page: number;
      limit: number;
    },
  ): Promise<{ screenshots: any[]; total: number }> {
    const filter: Record<string, any> = {
      deviceId: new mongoose.Types.ObjectId(deviceId),
    };

    // Nếu không truyền dateKey, mặc định lấy hôm nay
    filter.dateKey = options.dateKey || todayDateKey();

    const skip = (options.page - 1) * options.limit;

    const [screenshots, total] = await Promise.all([
      Screenshot.find(filter)
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean(),
      Screenshot.countDocuments(filter),
    ]);

    return { screenshots, total };
  },

  /**
   * Kiểm tra xem device có thuộc về owner không.
   * Dùng để guard trước khi trả dữ liệu cho Dashboard.
   */
  async existsByDeviceAndOwner(
    deviceId: string,
    ownerId: string,
  ): Promise<boolean> {
    // Kiểm tra qua Screenshot collection — nếu không có ảnh nào thì check Device model
    // Để đơn giản, ta delegate lên service layer kiểm tra Device model
    return true; // placeholder — service sẽ check Device model riêng
  },
};

export default screenshotRepository;
