import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../core/error.response";
import { ENV } from "../config/env";

export const errorHandler = (
  err: ErrorResponse,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Lỗi hệ thống nội bộ";
  const errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorCode,
    // Chỉ hiển thị stack trace ở môi trường development để debug
    stack: ENV.NODE_ENV === "development" ? err.stack : undefined,
  });
};
