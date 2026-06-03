# Validation Rule — Quy tắc viết Validation trong GuardEye

> **Mục đích:** Checklist và hướng dẫn để mọi file validation trong dự án đều tuân thủ cùng một kiến trúc, dùng Zod nhất quán, và tích hợp đúng cách với middleware + routes.
>
> **File tham chiếu mẫu:** `src/features/auth/auth.validation.ts`

---

## 1. Vai trò của file Validation

File validation đóng vai trò **bức tường lửa** đứng giữa **Client** và **Controller**:

```
Client → Route → validate(schema) → Controller → Service → Repository → DB
                  ↑
         Nếu sai, trả 400 ngay tại đây.
         Controller không bao giờ bị gọi.
```

| Trách nhiệm | Giải thích |
|-------------|-----------|
| Kiểm tra runtime | Đảm bảo dữ liệu thật sự đúng format khi chạy (TypeScript chỉ check lúc compile) |
| Rửa dữ liệu | Tự động `trim()`, `toLowerCase()`, loại bỏ field thừa |
| Trả lỗi chi tiết | Trả về danh sách lỗi theo từng field: `{ email: "...", password: "..." }` |
| Tạo type từ schema | Dùng `z.infer` để tự động sinh TypeScript type, không viết tay 2 lần |

---

## 2. Cấu trúc file Validation — 3 phần bắt buộc

Mỗi file `{feature}.validation.ts` phải có đủ 3 phần theo thứ tự:

```
┌─────────────────────────────────────────┐
│  Phần 1: SCHEMAS                        │  ← Khai báo Zod schemas
│  Phần 2: INFER TYPES                    │  ← Export types từ schema
│  Phần 3: MIDDLEWARE FACTORY (validate)   │  ← Hàm validate() dùng chung
└─────────────────────────────────────────┘
```

> **Lưu ý:** Phần 3 (middleware factory) chỉ cần viết **một lần** và tái sử dụng.
> Nếu dự án đã có `validate()` trong file `auth.validation.ts`, các feature khác chỉ cần import lại, **KHÔNG** viết lại.

---

## 3. Phần 1 — Định nghĩa Schemas

### 3.1. Import Zod

```typescript
import { z } from "zod";
```

### 3.2. Hằng số dùng chung (đặt trên cùng)

Nếu có regex hoặc constant dùng lại nhiều schema, **tách ra biến riêng** ở đầu file:

```typescript
// Regex kiểm tra độ phức tạp mật khẩu: ít nhất 1 chữ hoa, 1 số, 1 ký tự đặc biệt
const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
```

### 3.3. Quy tắc viết Schema

#### ✅ Luôn có `required_error` cho field bắt buộc
```typescript
name: z.string({ required_error: "Tên là bắt buộc" })
```
> Khi client gửi body **không có field này**, Zod sẽ trả lỗi với message tiếng Việt rõ ràng thay vì lỗi mặc định tiếng Anh.

#### ✅ Chuỗi: luôn `trim()` và chain validation
```typescript
email: z
  .string({ required_error: "Email là bắt buộc" })
  .trim()                                      // Bỏ khoảng trắng thừa
  .toLowerCase()                               // Chuẩn hóa chữ thường
  .email("Định dạng email không hợp lệ"),      // Check format
```

#### ✅ Min / Max cho string
```typescript
name: z
  .string({ required_error: "Tên là bắt buộc" })
  .trim()
  .min(2, "Tên phải có ít nhất 2 ký tự")
  .max(50, "Tên không được vượt quá 50 ký tự"),
```

#### ✅ Regex cho password
```typescript
password: z
  .string({ required_error: "Mật khẩu là bắt buộc" })
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
  .regex(
    PASSWORD_STRENGTH_REGEX,
    "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt (!@#$%^&*)",
  ),
```

#### ✅ Field không bắt buộc: dùng `.optional()`
```typescript
notificationEmail: z
  .string()
  .trim()
  .toLowerCase()
  .email("Định dạng email thông báo không hợp lệ")
  .optional(),
```

#### ✅ Token / ID đơn giản: chỉ cần `string().min(1)`
```typescript
token: z.string({ required_error: "Token là bắt buộc" }).min(1),
```

### 3.4. Kiểm tra liên field — dùng `.refine()`

Khi cần so sánh 2 field với nhau (ví dụ: password === confirmPassword), **bắt buộc** dùng `.refine()` ở cuối schema:

```typescript
export const registerSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],  // Gán lỗi vào đúng field confirmPassword
  });
```

> **Tại sao dùng `path`?** Nếu không chỉ định `path`, lỗi sẽ gắn vào root object, client không biết field nào sai. Khi có `path: ["confirmPassword"]`, client nhận được `{ errors: { confirmPassword: "Mật khẩu xác nhận không khớp" } }`.

### 3.5. Đặt tên Schema

| Pattern | Ví dụ |
|---------|-------|
| `{hànhĐộng}Schema` | `registerSchema`, `loginSchema`, `createCameraSchema` |
| Tên phải khớp route | Route `/register` → `registerSchema` |

---

## 4. Phần 2 — Export Inferred Types

Dùng `z.infer` để tự động tạo TypeScript type từ schema. **KHÔNG bao giờ** viết type tay rồi đồng bộ với schema — sẽ bị lệch khi sửa.

```typescript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCameraInput = z.infer<typeof createCameraSchema>;
```

> **Lợi ích:** Khi bạn thêm/sửa field trong schema, type tự động cập nhật theo. Zero maintenance.

---

## 5. Phần 3 — Middleware Factory (`validate`)

### 5.1. Hàm `formatZodErrors` — Làm phẳng lỗi cho client

