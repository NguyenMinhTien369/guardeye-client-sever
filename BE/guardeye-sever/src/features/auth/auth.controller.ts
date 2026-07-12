// src/modules/auth/auth.controller.ts

import { Request, Response, NextFunction } from "express";
import authService from "./auth.service";
import { RegisterRequestDto, LoginRequestDto } from "./auth.dto";
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import { 
  ConflictError, 
  BadRequestError, 
  AuthFailureError, 
  ForbiddenError, 
  ErrorResponse 
} from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// AUTH CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

/**
 * POST /auth/register
 */
export const register = async (
  req: Request<{}, {}, RegisterRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    new CreatedResponse({
      message: "Đăng ký tài khoản thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng ký thất bại";
    // Email trùng là lỗi 409 (Conflict), lỗi khác là 400 (Bad Request)
    if (message.includes("đã được sử dụng")) {
      next(new ConflictError(message));
    } else {
      next(new BadRequestError(message));
    }
  }
};

/**
 * POST /auth/login
 */
export const login = async (
  req: Request<{}, {}, LoginRequestDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    new OKResponse({
      message: "Đăng nhập thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng nhập thất bại";
    // Tài khoản bị khoá -> 403, sai thông tin -> 401
    if (message.includes("vô hiệu hóa")) {
      next(new ForbiddenError(message));
    } else {
      next(new AuthFailureError(message));
    }
  }
};

/**
 * POST /auth/verify-email
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;
    await authService.verifyEmail(token);
    new OKResponse({
      message: "Xác thực email thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xác thực email thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * POST /auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.forgotPassword(req.body.email);
    // Luôn trả về response giống nhau dù email có tồn tại hay không
    new OKResponse({
      message: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
    }).send(res);
  } catch (error) {
    next(new ErrorResponse("Có lỗi xảy ra. Vui lòng thử lại sau.", 500, "INTERNAL_SERVER_ERROR"));
  }
};

/**
 * POST /auth/verify-otp
 */
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body;
    await authService.verifyOtp(email, otp);
    new OKResponse({
      message: "Xác thực OTP thành công, bạn có thể đặt lại mật khẩu.",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xác thực OTP thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * POST /auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;
    await authService.resetPassword(email, otp, newPassword);
    new OKResponse({
      message: "Đặt lại mật khẩu thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đặt lại mật khẩu thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * POST /auth/refresh-token
 * Cấp lại cặp token mới từ refresh token còn hiệu lực.
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);
    new OKResponse({
      message: "Làm mới token thành công",
      data: tokens,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Làm mới token thất bại";
    if (message.includes("hết hạn") || message.includes("không hợp lệ")) {
      next(new AuthFailureError(message, "TOKEN_EXPIRED_OR_INVALID"));
    } else {
      next(new BadRequestError(message));
    }
  }
};

/**
 * POST /auth/logout
 * Đăng xuất: thu hồi refresh token của user hiện tại.
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.logout(req.user!._id.toString());
    new OKResponse({
      message: "Đăng xuất thành công",
    }).send(res);
  } catch (error) {
    next(new ErrorResponse("Đăng xuất thất bại. Vui lòng thử lại.", 500, "INTERNAL_SERVER_ERROR"));
  }
};

/**
 * PATCH /auth/profile
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.updateProfile(req.user!._id.toString(), req.body);
    new OKResponse({
      message: "Cập nhật thông tin thành công",
      data: result,
    }).send(res);
  } catch (error) {
    next(new BadRequestError("Cập nhật thất bại"));
  }
};

/**
 * PUT /auth/password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user!._id.toString(), oldPassword, newPassword);
    new OKResponse({
      message: "Đổi mật khẩu thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đổi mật khẩu thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * POST /auth/avatar
 */
export const uploadAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new BadRequestError("Không tìm thấy file ảnh");
    }
    const result = await authService.uploadAvatar(req.user!._id.toString(), req.file);
    new OKResponse({
      message: "Cập nhật ảnh đại diện thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cập nhật ảnh đại diện thất bại";
    next(new BadRequestError(message));
  }
};

