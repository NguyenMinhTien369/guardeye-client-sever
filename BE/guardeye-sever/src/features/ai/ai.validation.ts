import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// 1. Định nghĩa Schema bằng Zod
export const analyzeUrlSchema = z.object({
  url: z
    .string({ required_error: 'URL là bắt buộc' })
    .url('URL không đúng định dạng'),
});

export const chatSchema = z.object({
  url: z
    .string({ required_error: 'URL là bắt buộc' })
    .url('URL không đúng định dạng'),
  message: z
    .string({ required_error: 'Tin nhắn là bắt buộc' })
    .trim()
    .min(1, 'Tin nhắn không được để trống')
    .max(500, 'Tin nhắn tối đa 500 ký tự'),
});

// 2. Tái sử dụng hàm formatZodErrors (giống hệt bên auth.validation.ts)
function formatZodErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce(
    (acc, err) => {
      const field = err.path.join(".");
      if (!acc[field]) acc[field] = err.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}

// 3. Tái sử dụng middleware validate
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

    req.body = result.data;
    next();
  };
}