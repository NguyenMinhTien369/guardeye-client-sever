// src/modules/auth/auth.validation.ts

import { z } from "zod";

// -----------------------------------------------------------------------------
// AUTH VALIDATION - Dùng Zod để định nghĩa schema và validate request body
// Tách riêng khỏi DTO để DTO chỉ lo về type, file này lo về runtime validation
// -----------------------------------------------------------------------------

// Regex kiểm tra độ phức tạp mật khẩu: ít nhất 1 chữ hoa, 1 số, 1 ký tự đặc biệt
const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;

// -----------------------------------------------------------------------------
// 1. SCHEMAS
// -----------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: "Tên là bắt buộc" })
      .trim()
      .min(2, "Tên phải có ít nhất 2 ký tự")
      .max(50, "Tên không được vượt quá 50 ký tự"),

    email: z
      .string({ required_error: "Email là bắt buộc" })
      .trim()
      .toLowerCase()
      .email("Định dạng email không hợp lệ"),

    password: z
      .string({ required_error: "Mật khẩu là bắt buộc" })
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(
        PASSWORD_STRENGTH_REGEX,
        "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt (!@#$%^&*)",
      ),

    confirmPassword: z.string({
      required_error: "Vui lòng xác nhận mật khẩu",
    }),

    notificationEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Định dạng email thông báo không hợp lệ")
      .optional(),
  })
  // Kiểm tra password === confirmPassword ở refine để có thể gán lỗi đúng field
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email là bắt buộc" })
    .trim()
    .toLowerCase()
    .email("Định dạng email không hợp lệ"),

  password: z.string({ required_error: "Mật khẩu là bắt buộc" }),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email là bắt buộc" })
    .trim()
    .toLowerCase()
    .email("Định dạng email không hợp lệ"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string({ required_error: "Token là bắt buộc" }).min(1),

    newPassword: z
      .string({ required_error: "Mật khẩu mới là bắt buộc" })
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(
        PASSWORD_STRENGTH_REGEX,
        "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt (!@#$%^&*)",
      ),

    confirmNewPassword: z.string({
      required_error: "Vui lòng xác nhận mật khẩu mới",
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string({ required_error: "Token là bắt buộc" }).min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: "Refresh token là bắt buộc" })
    .min(1, "Refresh token không được rỗng"),
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES TỪ SCHEMA
// Dùng z.infer để tự động đồng bộ type với schema, không cần khai báo lại tay
// -----------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE FACTORY
// Tạo middleware validate request body theo schema được truyền vào.
// Dùng factory pattern để tái sử dụng cho mọi schema mà không lặp code.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Parse lỗi Zod thành object { field: message } phẳng và dễ đọc cho client.
 */
function formatZodErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce(
    (acc, err) => {
      // err.path là mảng, lấy phần tử cuối làm key (tên field)
      const field = err.path.join(".");
      // Chỉ lấy lỗi đầu tiên của mỗi field, tránh spam nhiều lỗi cùng lúc
      if (!acc[field]) acc[field] = err.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: formatZodErrors(result.error),
      });
      return;
    }

    // Ghi đè req.body bằng data đã được Zod parse và transform
    // (trim, toLowerCase, coerce đã được áp dụng)
    req.body = result.data;
    next();
  };
}
