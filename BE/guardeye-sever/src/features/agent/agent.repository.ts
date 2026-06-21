// src/features/agent/agent.repository.ts

// -----------------------------------------------------------------------------
// AGENT REPOSITORY — thao tác DB cho WindowEvent và Device status.
// Là layer duy nhất được phép import Mongoose models trực tiếp.
// HistoryEvent đã được loại bỏ khỏi Agent — không xử lý ở đây.
// -----------------------------------------------------------------------------

import mongoose from "mongoose";
import { WindowEvent } from "./agent.model";
import Device from "../devices/devices.model";
import { WindowEventDto } from "./agent.dto";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Trích dateKey dạng "YYYY-MM-DD" từ ISO timestamp */
function toDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

// -----------------------------------------------------------------------------
// REPOSITORY FUNCTIONS
// -----------------------------------------------------------------------------

const agentRepository = {
  /**
   * Lưu batch WindowEvent — bỏ qua bản ghi trùng lặp (ordered: false).
   * Trả về số document đã insert thành công.
   */
  async bulkInsertWindowEvents(
    events: WindowEventDto[],
    deviceId: string,
    ownerId: string,
  ): Promise<number> {
    if (events.length === 0) return 0;

    const docs = events.map((e) => ({
      deviceId: new mongoose.Types.ObjectId(deviceId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      timestamp: new Date(e.timestamp),
      title: e.title,
      processName: e.processName,
      dateKey: toDateKey(e.timestamp),
    }));

    const result = await WindowEvent.insertMany(docs, { ordered: false });
    return result.length;
  },

  /**
   * Lấy trạng thái pause hiện tại của device.
   * Trả về shape khớp với AgentStatusResponseDto.
   */
  async getDevicePauseStatus(deviceId: string): Promise<{
    paused: boolean;
    since?: string;
    reason?: string;
  }> {
    const device = await Device.findById(deviceId).select(
      "isPaused pausedSince",
    );

    if (!device) {
      return { paused: false };
    }

    return {
      paused: device.isPaused,
      since: device.pausedSince
        ? device.pausedSince.toISOString()
        : undefined,
      reason: undefined, // Hiện tại model chưa có trường reason
    };
  },
};

export default agentRepository;
