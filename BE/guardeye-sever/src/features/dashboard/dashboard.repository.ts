// src/features/dashboard/dashboard.repository.ts

// -----------------------------------------------------------------------------
// DASHBOARD REPOSITORY — Query WindowEvent để Dashboard FE hiển thị.
// Layer duy nhất được phép import Mongoose models trực tiếp.
// -----------------------------------------------------------------------------

import mongoose from "mongoose";
import { WindowEvent } from "../agent/agent.model";
import Device from "../devices/devices.model";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface GetActivityParams {
  dateKey?: string;
  page: number;
  limit: number;
}

export interface ActivityQueryResult {
  events: Array<{
    id: string;
    deviceId: string;
    timestamp: string;
    title: string;
    processName: string;
    dateKey: string;
  }>;
  total: number;
}

// -----------------------------------------------------------------------------
// REPOSITORY
// -----------------------------------------------------------------------------

const dashboardRepository = {
  /**
   * Kiểm tra device có thuộc về ownerId không.
   * Trả về true nếu hợp lệ, false nếu không tồn tại hoặc không có quyền.
   */
  async verifyDeviceOwnership(deviceId: string, ownerId: string): Promise<boolean> {
    const device = await Device.findById(deviceId).select("parentId");
    if (!device) return false;
    return device.parentId.toString() === ownerId;
  },

  /**
   * Lấy danh sách WindowEvent của 1 thiết bị, filter theo ngày.
   * Sort: mới nhất trước (timestamp: -1).
   */
  async getWindowEvents(
    deviceId: string,
    params: GetActivityParams,
  ): Promise<ActivityQueryResult> {
    const filter: Record<string, any> = {
      deviceId: new mongoose.Types.ObjectId(deviceId),
    };

    // Nếu có dateKey thì filter theo ngày, nếu không thì lấy hôm nay
    const dateKey = params.dateKey || new Date().toISOString().slice(0, 10);
    filter.dateKey = dateKey;

    const skip = (params.page - 1) * params.limit;

    const [events, total] = await Promise.all([
      WindowEvent.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(params.limit)
        .lean(),
      WindowEvent.countDocuments(filter),
    ]);

    return {
      events: events.map((e: any) => ({
        id: e._id.toString(),
        deviceId: e.deviceId.toString(),
        timestamp: e.timestamp.toISOString(),
        title: e.title,
        processName: e.processName,
        dateKey: e.dateKey,
      })),
      total,
    };
  },
};

export default dashboardRepository;
