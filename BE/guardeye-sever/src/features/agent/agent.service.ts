// src/features/agent/agent.service.ts

// -----------------------------------------------------------------------------
// AGENT SERVICE — business logic cho sync events và get agent status.
// Phân loại events theo type, ủy thác lưu DB cho Repository.
// -----------------------------------------------------------------------------

import agentRepository from "./agent.repository";
import {
  SyncRequestDto,
  AgentEventDto,
  WindowEventDto,
  HistoryEventDto,
  SyncResponseDto,
  AgentStatusResponseDto,
} from "./agent.dto";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/** Lọc ra window events từ mảng event hỗn hợp */
function filterWindowEvents(events: AgentEventDto[]): WindowEventDto[] {
  return events.filter((e): e is WindowEventDto => e.type === "window");
}

/** Lọc ra history events từ mảng event hỗn hợp */
function filterHistoryEvents(events: AgentEventDto[]): HistoryEventDto[] {
  return events.filter((e): e is HistoryEventDto => e.type === "history");
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

const agentService = {
  /**
   * Xử lý batch sync events từ Agent.
   * Phân loại → lưu song song qua Repository → trả SyncResponseDto.
   */
  async syncEvents(
    dto: SyncRequestDto,
    deviceId: string,
    ownerId: string,
  ): Promise<SyncResponseDto> {
    const windowEvents = filterWindowEvents(dto.events);
    const historyEvents = filterHistoryEvents(dto.events);

    // Lưu song song — nếu một bên fail thì throw và caller xử lý
    const [windowCount, historyCount] = await Promise.all([
      windowEvents.length > 0
        ? agentRepository.bulkInsertWindowEvents(windowEvents, deviceId, ownerId)
        : Promise.resolve(0),
      historyEvents.length > 0
        ? agentRepository.bulkInsertHistoryEvents(historyEvents, deviceId, ownerId)
        : Promise.resolve(0),
    ]);

    const savedCount = windowCount + historyCount;

    return {
      success: true,
      savedCount,
      windowCount,
      historyCount,
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
