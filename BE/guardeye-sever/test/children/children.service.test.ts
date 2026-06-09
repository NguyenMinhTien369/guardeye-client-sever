// test/children/children.service.test.ts

// -----------------------------------------------------------------------------
// Mock các dependency TRƯỚC KHI import module cần test
// Thứ tự này bắt buộc: Jest hoist jest.mock() lên đầu file
// -----------------------------------------------------------------------------

jest.mock("../../src/features/children/children.repository");

import childrenService from "../../src/features/children/children.service";
import childrenRepository from "../../src/features/children/children.repository";
import { GenderType } from "../../src/features/children/children.model";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockRepo = childrenRepository as jest.Mocked<typeof childrenRepository>;

// -----------------------------------------------------------------------------
// BUILDER — tạo mock IChild object tái sử dụng được
// -----------------------------------------------------------------------------

function buildMockChild(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "child_001" },
    id: "child_001",
    parentId: { toString: () => "parent_001" },
    name: "Nguyen Van An",
    age: 7,
    gender: "male",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    toJSON: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: ChildrenService
// -----------------------------------------------------------------------------

describe("ChildrenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const validDto = {
      name: "Nguyen Van An",
      age: 7,
      gender: GenderType.male,
    };
    const parentId = "parent_001";

    it("should return the created child when data is valid", async () => {
      // Arrange
      const createdChild = buildMockChild();
      mockRepo.create.mockResolvedValue(createdChild as any);

      // Act
      const result = await childrenService.create(parentId, validDto);

      // Assert
      expect(result.id).toBe("child_001");
      expect(result.name).toBe("Nguyen Van An");
    });

    it("should call repository.create with parentId and correct dto", async () => {
      // Arrange
      const createdChild = buildMockChild();
      mockRepo.create.mockResolvedValue(createdChild as any);

      // Act
      await childrenService.create(parentId, validDto);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId,
          name: validDto.name,
          age: validDto.age,
          gender: validDto.gender,
        })
      );
    });

    it("should throw an error when repository fails to create", async () => {
      // Arrange
      mockRepo.create.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(childrenService.create(parentId, validDto)).rejects.toThrow(
        "Database error"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------

  describe("getAll", () => {
    const parentId = "parent_001";

    it("should return a list of children for the given parent", async () => {
      // Arrange
      const children = [buildMockChild(), buildMockChild({ id: "child_002", name: "Le Thi Binh" })];
      mockRepo.findAllByParent.mockResolvedValue(children as any);

      // Act
      const result = await childrenService.getAll(parentId);

      // Assert
      expect(result).toHaveLength(2);
    });

    it("should return an empty array when parent has no children", async () => {
      // Arrange
      mockRepo.findAllByParent.mockResolvedValue([]);

      // Act
      const result = await childrenService.getAll(parentId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should call repository.findAllByParent with the correct parentId", async () => {
      // Arrange
      mockRepo.findAllByParent.mockResolvedValue([]);

      // Act
      await childrenService.getAll(parentId);

      // Assert
      expect(mockRepo.findAllByParent).toHaveBeenCalledWith(parentId);
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe("getById", () => {
    const childId = "child_001";
    const parentId = "parent_001";

    it("should return the child when found and belongs to the parent", async () => {
      // Arrange
      const child = buildMockChild();
      mockRepo.findByIdAndParent.mockResolvedValue(child as any);

      // Act
      const result = await childrenService.getById(childId, parentId);

      // Assert
      expect(result.id).toBe("child_001");
      expect(result.name).toBe("Nguyen Van An");
    });

    it("should throw an error when child is not found", async () => {
      // Arrange
      mockRepo.findByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        childrenService.getById("nonexistent_id", parentId)
      ).rejects.toThrow();
    });

    it("should call repository.findByIdAndParent with correct childId and parentId", async () => {
      // Arrange
      const child = buildMockChild();
      mockRepo.findByIdAndParent.mockResolvedValue(child as any);

      // Act
      await childrenService.getById(childId, parentId);

      // Assert
      expect(mockRepo.findByIdAndParent).toHaveBeenCalledWith(childId, parentId);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    const childId = "child_001";
    const parentId = "parent_001";
    const updateDto = { name: "Nguyen Van An Updated", age: 8 };

    it("should return the updated child when data is valid", async () => {
      // Arrange
      const updatedChild = buildMockChild({ name: "Nguyen Van An Updated", age: 8 });
      mockRepo.updateByIdAndParent.mockResolvedValue(updatedChild as any);

      // Act
      const result = await childrenService.update(childId, parentId, updateDto);

      // Assert
      expect(result.name).toBe("Nguyen Van An Updated");
      expect(result.age).toBe(8);
    });

    it("should throw an error when child is not found for update", async () => {
      // Arrange
      mockRepo.updateByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        childrenService.update("nonexistent_id", parentId, updateDto)
      ).rejects.toThrow();
    });

    it("should call repository.updateByIdAndParent with correct arguments", async () => {
      // Arrange
      const updatedChild = buildMockChild({ name: "Nguyen Van An Updated", age: 8 });
      mockRepo.updateByIdAndParent.mockResolvedValue(updatedChild as any);

      // Act
      await childrenService.update(childId, parentId, updateDto);

      // Assert
      expect(mockRepo.updateByIdAndParent).toHaveBeenCalledWith(
        childId,
        parentId,
        updateDto
      );
    });
  });

  // ---------------------------------------------------------------------------
  // remove (delete)
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    const childId = "child_001";
    const parentId = "parent_001";

    it("should complete without error when child is deleted successfully", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(buildMockChild() as any);

      // Act & Assert
      await expect(
        childrenService.remove(childId, parentId)
      ).resolves.not.toThrow();
    });

    it("should throw an error when child is not found for deletion", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(null);

      // Act & Assert
      await expect(
        childrenService.remove("nonexistent_id", parentId)
      ).rejects.toThrow();
    });

    it("should call repository.deleteByIdAndParent with correct childId and parentId", async () => {
      // Arrange
      mockRepo.deleteByIdAndParent.mockResolvedValue(buildMockChild() as any);

      // Act
      await childrenService.remove(childId, parentId);

      // Assert
      expect(mockRepo.deleteByIdAndParent).toHaveBeenCalledWith(childId, parentId);
    });
  });
});
