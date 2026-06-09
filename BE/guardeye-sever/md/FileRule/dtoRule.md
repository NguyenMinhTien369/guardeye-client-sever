# DTO Rule — Quy tắc viết DTO trong GuardEye

> **Mục đích:** Checklist và hướng dẫn để mọi file DTO trong dự án đều nhất quán, type-safe và không bị thiếu sót.
>
> **File tham chiếu mẫu:** `src/features/auth/auth.dto.ts`

---

## 1. Nguyên tắc cốt lõi

DTO (Data Transfer Object) **CHỈ** làm một việc duy nhất:

> **Định nghĩa hình dạng (shape) của dữ liệu** đi vào và đi ra khỏi tầng Service.

| Việc DTO làm ✅ | Việc DTO KHÔNG làm ❌ |
|---|---|
| Khai báo interface TypeScript | Validate dữ liệu (đó là việc của `validation.ts`) |
| Định nghĩa kiểu dữ liệu cho request body | Chứa logic xử lý |
| Định nghĩa kiểu dữ liệu cho response | Import Mongoose Model |
| Export để các layer khác dùng | Chứa class, decorator hay decorator metadata |

---

## 2. Cấu trúc file bắt buộc

Mỗi file DTO phải được chia thành **2 section rõ ràng**, theo đúng thứ tự:

```
1. REQUEST DTOs   — shape của dữ liệu đầu vào (từ client → server)
2. RESPONSE DTOs  — shape của dữ liệu đầu ra (từ server → client)
```

### Ví dụ chuẩn (`auth.dto.ts`)

```typescript
// src/features/auth/auth.dto.ts

// -----------------------------------------------------------------------------
// AUTH DTO - Định nghĩa cấu trúc dữ liệu cho các luồng xác thực
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  notificationEmail?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// Thông tin User an toàn để trả về client — không chứa password hay token nhạy cảm
export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  notificationEmail: string | null;
  notifications: {
    email: boolean;
    browser: boolean;
  };
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterResponseDto {
  user: UserResponseDto;
  message: string;
}

export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}
```

---

## 3. Quy tắc đặt tên

### 3.1 Request DTOs

| Loại action | Pattern đặt tên | Ví dụ |
|---|---|---|
| Tạo mới | `Create{Entity}RequestDto` | `CreateChildRequestDto` |
| Cập nhật | `Update{Entity}RequestDto` | `UpdateChildRequestDto` |
| Đăng ký | `RegisterRequestDto` | `RegisterRequestDto` |
| Đăng nhập | `LoginRequestDto` | `LoginRequestDto` |
| Xóa (nếu có body) | `Delete{Entity}RequestDto` | `DeleteDeviceRequestDto` |
| Query params | `{Entity}QueryRequestDto` | `ChildQueryRequestDto` |

### 3.2 Response DTOs

| Loại response | Pattern đặt tên | Ví dụ |
|---|---|---|
| Single entity | `{Entity}ResponseDto` | `ChildResponseDto` |
| Wrapped (có message) | `{Action}ResponseDto` | `RegisterResponseDto` |
| Danh sách có phân trang | `{Entity}ListResponseDto` | `ChildListResponseDto` |

---

## 4. Quy tắc kiểu dữ liệu

### 4.1 Request DTO

- **Trường bắt buộc:** Không có `?` — bắt lỗi từ TypeScript ngay khi compile
- **Trường tuỳ chọn:** Dùng `?` (`field?: type`)
- **Chỉ dùng kiểu nguyên thủy:** `string`, `number`, `boolean`, không dùng Mongoose ObjectId

```typescript
// ✅ Đúng
export interface CreateChildRequestDto {
  name: string;       // bắt buộc
  age: number;        // bắt buộc
  avatar?: string;    // tuỳ chọn
}

// ❌ Sai — dùng mongoose type trong DTO
export interface CreateChildRequestDto {
  name: string;
  parentId: ObjectId; // KHÔNG dùng ObjectId trong DTO
}
```

### 4.2 Response DTO

- **`id`:** Luôn là `string` (không phải `ObjectId`)
- **`createdAt` / `updatedAt`:** Luôn là `Date`
- **Nullable fields:** Dùng `field: Type | null` (không dùng `field?: Type`)
- **Trường nhạy cảm:** **KHÔNG** đưa vào Response DTO (password, token, hash...)
- **Foreign key:** Dùng `string` để biểu diễn ObjectId (ví dụ: `parentId: string`)

```typescript
// ✅ Đúng
export interface ChildResponseDto {
  id: string;           // _id đã được map sang id (string)
  parentId: string;     // ObjectId → string
  name: string;
  age: number;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}

// ❌ Sai
export interface ChildResponseDto {
  _id: string;              // KHÔNG dùng _id, phải map sang id
  password: string;         // KHÔNG đưa trường nhạy cảm vào Response DTO
  lastLoginAt?: Date;       // Dùng | null thay vì ? cho nullable
}
```

---

## 5. Nested objects trong DTO

Nếu có nested object, khai báo **inline** trong interface:

```typescript
// ✅ Đúng — nested object inline
export interface UserResponseDto {
  notifications: {
    email: boolean;
    browser: boolean;
  };
}
```

Nếu nested object được dùng **ở nhiều nơi**, tách thành interface riêng:

```typescript
// ✅ Đúng — tách riêng khi dùng nhiều chỗ
export interface NotificationSettingsDto {
  email: boolean;
  browser: boolean;
}

export interface UserResponseDto {
  notifications: NotificationSettingsDto;
}
```

---

