// test/agent/agent.controller.test.ts

// -----------------------------------------------------------------------------
// Agent Controller tests — kiểm tra tầng HTTP: nhận request, gọi Service,
// trả response. Không gọi DB — agentService được mock hoàn toàn.
// -----------------------------------------------------------------------------

// Phải mock trước khi import module cần test
jest.mock("../../src/features/agent/agent.service");

import { Request, Response, NextFunction } from "express";
import {
  sync,
  getStatus,
} from "../../src/features/agent/agent.controller";
import agentService from "../../src/features/agent/agent.service";
import { BadRequestError, AuthFailureError } from "../../src/shared/core/error.response";
import { SyncRequestDto } from "../../src/features/agent/agent.dto";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockService = agentService as jest.Mocked<typeof agentService>;

// -----------------------------------------------------------------------------
// MOCK FACTORY
// -----------------------------------------------------------------------------

function buildMockRes(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

function buildMockReq(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any = {},
  extras: Record<string, unknown> = {}
): Partial<Request> {
  return {
    body,
    headers: {},
    query: {},
    ...extras,
  } as Partial<Request>;
}

// -----------------------------------------------------------------------------
// BUILDERS — mock data
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

function buildSyncBody(): SyncRequestDto {
  const events = [buildWindowEventDto()];
  return {
    deviceToken: "device-token-abc-123",
    sentAt: "2025-01-01T10:00:00.000Z",
    eventCount: events.length,
    events,
  };
}

function buildSyncServiceResponse(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    savedCount: 1,
    windowCount: 1,
    historyCount: 0,
    message: "Đồng bộ thành công",
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE: AgentController
// =============================================================================

describe("AgentController", () => {
  let res: jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/agent/sync — sync handler
  // ---------------------------------------------------------------------------

  describe("sync", () => {
    it("should respond with 200 and savedCount when sync is successful", async () => {
      // Arrange
      const serviceResult = buildSyncServiceResponse();
      mockService.syncEvents.mockResolvedValue(serviceResult);
      const req = buildMockReq(buildSyncBody(), {
        device: { _id: { toString: () => "device_001" } },
        ownerId: "owner_001",
      });

      // Act
      await sync(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ savedCount: 1 }),
        })
      );
    });

    it("should call agentService.syncEvents with the correct deviceId and ownerId", async () => {
      // Arrange
      mockService.syncEvents.mockResolvedValue(buildSyncServiceResponse());
      const req = buildMockReq(buildSyncBody(), {
        device: { _id: { toString: () => "device_001" } },
        ownerId: "owner_001",
      });

      // Act
      await sync(req as Request, res, next);

      // Assert
      expect(mockService.syncEvents).toHaveBeenCalledWith(
        req.body,
        "device_001",
        "owner_001"
      );
    });

    it("should call next with BadRequestError when syncEvents throws", async () => {
      // Arrange
      mockService.syncEvents.mockRejectedValue(new Error("Lỗi lưu event"));
      const req = buildMockReq(buildSyncBody(), {
        device: { _id: { toString: () => "device_001" } },
        ownerId: "owner_001",
      });

      // Act
      await sync(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it("should not call res.json when an error occurs", async () => {
      // Arrange
      mockService.syncEvents.mockRejectedValue(new Error("Lỗi ngẫu nhiên"));
      const req = buildMockReq(buildSyncBody(), {
        device: { _id: { toString: () => "device_001" } },
        ownerId: "owner_001",
      });

      // Act
      await sync(req as Request, res, next);

      // Assert
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should respond with success:true in the body when sync succeeds", async () => {
      // Arrange
      mockService.syncEvents.mockResolvedValue(buildSyncServiceResponse());
      const req = buildMockReq(buildSyncBody(), {
        device: { _id: { toString: () => "device_001" } },
        ownerId: "owner_001",
      });

      // Act
      await sync(req as Request, res, next);

      // Assert
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/agent/status — getStatus handler
  // ---------------------------------------------------------------------------

  describe("getStatus", () => {
    it("should respond with 200 and paused:false when device is not paused", async () => {
      // Arrange
      mockService.getAgentStatus.mockResolvedValue({
        paused: false,
      });
      const req = buildMockReq({}, {
        device: { _id: { toString: () => "device_001" } },
      });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ paused: false }),
        })
      );
    });

    it("should respond with 200 and paused:true with since and reason when device is paused", async () => {
      // Arrange
      const statusResponse = {
        paused: true,
        since: "2025-01-01T08:00:00.000Z",
        reason: "Giờ học tập",
      };
      mockService.getAgentStatus.mockResolvedValue(statusResponse);
      const req = buildMockReq({}, {
        device: { _id: { toString: () => "device_001" } },
      });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paused: true,
            since: "2025-01-01T08:00:00.000Z",
            reason: "Giờ học tập",
          }),
        })
      );
    });

    it("should call agentService.getAgentStatus with the correct deviceId", async () => {
      // Arrange
      mockService.getAgentStatus.mockResolvedValue({ paused: false });
      const req = buildMockReq({}, {
        device: { _id: { toString: () => "device_001" } },
      });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(mockService.getAgentStatus).toHaveBeenCalledWith("device_001");
    });

    it("should call next with BadRequestError when getAgentStatus throws", async () => {
      // Arrange
      mockService.getAgentStatus.mockRejectedValue(new Error("DB lỗi"));
      const req = buildMockReq({}, {
        device: { _id: { toString: () => "device_001" } },
      });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it("should call next with AuthFailureError when device is not attached to request", async () => {
      // Arrange — req.device không tồn tại (middleware bị bỏ qua)
      const req = buildMockReq({}, { device: undefined });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthFailureError));
      expect(mockService.getAgentStatus).not.toHaveBeenCalled();
    });

    it("should not call res.json when an error occurs", async () => {
      // Arrange
      mockService.getAgentStatus.mockRejectedValue(new Error("Lỗi"));
      const req = buildMockReq({}, {
        device: { _id: { toString: () => "device_001" } },
      });

      // Act
      await getStatus(req as Request, res, next);

      // Assert
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
