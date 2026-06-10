// test/devices/devices.controller.test.ts

// -----------------------------------------------------------------------------
// Mock dependency: devicesService — Controller chỉ gọi Service, không gọi DB
// -----------------------------------------------------------------------------

jest.mock("../../src/features/devices/devices.service");

import { Request, Response, NextFunction } from "express";
import {
  create,
  getAll,
  pause,
  resume,
  remove,
} from "../../src/features/devices/devices.controller";
import devicesService from "../../src/features/devices/devices.service";
import { DeviceStatus } from "../../src/features/devices/devices.model";
import {
  BadRequestError,
  NotFoundError,
} from "../../src/shared/core/error.response";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockService = devicesService as jest.Mocked<typeof devicesService>;

// -----------------------------------------------------------------------------
// MOCK FACTORY — Express req / res / next
// -----------------------------------------------------------------------------

function buildMockRes(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

function buildMockReq(
  body:   Record<string, unknown> = {},
  params: Record<string, string>  = {},
  user?:  { _id: { toString: () => string } }
): Partial<Request> {
  return { body, params, user: user as any };
}

// Mock parent user được gắn vào req.user bởi authenticate middleware
const mockParentUser = { _id: { toString: () => "parent_001" } };

// -----------------------------------------------------------------------------
// BUILDER — mock device response data
// -----------------------------------------------------------------------------

function buildDeviceResponse(overrides: Record<string, unknown> = {}) {
  const now = new Date("2024-01-01");
  return {
    id:             "device_001",
    childId:        "child_001",
    parentId:       "parent_001",
    deviceName:     "Laptop của Minh",
    monitoredUsers: ["MinhCup", "Guest"],
    status:         DeviceStatus.pending,
    isPaused:       false,
    pausedSince:    null,
    pausedUntil:    null,
    createdAt:      now,
    updatedAt:      now,
    ...overrides,
  };
}

function buildCreateDeviceResponse(overrides: Record<string, unknown> = {}) {
  return {
    deviceToken:    "test-uuid-1234-5678-abcd-ef0123456789",
    monitoredUsers: ["MinhCup", "Guest"],
    device:         buildDeviceResponse(),
    message:        "Đăng ký thiết bị thành công.",
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: DevicesController
// -----------------------------------------------------------------------------

describe("DevicesController", () => {
  let res:  jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res  = buildMockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // create — POST /children/:childId/devices
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const createBody = {
      deviceName:     "Laptop của Minh",
      monitoredUsers: ["MinhCup", "Guest"],
    };

    it("should respond with 201 when device is created successfully", async () => {
      // Arrange
      mockService.create.mockResolvedValue(buildCreateDeviceResponse() as any);
      const req = buildMockReq(createBody, { childId: "child_001" }, mockParentUser);

      // Act
      await create(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should include deviceToken and monitoredUsers in response body for agent setup", async () => {
      // Arrange
      const serviceResult = buildCreateDeviceResponse();
      mockService.create.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(createBody, { childId: "child_001" }, mockParentUser);

      // Act
      await create(req as any, res, next);

      // Assert — response data phải chứa 2 thông tin để copy vào agent
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceToken:    "test-uuid-1234-5678-abcd-ef0123456789",
            monitoredUsers: ["MinhCup", "Guest"],
          }),
        })
      );
    });

    it("should call devicesService.create with parentId from JWT, childId from URL param, and body data", async () => {
      // Arrange
      mockService.create.mockResolvedValue(buildCreateDeviceResponse() as any);
      const req = buildMockReq(createBody, { childId: "child_001" }, mockParentUser);

      // Act
      await create(req as any, res, next);

      // Assert — childId đến từ URL, parentId từ JWT, không phải từ body
      expect(mockService.create).toHaveBeenCalledWith(
        "parent_001",    // parentId từ JWT
        "child_001",     // childId từ URL param
        expect.objectContaining({
          deviceName:     "Laptop của Minh",
          monitoredUsers: ["MinhCup", "Guest"],
        })
      );
    });

    it("should call next with BadRequestError when child already has a device", async () => {
      // Arrange
      mockService.create.mockRejectedValue(
        new Error("Trẻ này đã có thiết bị được đăng ký. Mỗi trẻ chỉ có thể gắn một thiết bị.")
      );
      const req = buildMockReq(createBody, { childId: "child_001" }, mockParentUser);

      // Act
      await create(req as any, res, next);

      // Assert — vi phạm ràng buộc 1-1 phải trả 400
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it("should call next with BadRequestError when service throws a generic error", async () => {
      // Arrange
      mockService.create.mockRejectedValue(new Error("Đăng ký thiết bị thất bại"));
      const req = buildMockReq(createBody, { childId: "child_001" }, mockParentUser);

      // Act
      await create(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it("should not call service when called without parentId in req.user", async () => {
      // Arrange — req.user không tồn tại (chưa qua authenticate middleware)
      const req = buildMockReq(createBody, { childId: "child_001" });

      // Act — sẽ throw vì req.user! là undefined
      await create(req as any, res, next);

      // Assert — phải đến next chứ không trả về response thành công
      expect(res.status).not.toHaveBeenCalledWith(201);
    });
  });

  // ---------------------------------------------------------------------------
  // getAll — GET /devices
  // ---------------------------------------------------------------------------

  describe("getAll", () => {
    it("should respond with 200 and a list of devices belonging to the parent", async () => {
      // Arrange
      const serviceResult = [buildDeviceResponse(), buildDeviceResponse({ id: "device_002" })];
      mockService.getAll.mockResolvedValue(serviceResult as any);
      const req = buildMockReq({}, {}, mockParentUser);

      // Act
      await getAll(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should respond with 200 and empty array when parent has no devices", async () => {
      // Arrange
      mockService.getAll.mockResolvedValue([]);
      const req = buildMockReq({}, {}, mockParentUser);

      // Act
      await getAll(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should call devicesService.getAll with parentId from JWT", async () => {
      // Arrange
      mockService.getAll.mockResolvedValue([]);
      const req = buildMockReq({}, {}, mockParentUser);

      // Act
      await getAll(req as Request, res, next);

      // Assert
      expect(mockService.getAll).toHaveBeenCalledWith("parent_001");
    });

    it("should call next when service throws an unexpected error", async () => {
      // Arrange
      mockService.getAll.mockRejectedValue(new Error("DB error"));
      const req = buildMockReq({}, {}, mockParentUser);

      // Act
      await getAll(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // pause — PATCH /devices/:id/pause
  // ---------------------------------------------------------------------------

  describe("pause", () => {
    it("should respond with 200 when device is paused indefinitely (no pausedUntil)", async () => {
      // Arrange — không truyền pausedUntil = pause vô thời hạn
      const serviceResult = {
        device:  buildDeviceResponse({ isPaused: true, pausedSince: new Date(), pausedUntil: null }),
        message: "Thiết bị đã được tạm dừng.",
      };
      mockService.pause.mockResolvedValue(serviceResult as any);
      const req = buildMockReq({}, { id: "device_001" }, mockParentUser);

      // Act
      await pause(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should respond with 200 when device is paused until a specific time", async () => {
      // Arrange — truyền pausedUntil = tự động resume sau X phút
      const pauseBody = { pausedUntil: "2026-12-31T23:59:00.000Z" };
      const serviceResult = {
        device:  buildDeviceResponse({
          isPaused:    true,
          pausedSince: new Date(),
          pausedUntil: new Date("2026-12-31T23:59:00.000Z"),
        }),
        message: "Thiết bị đã được tạm dừng.",
      };
      mockService.pause.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(pauseBody, { id: "device_001" }, mockParentUser);

      // Act
      await pause(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should call devicesService.pause with deviceId, parentId, and pauseBody", async () => {
      // Arrange
      const pauseBody = { pausedUntil: "2026-12-31T23:59:00.000Z" };
      mockService.pause.mockResolvedValue({
        device:  buildDeviceResponse({ isPaused: true }),
        message: "Tạm dừng thành công.",
      } as any);
      const req = buildMockReq(pauseBody, { id: "device_001" }, mockParentUser);

      // Act
      await pause(req as any, res, next);

      // Assert
      expect(mockService.pause).toHaveBeenCalledWith(
        "device_001",
        "parent_001",
        expect.objectContaining({ pausedUntil: "2026-12-31T23:59:00.000Z" })
      );
    });

    it("should call next with NotFoundError when device does not exist or does not belong to parent", async () => {
      // Arrange
      mockService.pause.mockRejectedValue(new Error("Không tìm thấy thiết bị"));
      const req = buildMockReq({}, { id: "nonexistent_device" }, mockParentUser);

      // Act
      await pause(req as any, res, next);

      // Assert — không tìm thấy thiết bị phải trả 404
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  // ---------------------------------------------------------------------------
  // resume — PATCH /devices/:id/resume
  // ---------------------------------------------------------------------------

  describe("resume", () => {
    it("should respond with 200 when device is resumed successfully", async () => {
      // Arrange
      const serviceResult = {
        device:  buildDeviceResponse({ isPaused: false, pausedSince: null, pausedUntil: null }),
        message: "Thiết bị đã được tiếp tục giám sát.",
      };
      mockService.resume.mockResolvedValue(serviceResult as any);
      const req = buildMockReq({}, { id: "device_001" }, mockParentUser);

      // Act
      await resume(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call devicesService.resume with deviceId and parentId", async () => {
      // Arrange
      mockService.resume.mockResolvedValue({
        device:  buildDeviceResponse({ isPaused: false }),
        message: "Resume thành công.",
      } as any);
      const req = buildMockReq({}, { id: "device_001" }, mockParentUser);

      // Act
      await resume(req as any, res, next);

      // Assert
      expect(mockService.resume).toHaveBeenCalledWith("device_001", "parent_001");
    });

    it("should call next with NotFoundError when device does not exist for resume", async () => {
      // Arrange
      mockService.resume.mockRejectedValue(new Error("Không tìm thấy thiết bị"));
      const req = buildMockReq({}, { id: "nonexistent_device" }, mockParentUser);

      // Act
      await resume(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  // ---------------------------------------------------------------------------
  // remove — DELETE /devices/:id
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("should respond with 200 when device is deleted successfully", async () => {
      // Arrange
      mockService.remove.mockResolvedValue(undefined as any);
      const req = buildMockReq({}, { id: "device_001" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call devicesService.remove with correct deviceId and parentId", async () => {
      // Arrange
      mockService.remove.mockResolvedValue(undefined as any);
      const req = buildMockReq({}, { id: "device_001" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(mockService.remove).toHaveBeenCalledWith("device_001", "parent_001");
    });

    it("should call next with NotFoundError when device does not exist for deletion", async () => {
      // Arrange
      mockService.remove.mockRejectedValue(new Error("Không tìm thấy thiết bị để xóa"));
      const req = buildMockReq({}, { id: "nonexistent_device" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });
});
