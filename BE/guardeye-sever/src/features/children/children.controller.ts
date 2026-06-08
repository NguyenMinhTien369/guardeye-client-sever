import { Request, Response, NextFunction } from "express";
import childrenService from "./children.service";
import { CreateChildDto, UpdateChildDto } from "./children.dto";
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import { BadRequestError } from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// CHILDREN CONTROLLER
// Xử lý tầng HTTP, nhận/trả request/response cho quản lý hồ sơ con.
// -----------------------------------------------------------------------------

/**
 * POST /children
 */
export const createChild = async (
  req: Request<{}, {}, CreateChildDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const result = await childrenService.createChild(parentId, req.body);
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
 */
export const getChildren = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const result = await childrenService.getChildrenByParent(parentId);
    new OKResponse({
      message: "Lấy danh sách hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lấy danh sách thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * GET /children/:id
 */
export const getChildById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    const result = await childrenService.getChildById(parentId, id);
    new OKResponse({
      message: "Lấy chi tiết hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /children/:id
 */
export const updateChild = async (
  req: Request<{ id: string }, {}, UpdateChildDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    const result = await childrenService.updateChild(parentId, id, req.body);
    new OKResponse({
      message: "Cập nhật hồ sơ bé thành công",
      data: result,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /children/:id
 */
export const deleteChild = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id } = req.params;
    await childrenService.deleteChild(parentId, id);
    new OKResponse({
      message: "Xóa hồ sơ bé thành công",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
