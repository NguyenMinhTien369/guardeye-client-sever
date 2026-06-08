// test/children/children.controller.test.ts

// -----------------------------------------------------------------------------
// Mock dependency: childrenService — Controller chỉ gọi Service, không gọi DB
// -----------------------------------------------------------------------------

jest.mock("../../src/features/children/children.service");

import { Request, Response, NextFunction } from "express";
import {
  create,
  getAll,
  getById,
  update,
  remove,
} from "../../src/features/children/children.controller";
import childrenService from "../../src/features/children/children.service";
import {
  BadRequestError,
  NotFoundError,
} from "../../src/shared/core/error.response";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockService = childrenService as jest.Mocked<typeof childrenService>;

// -----------------------------------------------------------------------------
// MOCK FACTORY — Express req / res / next
// -----------------------------------------------------------------------------

function buildMockRes(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

function buildMockReq(
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  user?: { _id: { toString: () => string } }
): Partial<Request> {
  return { body, params, user: user as any };
}

// -----------------------------------------------------------------------------
// BUILDER — mock child data
// -----------------------------------------------------------------------------

function buildChildResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "child_001",
    parentId: "parent_001",
    name: "Nguyen Van An",
    age: 7,
    gender: "male",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// Mock parent user gắn vào req.user sau authenticate middleware
const mockParentUser = { _id: { toString: () => "parent_001" } };

// -----------------------------------------------------------------------------
// TEST SUITE: ChildrenController
// -----------------------------------------------------------------------------

describe("ChildrenController", () => {
  let res: jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const createBody = { name: "Nguyen Van An", age: 7, gender: "male" };

    it("should respond with 201 and child data when creation is successful", async () => {
      // Arrange
      const serviceResult = buildChildResponse();
      mockService.create.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(createBody, {}, mockParentUser);

      // Act
      await create(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call childrenService.create with parentId from req.user and body data", async () => {
      // Arrange
      const serviceResult = buildChildResponse();
      mockService.create.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(createBody, {}, mockParentUser);

      // Act
      await create(req as Request, res, next);

      // Assert
      expect(mockService.create).toHaveBeenCalledWith(
        "parent_001",
        expect.objectContaining({ name: "Nguyen Van An", age: 7 })
      );
    });

    it("should call next with BadRequestError when service throws", async () => {
      // Arrange
      mockService.create.mockRejectedValue(new Error("Tạo hồ sơ thất bại"));
      const req = buildMockReq(createBody, {}, mockParentUser);

      // Act
      await create(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------

  describe("getAll", () => {
    it("should respond with 200 and a list of children", async () => {
      // Arrange
      const serviceResult = [buildChildResponse(), buildChildResponse({ id: "child_002" })];
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

    it("should respond with 200 and empty array when parent has no children", async () => {
      // Arrange
      mockService.getAll.mockResolvedValue([]);
      const req = buildMockReq({}, {}, mockParentUser);

      // Act
      await getAll(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should call childrenService.getAll with parentId from req.user", async () => {
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
  // getById
  // ---------------------------------------------------------------------------

  describe("getById", () => {
    it("should respond with 200 and child data when child is found", async () => {
      // Arrange
      const serviceResult = buildChildResponse();
      mockService.getById.mockResolvedValue(serviceResult as any);
      const req = buildMockReq({}, { id: "child_001" }, mockParentUser);

      // Act
      await getById(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call childrenService.getById with correct childId and parentId", async () => {
      // Arrange
      const serviceResult = buildChildResponse();
      mockService.getById.mockResolvedValue(serviceResult as any);
      const req = buildMockReq({}, { id: "child_001" }, mockParentUser);

      // Act
      await getById(req as any, res, next);

      // Assert
      expect(mockService.getById).toHaveBeenCalledWith("child_001", "parent_001");
    });

    it("should call next with NotFoundError when child does not exist", async () => {
      // Arrange
      mockService.getById.mockRejectedValue(new Error("Không tìm thấy hồ sơ bé"));
      const req = buildMockReq({}, { id: "nonexistent_id" }, mockParentUser);

      // Act
      await getById(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    const updateBody = { name: "Nguyen Van An Sua", age: 9 };

    it("should respond with 200 and updated child data when update is successful", async () => {
      // Arrange
      const serviceResult = buildChildResponse({ name: "Nguyen Van An Sua", age: 9 });
      mockService.update.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(updateBody, { id: "child_001" }, mockParentUser);

      // Act
      await update(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call childrenService.update with correct childId, parentId and body", async () => {
      // Arrange
      const serviceResult = buildChildResponse({ name: "Nguyen Van An Sua", age: 9 });
      mockService.update.mockResolvedValue(serviceResult as any);
      const req = buildMockReq(updateBody, { id: "child_001" }, mockParentUser);

      // Act
      await update(req as any, res, next);

      // Assert
      expect(mockService.update).toHaveBeenCalledWith(
        "child_001",
        "parent_001",
        updateBody
      );
    });

    it("should call next with NotFoundError when child is not found for update", async () => {
      // Arrange
      mockService.update.mockRejectedValue(new Error("Không tìm thấy hồ sơ bé"));
      const req = buildMockReq(updateBody, { id: "nonexistent_id" }, mockParentUser);

      // Act
      await update(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it("should call next with BadRequestError for generic update errors", async () => {
      // Arrange
      mockService.update.mockRejectedValue(new Error("Dữ liệu cập nhật không hợp lệ"));
      const req = buildMockReq(updateBody, { id: "child_001" }, mockParentUser);

      // Act
      await update(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // remove (delete)
  // ---------------------------------------------------------------------------

  describe("remove", () => {
    it("should respond with 200 when child is deleted successfully", async () => {
      // Arrange
      mockService.remove.mockResolvedValue(undefined as any);
      const req = buildMockReq({}, { id: "child_001" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call childrenService.remove with correct childId and parentId", async () => {
      // Arrange
      mockService.remove.mockResolvedValue(undefined as any);
      const req = buildMockReq({}, { id: "child_001" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(mockService.remove).toHaveBeenCalledWith("child_001", "parent_001");
    });

    it("should call next with NotFoundError when child does not exist for deletion", async () => {
      // Arrange
      mockService.remove.mockRejectedValue(new Error("Không tìm thấy hồ sơ bé"));
      const req = buildMockReq({}, { id: "nonexistent_id" }, mockParentUser);

      // Act
      await remove(req as any, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });
});
