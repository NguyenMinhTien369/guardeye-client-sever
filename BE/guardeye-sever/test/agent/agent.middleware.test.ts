// test/agent/agent.middleware.test.ts

// -----------------------------------------------------------------------------
// Agent Middleware tests — kiểm tra middleware xác thực X-Device-Token.
// Không gọi DB thật — toàn bộ dependency đều được mock.
// -----------------------------------------------------------------------------

// Phải mock trước khi import module cần test
jest.mock("../../src/features/devices/devices.model");

import { Request, Response, NextFunction } from "express";
import { verifyDeviceToken } from "../../src/features/agent/agent.middleware";
import Device from "../../src/features/devices/devices.model";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockDeviceModel = Device as jest.Mocked<typeof Device>; // eslint-disable-line @typescript-eslint/no-explicit-any

// -----------------------------------------------------------------------------
// MOCK FACTORY
// -----------------------------------------------------------------------------

function buildMockRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function buildMockReq(
  headers: Record<string, string> = {},
  query: Record<string, string> = {}
): Partial<Request> {
  return {
    headers: { ...headers },
    query: { ...query },
  } as Partial<Request>;
}

function buildMockDevice(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "device_001" },
    deviceToken: "valid-device-token-xyz",
    parentId: { toString: () => "owner_001" },
    status: "active",
    isPaused: false,
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE: verifyDeviceToken middleware
// =============================================================================

describe("verifyDeviceToken", () => {
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // Token resolution — Header vs Query param
  // ---------------------------------------------------------------------------

  describe("token resolution", () => {
    it("should read deviceToken from X-Device-Token header", async () => {
      // Arrange
      const mockDevice = buildMockDevice();
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(mockDevice);
      const req = buildMockReq({ "x-device-token": "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(mockDeviceModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deviceToken: "valid-device-token-xyz" })
      );
    });

    it("should fall back to deviceToken query param when header is absent", async () => {
      // Arrange
      const mockDevice = buildMockDevice();
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(mockDevice);
      const req = buildMockReq({}, { deviceToken: "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(mockDeviceModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deviceToken: "valid-device-token-xyz" })
      );
    });

    it("should prefer X-Device-Token header over query param when both are present", async () => {
      // Arrange
      const mockDevice = buildMockDevice({
        deviceToken: "header-token",
      });
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(mockDevice);
      const req = buildMockReq(
        { "x-device-token": "header-token" },
        { deviceToken: "query-token" }
      );

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(mockDeviceModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deviceToken: "header-token" })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // No token provided
  // ---------------------------------------------------------------------------

  describe("when no device token is provided", () => {
    it("should respond with 401 when neither header nor query param contains token", async () => {
      // Arrange
      const req = buildMockReq();

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should not call Device.findOne when token is missing", async () => {
      // Arrange
      mockDeviceModel.findOne = jest.fn();
      const req = buildMockReq();

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(mockDeviceModel.findOne).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Device not found
  // ---------------------------------------------------------------------------

  describe("when device token does not match any device", () => {
    it("should respond with 401 when token is not found in the database", async () => {
      // Arrange
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(null);
      const req = buildMockReq({ "x-device-token": "unknown-token" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Device inactive
  // ---------------------------------------------------------------------------

  describe("when device is inactive", () => {
    it("should respond with 403 when device exists but isActive is false", async () => {
      // Arrange
      mockDeviceModel.findOne = jest
        .fn()
        .mockResolvedValue(buildMockDevice({ status: "inactive" }));
      const req = buildMockReq({ "x-device-token": "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  describe("when device token is valid and device is active", () => {
    it("should call next() to pass control to the next handler", async () => {
      // Arrange
      mockDeviceModel.findOne = jest
        .fn()
        .mockResolvedValue(buildMockDevice());
      const req = buildMockReq({ "x-device-token": "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should attach the resolved device object to req.device", async () => {
      // Arrange
      const mockDevice = buildMockDevice();
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(mockDevice);
      const req = buildMockReq({ "x-device-token": "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect((req as any).device).toEqual(mockDevice);
    });

    it("should attach ownerId from device to req.ownerId", async () => {
      // Arrange
      const mockDevice = buildMockDevice();
      mockDeviceModel.findOne = jest.fn().mockResolvedValue(mockDevice);
      const req = buildMockReq({ "x-device-token": "valid-device-token-xyz" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect((req as any).ownerId).toBe("owner_001");
    });
  });

  // ---------------------------------------------------------------------------
  // Unexpected errors
  // ---------------------------------------------------------------------------

  describe("when an unexpected error occurs", () => {
    it("should respond with 500 when Device.findOne throws an error", async () => {
      // Arrange
      mockDeviceModel.findOne = jest
        .fn()
        .mockRejectedValue(new Error("DB connection timeout"));
      const req = buildMockReq({ "x-device-token": "some-token" });

      // Act
      await verifyDeviceToken(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
