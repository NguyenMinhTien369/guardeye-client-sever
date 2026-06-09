// test/devices/devices.service.test.ts

// -----------------------------------------------------------------------------
// Mock các dependency TRƯỚC KHI import module cần test
// Thứ tự này bắt buộc: Jest hoist jest.mock() lên đầu file
// -----------------------------------------------------------------------------

jest.mock("../../src/features/devices/devices.repository");

// Mock module crypto để kiểm soát UUID được sinh ra
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-1234-5678-abcd-ef0123456789"),
}));

// Mock fs để không ghi file thật vào disk trong unit test
jest.mock("fs", () => ({
  existsSync:    jest.fn(() => false),
  readFileSync:  jest.fn(() => "{}"),
  writeFileSync: jest.fn(),
}));

// Mock path để đường dẫn không phụ thuộc OS
jest.mock("path", () => ({
  resolve: jest.fn(() => "/mocked/path/to/agent/config.json"),
}));

import devicesService from "../../src/features/devices/devices.service";
import devicesRepository from "../../src/features/devices/devices.repository";
import { DeviceStatus } from "../../src/features/devices/devices.model";
import * as fs from "fs";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockRepo = devicesRepository as jest.Mocked<typeof devicesRepository>;

// -----------------------------------------------------------------------------
// BUILDER — tạo mock IDevice object tái sử dụng được
// -----------------------------------------------------------------------------

