import { Request, Response, NextFunction } from "express";
import devicesService from "./devices.service";
import { CreateDeviceRequestDto, PauseDeviceRequestDto } from "./devices.dto";
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  NotFoundError,
  ErrorResponse,
} from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// DEVICES CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

/**
 * POST /children/:childId/devices
 * Tạo thiết bị giám sát mới cho một đứa trẻ cụ thể.
 * - childId lấy từ URL param — phụ huynh chỉ cần nhập deviceName + monitoredUsers
 * - parentId lấy từ JWT (req.user) — không nhận từ client
 * - deviceToken do server tự sinh UUID — client không được tự đặt
 */
export const create = async (
  req: Request<{ childId: string }, {}, CreateDeviceRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { childId } = req.params;
    const result = await devicesService.create(parentId, childId, req.body);
    new CreatedResponse({
      message: "Đăng ký thiết bị thành công",
      data:    result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng ký thiết bị thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * GET /devices
 * Lấy danh sách tất cả thiết bị của phụ huynh đang đăng nhập.
 */
export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const result = await devicesService.getAll(parentId);
    new OKResponse({
      message: "Lấy danh sách thiết bị thành công",
      data:    result,
    }).send(res);
  } catch (error) {
    next(new ErrorResponse("Có lỗi xảy ra. Vui lòng thử lại sau.", 500, "INTERNAL_SERVER_ERROR"));
  }
};

/**
 * PATCH /devices/:id/pause
 * Tạm dừng giám sát thiết bị.
 * - Không có body.pausedUntil → pause vô thời hạn (mở lại bằng tay)
 * - Có body.pausedUntil → agent tự động resume khi hết giờ
 */
export const pause = async (
  req: Request<{ id: string }, {}, PauseDeviceRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id }   = req.params;
    const result   = await devicesService.pause(id, parentId, req.body);
    new OKResponse({
      message: result.message,
      data:    result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tạm dừng thiết bị thất bại";
    next(new NotFoundError(message));
  }
};

/**
 * PATCH /devices/:id/resume
 * Tiếp tục giám sát sau khi tạm dừng — phụ huynh mở lại bằng tay.
 */
export const resume = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id }   = req.params;
    const result   = await devicesService.resume(id, parentId);
    new OKResponse({
      message: result.message,
      data:    result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tiếp tục giám sát thất bại";
    next(new NotFoundError(message));
  }
};

/**
 * DELETE /devices/:id
 * Xóa thiết bị theo ID — chỉ cho phép phụ huynh sở hữu thực hiện.
 */
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parentId = req.user!._id.toString();
    const { id }   = req.params;
    await devicesService.remove(id, parentId);
    new OKResponse({
      message: "Xóa thiết bị thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xóa thiết bị thất bại";
    next(new NotFoundError(message));
  }
};
