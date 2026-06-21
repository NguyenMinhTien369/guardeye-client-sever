// src/features/agent/agent.service.ts

// -----------------------------------------------------------------------------
// AGENT SERVICE — business logic cho sync events và get agent status.
// Ủy thác lưu DB cho Repository.
// HistoryEvent đã được loại bỏ khỏi Agent — chỉ xử lý WindowEvent.
// -----------------------------------------------------------------------------

import agentRepository from "./agent.repository";
import {
  SyncRequestDto,
  WindowEventDto,
  SyncResponseDto,
  AgentStatusResponseDto,
} from "./agent.dto";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Lọc ra window events từ mảng event (type guard) */
function filterWindowEvents(events: SyncRequestDto["events"]): WindowEventDto[] {
  return events.filter((e): e is WindowEventDto => e.type === "window");
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

const agentService = {
  /**
   * Xử lý batch sync events từ Agent.
   * Chỉ có WindowEvent — lưu qua Repository → trả SyncResponseDto.
   */
  async syncEvents(
    dto: SyncRequestDto,
    deviceId: string,
    ownerId: string,
  ): Promise<SyncResponseDto> {
    const windowEvents = filterWindowEvents(dto.events);

    const savedCount =
      windowEvents.length > 0
        ? await agentRepository.bulkInsertWindowEvents(windowEvents, deviceId, ownerId)
        : 0;

    return {
      success: true,
      savedCount,
      message: `Đồng bộ thành công: đã lưu ${savedCount} sự kiện`,
    };
  },

  /**
   * Lấy trạng thái pause hiện tại của thiết bị để Agent biết có nên
   * dừng thu thập dữ liệu hay không.
   */
  async getAgentStatus(deviceId: string): Promise<AgentStatusResponseDto> {
    const status = await agentRepository.getDevicePauseStatus(deviceId);
    return status;
  },
};

export default agentService;
