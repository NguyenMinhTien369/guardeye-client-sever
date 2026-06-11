// src/features/agent/agent.validation.ts

// -----------------------------------------------------------------------------
// AGENT VALIDATION — Zod schemas cho POST /api/v1/agent/sync và
// GET /api/v1/agent/status. Import validate từ auth.validation.
// -----------------------------------------------------------------------------

import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

// -----------------------------------------------------------------------------
// HELPER — dùng chung với auth.validation (sẽ tách ra shared sau)
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
 * Schema cho từng event trong mảng events[] của SyncRequest.
 * Dùng z.discriminatedUnion để type-safe theo type field.
 */
const windowEventSchema = z.object({
  type: z.literal("window"),
  timestamp: z
    .string({ required_error: "Timestamp là bắt buộc" })
    .datetime({ message: "Timestamp phải là chuỗi ISO 8601 hợp lệ" }),
  title: z
    .string({ required_error: "Title là bắt buộc" })
    .trim()
    .min(1, "Title không được rỗng"),
  processName: z
    .string({ required_error: "Process name là bắt buộc" })
    .trim()
    .min(1, "Process name không được rỗng"),
  isIncognito: z.boolean({ required_error: "isIncognito là bắt buộc" }),
});

const historyEventSchema = z.object({
  type: z.literal("history"),
  timestamp: z
    .string({ required_error: "Timestamp là bắt buộc" })
    .datetime({ message: "Timestamp phải là chuỗi ISO 8601 hợp lệ" }),
  url: z
    .string({ required_error: "URL là bắt buộc" })
    .trim()
    .min(1, "URL không được rỗng"),
  title: z
    .string({ required_error: "Title là bắt buộc" })
    .trim()
    .min(1, "Title không được rỗng"),
  browser: z.enum(["chrome", "edge", "unknown"], {
    required_error: "Browser là bắt buộc",
    message: "Browser phải là chrome, edge hoặc unknown",
  }),
  visitTime: z
    .string({ required_error: "Visit time là bắt buộc" })
    .datetime({ message: "VisitTime phải là chuỗi ISO 8601 hợp lệ" }),
});

const agentEventSchema = z.discriminatedUnion("type", [
  windowEventSchema,
  historyEventSchema,
]);

/**
 * syncBodySchema — validate body của POST /api/v1/agent/sync.
 * Kiểm tra eventCount khớp với events.length qua .refine().
 */
export const syncBodySchema = z
  .object({
    deviceToken: z
      .string({ required_error: "Device token là bắt buộc" })
      .trim()
      .min(1, "Device token không được rỗng"),

    sentAt: z
      .string({ required_error: "sentAt là bắt buộc" })
      .datetime({ message: "sentAt phải là chuỗi ISO 8601 hợp lệ" }),

    eventCount: z
      .number({ required_error: "eventCount là bắt buộc" })
      .int("eventCount phải là số nguyên")
      .min(0, "eventCount không được âm"),

    events: z.array(agentEventSchema),
  })
  .refine((data) => data.eventCount === data.events.length, {
    message: "eventCount không khớp với số lượng events thực tế",
    path: ["eventCount"],
  });

/**
 * statusQuerySchema — validate query params của GET /api/v1/agent/status.
 * deviceToken là optional vì có thể lấy từ header X-Device-Token.
 */
export const statusQuerySchema = z.object({
  deviceToken: z
    .string()
    .trim()
    .min(1, "Device token không được rỗng")
    .optional(),
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES
// -----------------------------------------------------------------------------

export type SyncBodyInput = z.infer<typeof syncBodySchema>;
export type StatusQueryInput = z.infer<typeof statusQuerySchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE FACTORIES
// -----------------------------------------------------------------------------

/**
 * validate — middleware factory validate req.body theo schema.
 */
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

/**
 * validateQuery — middleware factory validate req.query theo schema.
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

    // KHÔNG gán lại req.query — trong Node.js mới, req.query là getter (read-only)
    // trên IncomingMessage. Gán lại sẽ gây TypeError → 500.
    // validateQuery chỉ cần CHẶN request xấu, không cần normalize lại query.
    next();
  };
}