function buildMockDevice(overrides: Record<string, unknown> = {}) {
  const now = new Date("2024-01-01");
  return {
    _id:            { toString: () => "device_001" },
    id:             "device_001",
    childId:        { toString: () => "child_001" },
    parentId:       { toString: () => "parent_001" },
    deviceName:     "Laptop của Minh",
    monitoredUsers: ["MinhCup", "Guest"],
    status:         DeviceStatus.pending,
    isPaused:       false,
    pausedSince:    null,
    pausedUntil:    null,
    createdAt:      now,
    updatedAt:      now,
    toJSON: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: DevicesService
// -----------------------------------------------------------------------------

describe("DevicesService", () => {
  const parentId = "parent_001";
  const childId  = "child_001";
  const deviceId = "device_001";

  beforeEach(() => {
    jest.clearAllMocks();
    // Mặc định NODE_ENV là 'test' — writeAgentConfig sẽ chạy nhưng fs đã bị mock
    process.env.NODE_ENV = "test";
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const validDto = {
      deviceName:     "Laptop của Minh",
      monitoredUsers: ["MinhCup", "Guest"],
    };

    it("should return deviceToken and monitoredUsers in response when device is created successfully", async () => {
      // Arrange
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null); // Chưa có thiết bị nào với childId này
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      const result = await devicesService.create(parentId, childId, validDto);

      // Assert — response phải chứa deviceToken (lần duy nhất) và monitoredUsers
      expect(result.deviceToken).toBeDefined();
      expect(result.monitoredUsers).toEqual(["MinhCup", "Guest"]);
    });

    it("should return a UUID as deviceToken — server generates it, not client", async () => {
      // Arrange
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      const result = await devicesService.create(parentId, childId, validDto);

      // Assert — token phải là UUID được server sinh, không phải do client truyền vào
      expect(result.deviceToken).toBe("test-uuid-1234-5678-abcd-ef0123456789");
    });

    it("should return device data without deviceToken in the nested device object", async () => {
      // Arrange
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      const result = await devicesService.create(parentId, childId, validDto);

      // Assert — DeviceResponseDto bên trong không bao giờ chứa token
      expect((result.device as any).deviceToken).toBeUndefined();
      expect(result.device.id).toBe("device_001");
      expect(result.device.status).toBe(DeviceStatus.pending);
    });

    it("should call repository.create with parentId, childId, UUID token and dto data", async () => {
      // Arrange
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      await devicesService.create(parentId, childId, validDto);

      // Assert — service phải truyền token mà nó tự sinh vào repo
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId,
          childId,
          deviceToken:    "test-uuid-1234-5678-abcd-ef0123456789",
          deviceName:     "Laptop của Minh",
          monitoredUsers: ["MinhCup", "Guest"],
        })
      );
    });

    it("should call repository.findByChildId to validate 1-1 relationship before creating", async () => {
      // Arrange
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(buildMockDevice() as any);

      // Act
      await devicesService.create(parentId, childId, validDto);

      // Assert — phải kiểm tra trước xem childId đã có device chưa
      expect(mockRepo.findByChildId).toHaveBeenCalledWith(childId);
    });

    it("should throw an error when child already has a device (1-1 constraint)", async () => {
      // Arrange
      const existingDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(existingDevice as any); // Đã có thiết bị

      // Act & Assert — phải reject với thông báo rõ ràng về ràng buộc 1-1
      await expect(
        devicesService.create(parentId, childId, validDto)
      ).rejects.toThrow();
    });

    it("should write deviceToken and monitoredUsers to agent config.json in non-production environment", async () => {
      // Arrange
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      await devicesService.create(parentId, childId, validDto);

      // Assert — fs.writeFileSync phải được gọi để ghi config.json
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);
      expect(writtenContent.deviceToken).toBe("test-uuid-1234-5678-abcd-ef0123456789");
      expect(writtenContent.monitoredUsers).toEqual(["MinhCup", "Guest"]);
    });

    it("should NOT write to config.json in production environment", async () => {
      // Arrange
      process.env.NODE_ENV = "production";
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act
      await devicesService.create(parentId, childId, validDto);

      // Assert — không bao giờ ghi file thật trong production
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should not fail even if config.json write throws an error", async () => {
      // Arrange
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("Permission denied");
      });
      const createdDevice = buildMockDevice();
      mockRepo.findByChildId.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createdDevice as any);

      // Act & Assert — lỗi ghi file không được làm fail toàn bộ request
      await expect(
        devicesService.create(parentId, childId, validDto)
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------

  describe("getAll", () => {
    it("should return a list of devices belonging to the parent", async () => {
      // Arrange
      const devices = [buildMockDevice(), buildMockDevice({ _id: { toString: () => "device_002" } })];
      mockRepo.findAllByParent.mockResolvedValue(devices as any);

      // Act
      const result = await devicesService.getAll(parentId);

      // Assert
      expect(result).toHaveLength(2);
    });

    it("should return an empty array when parent has no devices", async () => {
      // Arrange
      mockRepo.findAllByParent.mockResolvedValue([]);

      // Act
      const result = await devicesService.getAll(parentId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should call repository.findAllByParent with the correct parentId", async () => {
      // Arrange
      mockRepo.findAllByParent.mockResolvedValue([]);

      // Act
      await devicesService.getAll(parentId);

      // Assert
      expect(mockRepo.findAllByParent).toHaveBeenCalledWith(parentId);
    });

    it("should never include deviceToken in any returned device", async () => {
      // Arrange
      const devices = [buildMockDevice({ deviceToken: "secret-token" })];
      mockRepo.findAllByParent.mockResolvedValue(devices as any);

      // Act
      const result = await devicesService.getAll(parentId);

      // Assert — token phải luôn bị lọc ra khỏi response
      result.forEach((device) => {
        expect((device as any).deviceToken).toBeUndefined();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // pause
  // ---------------------------------------------------------------------------

  describe("pause", () => {
    it("should set isPaused to true and record pausedSince when pausing indefinitely", async () => {
      // Arrange
      const pausedDevice = buildMockDevice({
        isPaused:    true,
        pausedSince: new Date(),
        pausedUntil: null, // Vô thời hạn — không có deadline
      });
      mockRepo.findByIdAndParent.mockResolvedValue(buildMockDevice() as any);
      mockRepo.pauseDevice.mockResolvedValue(pausedDevice as any);

      // Act
      const result = await devicesService.pause(deviceId, parentId, {});

      // Assert — isPaused bật, không có deadline
      expect(result.device.isPaused).toBe(true);
      expect(result.device.pausedUntil).toBeNull();
    });

    it("should set pausedUntil when parent pauses for a specific duration", async () => {
      // Arrange
      const futureDate = new Date("2026-12-31T23:59:00.000Z");
      const pausedDevice = buildMockDevice({
        isPaused:    true,
        pausedSince: new Date(),
        pausedUntil: futureDate, // Tự động resume lúc này
      });
      mockRepo.findByIdAndParent.mockResolvedValue(buildMockDevice() as any);
      mockRepo.pauseDevice.mockResolvedValue(pausedDevice as any);

      // Act
      const result = await devicesService.pause(deviceId, parentId, {
        pausedUntil: "2026-12-31T23:59:00.000Z",
      });

      // Assert — có deadline, agent sẽ tự resume
      expect(result.device.isPaused).toBe(true);
      expect(result.device.pausedUntil).toEqual(futureDate);
    });

    it("should throw an error when device is not found or does not belong to parent", async () => {
      // Arrange
      mockRepo.findByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        devicesService.pause("nonexistent_device", parentId, {})
      ).rejects.toThrow();
    });

    it("should call repository.findByIdAndParent to verify ownership before pausing", async () => {
      // Arrange
      mockRepo.findByIdAndParent.mockResolvedValue(buildMockDevice() as any);
      mockRepo.pauseDevice.mockResolvedValue(buildMockDevice({ isPaused: true }) as any);

      // Act
      await devicesService.pause(deviceId, parentId, {});

      // Assert — phải kiểm tra ownership trước khi cho phép pause
      expect(mockRepo.findByIdAndParent).toHaveBeenCalledWith(deviceId, parentId);
    });
  });

  // ---------------------------------------------------------------------------
  // resume
  // ---------------------------------------------------------------------------

  describe("resume", () => {
    it("should set isPaused to false and clear pause timestamps when resuming", async () => {
      // Arrange
      const resumedDevice = buildMockDevice({
        isPaused:    false,
        pausedSince: null,
        pausedUntil: null,
      });
      mockRepo.findByIdAndParent.mockResolvedValue(buildMockDevice({ isPaused: true }) as any);
      mockRepo.resumeDevice.mockResolvedValue(resumedDevice as any);

      // Act
      const result = await devicesService.resume(deviceId, parentId);

      // Assert — tất cả trạng thái pause phải được reset
      expect(result.device.isPaused).toBe(false);
      expect(result.device.pausedSince).toBeNull();
      expect(result.device.pausedUntil).toBeNull();
    });

    it("should throw an error when device is not found or does not belong to parent", async () => {
      // Arrange
      mockRepo.findByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        devicesService.resume("nonexistent_device", parentId)
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("should complete without error when device is deleted successfully", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(buildMockDevice() as any);

      // Act & Assert
      await expect(
        devicesService.remove(deviceId, parentId)
      ).resolves.not.toThrow();
    });

    it("should throw an error when device is not found for deletion", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        devicesService.remove("nonexistent_device", parentId)
      ).rejects.toThrow();
    });

    it("should call repository.deleteByIdAndParent with correct deviceId and parentId", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(buildMockDevice() as any);

      // Act
      await devicesService.remove(deviceId, parentId);

      // Assert
      expect(mockRepo.deleteByIdAndParent).toHaveBeenCalledWith(deviceId, parentId);
    });
  });
});
