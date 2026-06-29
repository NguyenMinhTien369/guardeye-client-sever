// src/features/screenshot/screenshot.validation.ts

// -----------------------------------------------------------------------------
// SCREENSHOT VALIDATION — Zod schemas cho upload và query endpoints.
// -----------------------------------------------------------------------------

import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

// -----------------------------------------------------------------------------
// HELPER
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 1. SCHEMAS
// -----------------------------------------------------------------------------

/**
 * uploadQuerySchema — validate query params của POST /api/v1/agent/screenshot.
 * File ảnh được validate riêng bởi multer (file type + size limit).
 */
export const uploadQuerySchema = z.object({
  captureIndex: z
    .string({ required_error: "captureIndex là bắt buộc" })
    .refine((v) => ["0", "1", "2"].includes(v), {
      message: "captureIndex phải là 0, 1 hoặc 2",
    }),

  capturedAt: z
    .string({ required_error: "capturedAt là bắt buộc" })
    .datetime({ message: "capturedAt phải là chuỗi ISO 8601 hợp lệ" }),

  triggerTitle: z
    .string({ required_error: "triggerTitle là bắt buộc" })
    .trim()
    .min(1, "triggerTitle không được rỗng")
    .max(500, "triggerTitle không được vượt quá 500 ký tự"),
});

/**
 * getScreenshotsQuerySchema — validate query params của GET /api/v1/screenshots/device/:deviceId.
 */
export const getScreenshotsQuerySchema = z.object({
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey phải có dạng YYYY-MM-DD")
    .optional(),

  page: z
    .string()
    .optional()
    .refine((v) => !v || (parseInt(v) > 0 && !isNaN(parseInt(v))), {
      message: "page phải là số nguyên dương",
    }),

  limit: z
    .string()
    .optional()
    .refine((v) => !v || (parseInt(v) > 0 && parseInt(v) <= 100 && !isNaN(parseInt(v))), {
      message: "limit phải là số nguyên từ 1 đến 100",
    }),
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES
// -----------------------------------------------------------------------------

export type UploadQueryInput = z.infer<typeof uploadQuerySchema>;
export type GetScreenshotsQueryInput = z.infer<typeof getScreenshotsQuerySchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE FACTORIES
// -----------------------------------------------------------------------------

/**
 * validateQuery — middleware validate req.query theo Zod schema.
 * Chỉ block request khi invalid, không normalize lại req.query.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Query params không hợp lệ",
        errors: formatZodErrors(result.error),
      });
      return;
    }

    next();
  };
}
