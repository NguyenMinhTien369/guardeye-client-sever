import { Request, Response, NextFunction } from "express";
import childrenService from "./children.service";
import { CreateChildRequestDto, UpdateChildRequestDto } from "./children.dto";
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  NotFoundError,
  ErrorResponse,
} from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// CHILDREN CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

/**
 * POST /children
 * Tạo hồ sơ bé mới cho phụ huynh đang đăng nhập.
 */
export const create = async (
  req: Request<{}, {}, CreateChildRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // parentId lấy từ req.user được gắn bởi authenticate middleware
    const parentId = req.user!._id.toString();
    const result = await childrenService.create(parentId, req.body);
    new CreatedResponse({
      message: "Tạo hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tạo hồ sơ bé thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * GET /children
 * Lấy danh sách tất cả hồ sơ bé của phụ huynh đang đăng nhập.
 */
export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const result = await childrenService.getAll(parentId);
    new OKResponse({
      message: "Lấy danh sách hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    next(new ErrorResponse("Có lỗi xảy ra. Vui lòng thử lại sau.", 500, "INTERNAL_SERVER_ERROR"));
  }
};

/**
 * GET /children/:id
 * Lấy chi tiết một hồ sơ bé theo ID.
 */
export const getById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    const result = await childrenService.getById(id, parentId);
    new OKResponse({
      message: "Lấy chi tiết hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tìm thấy hồ sơ bé";
    next(new NotFoundError(message));
  }
};

/**
 * PUT /children/:id
 * Cập nhật hồ sơ bé theo ID.
 */
export const update = async (
  req: Request<{ id: string }, {}, UpdateChildRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    const result = await childrenService.update(id, parentId, req.body);
    new OKResponse({
      message: "Cập nhật hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cập nhật hồ sơ bé thất bại";
    // Không tìm thấy bé → 404, lỗi khác → 400
    if (message.includes("Không tìm thấy")) {
      next(new NotFoundError(message));
    } else {
      next(new BadRequestError(message));
    }
  }
};

/**
 * DELETE /children/:id
 * Xóa hồ sơ bé theo ID.
 */
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    await childrenService.remove(id, parentId);
    new OKResponse({
      message: "Xóa hồ sơ bé thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xóa hồ sơ bé thất bại";
    next(new NotFoundError(message));
  }
};