```typescript
function formatZodErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce(
    (acc, err) => {
      const field = err.path.join(".");
      // Chỉ lấy lỗi ĐẦU TIÊN của mỗi field
      if (!acc[field]) acc[field] = err.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}
```

> **Tại sao chỉ lấy lỗi đầu tiên?** Nếu password vừa thiếu chữ hoa, vừa thiếu số, vừa thiếu ký tự đặc biệt → client chỉ nhận 1 lỗi duy nhất. Tránh spam quá nhiều lỗi cùng lúc, UX tốt hơn.

### 5.2. Hàm `validate(schema)` — Middleware dùng lại cho mọi route

```typescript
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: formatZodErrors(result.error),
      });
      return;  // DỪNG LẠI — không gọi next(), controller không bị chạy
    }

    // Ghi đè req.body bằng data đã "rửa sạch"
    req.body = result.data;
    next();  // Đi tiếp vào controller
  };
}
```

> **Điểm mấu chốt:** `req.body = result.data` ghi đè body gốc bằng data đã trim, toLowerCase, loại field thừa. Controller nhận được data sạch 100%.

---

## 6. Tích hợp trong Routes

Tại file `{feature}.routes.ts`, gắn middleware `validate()` TRƯỚC controller:

```typescript
import { validate } from "./{feature}.validation";
import { createSchema, updateSchema } from "./{feature}.validation";

// validate chạy trước → nếu lỗi thì dừng → nếu pass thì vào controller
router.post("/", validate(createSchema), controller.create);
router.put("/:id", validate(updateSchema), controller.update);
```

### Thứ tự middleware trong route

```
router.post(
  "/path",
  validate(schema),       // ① Validate body trước
  authenticate,           // ② Kiểm tra đăng nhập (nếu cần)
  requireEmailVerified,   // ③ Kiểm tra email verified (nếu cần)
  controller.method       // ④ Controller chạy cuối cùng
);
```

> **Lưu ý:** Với route công khai (không cần đăng nhập), chỉ cần `validate → controller`.
> Với route cần đăng nhập nhưng không cần validate body (như logout), chỉ cần `authenticate → controller`.

---

## 7. Các loại Schema thường gặp

### Schema đơn giản (chỉ validate body)
```typescript
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string({ required_error: "Mật khẩu là bắt buộc" }),
});
```

### Schema có refine (validate liên field)
```typescript
export const registerSchema = z
  .object({ ... })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });
```

### Schema chỉ có 1 field
```typescript
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: "Refresh token là bắt buộc" })
    .min(1, "Refresh token không được rỗng"),
});
```

### Schema cho params (validate URL params)
```typescript
export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
});
```

### Schema cho query string (validate query params)
```typescript
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().optional(),
});
```

> **Tip:** Dùng `z.coerce.number()` khi nhận query string vì query params luôn là string, cần coerce sang number.

---

## 8. Mở rộng: Validate params và query

Hàm `validate()` hiện tại chỉ validate `req.body`. Nếu cần validate `params` hoặc `query`, có thể tạo thêm 2 middleware:

```typescript
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Tham số URL không hợp lệ",
        errors: formatZodErrors(result.error),
      });
      return;
    }
    req.params = result.data;
    next();
  };
}

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
    req.query = result.data;
    next();
  };
}
```

---

## 9. Template tạo Validation mới

Khi tạo file validation cho feature mới, copy template dưới đây:

```typescript
// src/features/{feature}/{feature}.validation.ts

import { z } from "zod";

// -----------------------------------------------------------------------------
// {FEATURE_NAME} VALIDATION
// Dùng Zod để định nghĩa schema và validate request body
// -----------------------------------------------------------------------------

// Hằng số dùng chung (nếu có)
// const MY_REGEX = /pattern/;

// -----------------------------------------------------------------------------
// 1. SCHEMAS
// -----------------------------------------------------------------------------

export const createFeatureSchema = z.object({
  name: z
    .string({ required_error: "Tên là bắt buộc" })
    .trim()
    .min(1, "Tên không được rỗng")
    .max(100, "Tên không được vượt quá 100 ký tự"),

  // Thêm các field khác...
});

export const updateFeatureSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  // Thêm các field khác (thường optional khi update)...
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES
// Dùng z.infer để tự động đồng bộ type với schema
// -----------------------------------------------------------------------------

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE — Import từ auth.validation.ts, KHÔNG viết lại
// -----------------------------------------------------------------------------
// import { validate } from "../auth/auth.validation";
// HOẶC nếu đã tách validate() ra file riêng:
// import { validate } from "../../shared/middlewares/validate.middleware";
```

---

## 10. Checklist tự kiểm tra trước khi commit

- [ ] Mọi field bắt buộc đều có `required_error` bằng tiếng Việt
- [ ] Mọi field string đều có `.trim()` để loại khoảng trắng thừa
- [ ] Email luôn có `.trim().toLowerCase().email()`
- [ ] Password luôn có `.min(8)` + `.regex()` kiểm tra độ mạnh
- [ ] Nếu có 2 field cần so sánh → dùng `.refine()` với `path` cụ thể
- [ ] Field không bắt buộc → dùng `.optional()` cuối chain
- [ ] Đã export schema (dùng `export const`)
- [ ] Đã export inferred type bằng `z.infer<typeof schema>`
- [ ] Schema được đặt tên đúng convention: `{hànhĐộng}Schema`
- [ ] Hàm `validate()` được import từ file có sẵn, **KHÔNG** viết lại
- [ ] Trong routes, `validate(schema)` được gắn **TRƯỚC** controller
