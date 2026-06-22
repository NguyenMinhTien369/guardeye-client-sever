# Controller Rule — Quy tắc viết Controller trong GuardEye

> **Mục đích:** Checklist và hướng dẫn để mọi file controller trong dự án đều tuân thủ cùng một kiến trúc, dễ đọc, dễ maintain, và nhất quán 100%.
>
> **File tham chiếu mẫu:** `src/features/auth/auth.controller.ts`

---

## 1. Nguyên tắc cốt lõi

Controller **CHỈ** làm 3 việc:

| Bước | Mô tả |
|------|-------|
| ① Nhận request | Lấy dữ liệu từ `req.body`, `req.params`, `req.query` |
| ② Gọi Service | Ủy thác toàn bộ business logic cho Service layer |
| ③ Trả response | Dùng Core Response class hoặc đẩy lỗi qua `next()` |

> **KHÔNG BAO GIỜ** viết business logic (query DB, hash password, gửi email...) bên trong Controller.

---

## 2. Cấu trúc Import bắt buộc

```typescript
// 1. Express types — luôn import NextFunction
import { Request, Response, NextFunction } from "express";

// 2. Service layer — mỗi controller chỉ gọi đúng service của feature mình
import featureService from "./feature.service";

// 3. DTO — dùng cho type-safe req.body
import { CreateFeatureDto } from "./feature.dto";

// 4. Core Response — KHÔNG TỰ VIẾT hàm sendSuccess/sendError
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import {
  ConflictError,
  BadRequestError,
  AuthFailureError,
  ForbiddenError,
  NotFoundError,
  ErrorResponse,
} from "../../shared/core/error.response";
```

> **⚠️ LƯU Ý QUAN TRỌNG:**
> - **KHÔNG** tự tạo helper `sendSuccess()` / `sendError()` trong controller.
> - **PHẢI** dùng các class từ `shared/core/`.

---

## 3. Chữ ký hàm (Function Signature) chuẩn

### 3.1. Route công khai (không cần đăng nhập)

```typescript
export const create = async (
  req: Request<{}, {}, CreateFeatureDto>,  // Generic type cho body
  res: Response,
  next: NextFunction                       // BẮT BUỘC có next
): Promise<void> => {
  // ...
};
```

### 3.2. Route cần đăng nhập (có `authenticate` middleware)

```typescript
export const getProfile = async (
  req: Request,    // req.user đã được gắn bởi authenticate middleware
  res: Response,
  next: NextFunction
): Promise<void> => {
  // req.user! chắc chắn tồn tại vì đã qua authenticate
  const userId = req.user!._id.toString();
  // ...
};
```

### 3.3. Route có params

```typescript
export const getById = async (
  req: Request<{ id: string }>,  // Generic type cho params
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  // ...
};
```

---

## 4. Xử lý Response thành công

### Dùng `CreatedResponse` khi tạo mới tài nguyên (HTTP 201)
```typescript
// POST — tạo mới
const result = await featureService.create(req.body);
new CreatedResponse({
  message: "Tạo thành công",
  data: result,
}).send(res);
```

### Dùng `OKResponse` cho mọi trường hợp còn lại (HTTP 200)
```typescript
// GET / PUT / PATCH / DELETE
const result = await featureService.getAll();
new OKResponse({
  message: "Lấy danh sách thành công",
  data: result,
  metadata: { page: 1, limit: 20, total: 100 },  // tuỳ chọn, dùng cho phân trang
}).send(res);
```

### Khi không có data trả về (chỉ cần thông báo)
```typescript
await featureService.delete(id);
new OKResponse({
  message: "Xóa thành công",
}).send(res);
```

---

## 5. Xử lý lỗi — Luôn đẩy qua `next()`

### Bảng chọn Error Class đúng

| HTTP Code | Error Class | Khi nào dùng | Ví dụ |
|-----------|------------|--------------|-------|
| 400 | `BadRequestError` | Dữ liệu không hợp lệ, logic sai | Token sai, dữ liệu thiếu |
| 401 | `AuthFailureError` | Chưa đăng nhập / sai credentials | Sai email/password, token hết hạn |
| 403 | `ForbiddenError` | Đã đăng nhập nhưng không có quyền | Tài khoản bị khóa, email chưa verify |
| 404 | `NotFoundError` | Không tìm thấy tài nguyên | User/Product không tồn tại |
| 409 | `ConflictError` | Trùng lặp dữ liệu | Email đã được đăng ký |
| 500 | `ErrorResponse(msg, 500, code)` | Lỗi server không lường trước | DB timeout, service lỗi |