## 6. Update DTO — Tất cả trường phải là optional

Khi viết DTO cho hành động update (PATCH/PUT), **tất cả trường phải là `optional`**:

```typescript
// ✅ Đúng — Update DTO: mọi trường đều optional
export interface UpdateChildRequestDto {
  name?: string;
  age?: number;
  avatar?: string;
}

// ❌ Sai — bắt buộc tất cả trường sẽ gây lỗi khi client chỉ cập nhật một phần
export interface UpdateChildRequestDto {
  name: string;   // Sai: client không thể chỉ update age
  age: number;
}
```

> **Lý do:** `UpdateDto` phải cho phép client gửi lên chỉ các trường cần cập nhật (partial update).

---

## 7. Comment header bắt buộc

Mỗi file DTO cần có **comment header** theo format chuẩn:

```typescript
// src/features/{feature}/{feature}.dto.ts

// -----------------------------------------------------------------------------
// {FEATURE} DTO - Định nghĩa cấu trúc dữ liệu cho [mô tả ngắn]
// -----------------------------------------------------------------------------
```

Mỗi section cũng cần comment phân cách:

```typescript
// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

// ... interfaces ...

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// ... interfaces ...
```

---

## 8. Quan hệ DTO với các layer khác

```
Validation (.validation.ts)
  └─ Import schema type từ DTO để type-safe
  
Controller (.controller.ts)
  └─ Import Request DTO → Request<{}, {}, CreateXxxRequestDto>
  
Service (.service.ts)
  └─ Import cả Request DTO (đầu vào) và Response DTO (đầu ra)
  └─ Hàm private toResponseDto() map Model → Response DTO
  
Repository (.repository.ts)
  └─ Có thể import Request DTO nếu cần làm tham số hàm create/update
```

> **Quy tắc vàng:** DTO đi từ trên (Controller) xuống dưới (Repository). Chiều ngược lại — Repository/Model **không** được import DTO.

---

## 9. Template tạo DTO mới

Khi tạo feature mới, copy template sau và điền thông tin:

```typescript
// src/features/{feature}/{feature}.dto.ts

// -----------------------------------------------------------------------------
// {FEATURE} DTO - Định nghĩa cấu trúc dữ liệu cho [mô tả]
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

export interface Create{Entity}RequestDto {
  // Các trường bắt buộc (không có ?)
  fieldA: string;
  fieldB: number;

  // Các trường tuỳ chọn (có ?)
  fieldC?: string;
}

export interface Update{Entity}RequestDto {
  // Tất cả trường đều optional khi update
  fieldA?: string;
  fieldB?: number;
  fieldC?: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// Shape an toàn để trả về client — không chứa các trường nhạy cảm
export interface {Entity}ResponseDto {
  id: string;           // _id đã map sang id string
  // foreign keys dạng string
  // các trường data
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 10. Prompt Template cho AI

Khi cần AI viết file DTO, cung cấp prompt sau:

---

**Đóng vai:** Bạn là Senior Back-end Developer làm việc với Node.js, Express, MongoDB và TypeScript.

**Nhiệm vụ:** Viết file DTO cho feature `[TÊN FEATURE]` theo đúng chuẩn dự án.

**Yêu cầu bắt buộc:**
- File có 2 section: `1. REQUEST DTOs` và `2. RESPONSE DTOs`
- Chỉ dùng `interface` TypeScript, không dùng `class` hay `type`
- Request DTO: trường bắt buộc không có `?`, trường tuỳ chọn có `?`
- Update DTO: **TẤT CẢ** trường phải là `optional` (`?`)
- Response DTO: `id: string` (không phải `_id`), không có trường nhạy cảm, `createdAt: Date`, `updatedAt: Date`
- Foreign key (ObjectId) viết dưới dạng `string` (ví dụ: `parentId: string`)
- Nullable field dùng `Type | null`, không dùng `?` trong Response DTO
- Comment header chuẩn theo format `// ----`

**Thông tin feature:**
- **Tên entity:** `[Tên - ví dụ: Device]`
- **Các trường đầu vào (Create):** `[Danh sách - ví dụ: childId, deviceName, deviceToken]`
- **Các trường đầu vào (Update):** `[Danh sách - ví dụ: deviceName, isActive]`
- **Các trường response trả về client:** `[Danh sách - ví dụ: id, childId, deviceName, isActive, createdAt, updatedAt]`
- **Trường nhạy cảm KHÔNG trả về:** `[Danh sách - ví dụ: deviceToken, secretKey]`
- **Yêu cầu đặc biệt:** `[Nếu có - ví dụ: có thêm wrapper RegisterResponseDto bao ngoài]`

---

## 11. Checklist tự kiểm tra trước khi commit

- [ ] File có đúng 2 section: REQUEST DTOs và RESPONSE DTOs
- [ ] Comment header đúng format `// ----`
- [ ] Tên interface đúng convention (`Create`, `Update`, `Response`)
- [ ] Update DTO — tất cả trường đều có `?`
- [ ] Response DTO có `id: string` (không phải `_id`)
- [ ] Response DTO **không** chứa trường nhạy cảm (`password`, `token`, `hash`...)
- [ ] Foreign key dùng `string` không dùng `ObjectId`
- [ ] Nullable field dùng `Type | null` không dùng `?` trong Response DTO
- [ ] `createdAt: Date` và `updatedAt: Date` có trong Response DTO
- [ ] Chỉ dùng `interface`, không dùng `class` hay `type alias`
- [ ] Mọi interface đều được `export`
- [ ] Không import Mongoose, không import Model
