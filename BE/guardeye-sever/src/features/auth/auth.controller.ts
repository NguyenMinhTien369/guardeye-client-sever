// src/modules/auth/auth.controller.ts

import { Request, Response } from "express";
import authService from "./auth.service";
import { RegisterRequestDto, LoginRequestDto } from "./auth.dto";

// -----------------------------------------------------------------------------
// AUTH CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

// Helper chuẩn hoá response thành công
const sendSuccess = (
  res: Response,
  data: unknown,
  statusCode = 200,
): Response => {
  return res.status(statusCode).json({ success: true, data });
};

// Helper chuẩn hoá response lỗi
const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
): Response => {
  return res.status(statusCode).json({ success: false, message });
};

// -----------------------------------------------------------------------------
// CONTROLLER METHODS
// -----------------------------------------------------------------------------

/**
 * POST /auth/register
 */
export const register = async (
  req: Request<{}, {}, RegisterRequestDto>,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng ký thất bại";

    // Email trùng là lỗi client (400), không phải server error (500)
    const statusCode = message.includes("đã được sử dụng") ? 409 : 400;
    sendError(res, message, statusCode);
  }
};

/**
 * POST /auth/login
 */
export const login = async (
  req: Request<{}, {}, LoginRequestDto>,
  res: Response,
): Promise<void> => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Đăng nhập thất bại";

    // Sai credentials → 401, tài khoản bị khoá → 403
    const statusCode = message.includes("vô hiệu hóa") ? 403 : 401;
    sendError(res, message, statusCode);
  }
};

/**
 * POST /auth/verify-email
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Token lấy từ query string: /auth/verify-email?token=xxx
    const { token } = req.body;
    await authService.verifyEmail(token);
    sendSuccess(res, { message: "Xác thực email thành công" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Xác thực email thất bại";
    sendError(res, message, 400);
  }
};

/**
 * POST /auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await authService.forgotPassword(req.body.email);

    // Luôn trả về response giống nhau dù email có tồn tại hay không
    // để tránh email enumeration attack (đã xử lý ở Service layer)
    sendSuccess(res, {
      message:
        "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
    });
  } catch (error) {
    sendError(res, "Có lỗi xảy ra. Vui lòng thử lại sau.", 500);
  }
};

/**
 * POST /auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    sendSuccess(res, { message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Đặt lại mật khẩu thất bại";
    sendError(res, message, 400);
  }
};