### Pattern xử lý lỗi chuẩn

```typescript
} catch (error) {
  // 1. Trích xuất message an toàn
  const message = error instanceof Error ? error.message : "Thao tác thất bại";

  // 2. Phân loại lỗi dựa trên message từ Service
  if (message.includes("đã được sử dụng")) {
    next(new ConflictError(message));
  } else if (message.includes("vô hiệu hóa")) {
    next(new ForbiddenError(message));
  } else {
    next(new BadRequestError(message));
  }
}
```

### Với lỗi server 500 (không cần parse message)
```typescript
} catch (error) {
  next(new ErrorResponse("Có lỗi xảy ra. Vui lòng thử lại sau.", 500, "INTERNAL_SERVER_ERROR"));
}
```

---

## 6. JSDoc cho mỗi hàm Controller

Mỗi hàm controller cần có JSDoc ghi rõ **HTTP method + path**:

```typescript
/**
 * POST /feature/create
 * Mô tả ngắn gọn nếu cần
 */
export const create = async (...) => { ... };
```

---

## 7. Comment bằng tiếng Việt

- Comment ngắn gọn, chỉ giải thích **tại sao** chứ không giải thích **cái gì** (code tự nói).
- Dùng comment `//` inline cho logic quan trọng bên trong hàm.
- Dùng block comment `// ---` cho phân section lớn trong file.

```typescript
// Luôn trả về response giống nhau dù email có tồn tại hay không
// để tránh email enumeration attack
```

---

## 8. Template tạo Controller mới

Khi tạo file controller cho feature mới, copy template dưới đây:

```typescript
// src/features/{feature}/{feature}.controller.ts

import { Request, Response, NextFunction } from "express";
import featureService from "./{feature}.service";
import { CreateFeatureDto, UpdateFeatureDto } from "./{feature}.dto";
import { CreatedResponse, OKResponse } from "../../shared/core/success.response";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ErrorResponse,
} from "../../shared/core/error.response";

// -----------------------------------------------------------------------------
// {FEATURE_NAME} CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

/**
 * POST /{feature}
 */
export const create = async (
  req: Request<{}, {}, CreateFeatureDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await featureService.create(req.body);
    new CreatedResponse({
      message: "Tạo thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tạo thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * GET /{feature}
 */
export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await featureService.getAll();
    new OKResponse({
      message: "Lấy danh sách thành công",
      data: result,
    }).send(res);
  } catch (error) {
    next(new ErrorResponse("Có lỗi xảy ra.", 500, "INTERNAL_SERVER_ERROR"));
  }
};

/**
 * GET /{feature}/:id
 */
export const getById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await featureService.getById(req.params.id);
    new OKResponse({
      message: "Lấy chi tiết thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tìm thấy";
    next(new NotFoundError(message));
  }
};

/**
 * PUT /{feature}/:id
 */
export const update = async (
  req: Request<{ id: string }, {}, UpdateFeatureDto>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await featureService.update(req.params.id, req.body);
    new OKResponse({
      message: "Cập nhật thành công",
      data: result,
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cập nhật thất bại";
    next(new BadRequestError(message));
  }
};

/**
 * DELETE /{feature}/:id
 */
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await featureService.delete(req.params.id);
    new OKResponse({
      message: "Xóa thành công",
    }).send(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xóa thất bại";
    next(new NotFoundError(message));
  }
};
```

---

## 9. Checklist tự kiểm tra trước khi commit

- [ ] Import `NextFunction` từ express
- [ ] Mọi hàm controller đều có tham số `next: NextFunction`
- [ ] Dùng `CreatedResponse` cho POST tạo mới, `OKResponse` cho còn lại
- [ ] **KHÔNG** tự tạo `sendSuccess` / `sendError` / `res.json()` trực tiếp
- [ ] Mọi lỗi đều được `next(new XxxError(message))`, KHÔNG dùng `res.status().json()`
- [ ] Chọn đúng Error class theo bảng HTTP status code
- [ ] Có JSDoc ghi rõ HTTP method + path cho mỗi hàm
- [ ] Controller **KHÔNG** chứa business logic
- [ ] Controller **KHÔNG** import trực tiếp Model/Repository
- [ ] Route có `authenticate` middleware → dùng `req.user!` với `!` assertion
