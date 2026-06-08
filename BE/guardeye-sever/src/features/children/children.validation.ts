import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

// -----------------------------------------------------------------------------
// CHILDREN VALIDATION - Dùng Zod để định nghĩa schema và validate request body
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. SCHEMAS
// -----------------------------------------------------------------------------

export const createChildSchema = z.object({
  name: z
    .string({ required_error: "Tên là bắt buộc" })
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(50, "Tên không được vượt quá 50 ký tự"),
  age: z
    .number({ required_error: "Tuổi là bắt buộc" })
    .min(0, "Tuổi không thể nhỏ hơn 0")
    .max(18, "Tuổi không thể lớn hơn 18"),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Giới tính là bắt buộc",
    invalid_type_error: "Giới tính không hợp lệ",
  }),
  avatar: z.string().optional().default(""),
});

export const updateChildSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(50, "Tên không được vượt quá 50 ký tự")
    .optional(),
  age: z
    .number()
    .min(0, "Tuổi không thể nhỏ hơn 0")
    .max(18, "Tuổi không thể lớn hơn 18")
    .optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  avatar: z.string().optional(),
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES TỪ SCHEMA
// -----------------------------------------------------------------------------

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type UpdateChildInput = z.infer<typeof updateChildSchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE FACTORY
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
