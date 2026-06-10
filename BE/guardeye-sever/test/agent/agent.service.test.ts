// test/agent/agent.service.test.ts

// -----------------------------------------------------------------------------
// Agent Service tests — kiểm tra business logic của AgentService.
// Toàn bộ Repository và Model đều được mock — không gọi DB thật.
// -----------------------------------------------------------------------------

// Phải mock trước khi import module cần test
jest.mock("../../src/features/agent/agent.repository");

import agentService from "../../src/features/agent/agent.service";
import agentRepository from "../../src/features/agent/agent.repository";
import { SyncRequestDto } from "../../src/features/agent/agent.dto";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockRepo = agentRepository as jest.Mocked<typeof agentRepository>;

// -----------------------------------------------------------------------------
// BUILDERS — dữ liệu test tái sử dụng
// -----------------------------------------------------------------------------

function buildWindowEventDto() {
  return {
    type: "window" as const,
    timestamp: "2025-01-01T10:00:00.000Z",
    title: "YouTube - Google Chrome",
    processName: "chrome.exe",
    isIncognito: false,
  };
}

function buildHistoryEventDto() {
  return {
    type: "history" as const,
    timestamp: "2025-01-01T10:00:00.000Z",
    url: "https://www.youtube.com/watch?v=abc",
    title: "YouTube",
    browser: "chrome" as const,
    visitTime: "2025-01-01T09:55:00.000Z",
  };
}

function buildSyncDto(overrides: Partial<SyncRequestDto> = {}): SyncRequestDto {
  const events = [buildWindowEventDto()];
  return {
    deviceToken: "device-token-abc-123",
    sentAt: "2025-01-01T10:00:00.000Z",
    eventCount: events.length,
    events,
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE: AgentService
// =============================================================================

describe("AgentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // syncEvents
  // ---------------------------------------------------------------------------

  describe("syncEvents", () => {
    const deviceId = "device_001";
    const ownerId = "owner_001";

    it("should return success response with savedCount equal to events.length when all events are saved", async () => {
      // Arrange
      const dto = buildSyncDto();
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(0);

      // Act
      const result = await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(1);
    });

    it("should separate window events and history events before inserting", async () => {
      // Arrange
      const dto = buildSyncDto({
        events: [buildWindowEventDto(), buildHistoryEventDto()],
        eventCount: 2,
      });
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(1);

      // Act
      await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(mockRepo.bulkInsertWindowEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "window" }),
        ]),
        deviceId,
        ownerId
      );
      expect(mockRepo.bulkInsertHistoryEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "history" }),
        ]),
        deviceId,
        ownerId
      );
    });

    it("should call bulkInsertWindowEvents with correct deviceId and ownerId", async () => {
      // Arrange
      const dto = buildSyncDto();
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(0);

      // Act
      await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(mockRepo.bulkInsertWindowEvents).toHaveBeenCalledWith(
        expect.any(Array),
        "device_001",
        "owner_001"
      );
    });

    it("should skip bulkInsertWindowEvents when there are no window events", async () => {
      // Arrange — chỉ có history event
      const dto = buildSyncDto({
        events: [buildHistoryEventDto()],
        eventCount: 1,
      });
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(1);

      // Act
      await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(mockRepo.bulkInsertWindowEvents).not.toHaveBeenCalled();
    });

    it("should skip bulkInsertHistoryEvents when there are no history events", async () => {
      // Arrange — chỉ có window event
      const dto = buildSyncDto();
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);

      // Act
      await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(mockRepo.bulkInsertHistoryEvents).not.toHaveBeenCalled();
    });

    it("should return windowCount and historyCount matching the saved events", async () => {
      // Arrange
      const dto = buildSyncDto({
        events: [buildWindowEventDto(), buildHistoryEventDto()],
        eventCount: 2,
      });
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(1);

      // Act
      const result = await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(result.windowCount).toBe(1);
      expect(result.historyCount).toBe(1);
    });

    it("should return savedCount equal to 0 when events array is empty", async () => {
      // Arrange
      const dto = buildSyncDto({ events: [], eventCount: 0 });

      // Act
      const result = await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(0);
    });

    it("should throw an error when repository bulkInsertWindowEvents rejects", async () => {
      // Arrange
      const dto = buildSyncDto();
      mockRepo.bulkInsertWindowEvents.mockRejectedValue(
        new Error("DB write error")
      );

      // Act & Assert
      await expect(
        agentService.syncEvents(dto, deviceId, ownerId)
      ).rejects.toThrow("DB write error");
    });

    it("should include a non-empty message in the success response", async () => {
      // Arrange
      const dto = buildSyncDto();
      mockRepo.bulkInsertWindowEvents.mockResolvedValue(1);
      mockRepo.bulkInsertHistoryEvents.mockResolvedValue(0);

      // Act
      const result = await agentService.syncEvents(dto, deviceId, ownerId);

      // Assert
      expect(typeof result.message).toBe("string");
      expect(result.message!.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentStatus
  // ---------------------------------------------------------------------------

  describe("getAgentStatus", () => {
    it("should return paused:false when device is not paused", async () => {
      // Arrange
      mockRepo.getDevicePauseStatus.mockResolvedValue({
        paused: false,
        since: undefined,
        reason: undefined,
      });

      // Act
      const result = await agentService.getAgentStatus("device_001");

      // Assert
      expect(result.paused).toBe(false);
    });

    it("should return paused:true with since and reason when device is paused", async () => {
      // Arrange
      const since = "2025-01-01T08:00:00.000Z";
      const reason = "Giờ học tập";
      mockRepo.getDevicePauseStatus.mockResolvedValue({
        paused: true,
        since,
        reason,
      });

      // Act
      const result = await agentService.getAgentStatus("device_001");

      // Assert
      expect(result.paused).toBe(true);
      expect(result.since).toBe(since);
      expect(result.reason).toBe(reason);
    });

    it("should return paused:true with undefined reason when reason is not set", async () => {
      // Arrange
      mockRepo.getDevicePauseStatus.mockResolvedValue({
        paused: true,
        since: "2025-01-01T08:00:00.000Z",
        reason: undefined,
      });

      // Act
      const result = await agentService.getAgentStatus("device_001");

      // Assert
      expect(result.paused).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should call getDevicePauseStatus with the correct deviceId", async () => {
      // Arrange
      mockRepo.getDevicePauseStatus.mockResolvedValue({ paused: false });

      // Act
      await agentService.getAgentStatus("device_001");

      // Assert
      expect(mockRepo.getDevicePauseStatus).toHaveBeenCalledWith("device_001");
    });

    it("should throw an error when repository getDevicePauseStatus rejects", async () => {
      // Arrange
      mockRepo.getDevicePauseStatus.mockRejectedValue(
        new Error("DB read error")
      );

      // Act & Assert
      await expect(
        agentService.getAgentStatus("device_001")
      ).rejects.toThrow("DB read error");
    });
  });
});
