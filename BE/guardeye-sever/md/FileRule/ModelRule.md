# Model Rule — Quy tắc viết Mongoose Model trong GuardEye

> **Mục đích:** Checklist và hướng dẫn để mọi file Model trong dự án đều nhất quán, type-safe, bảo mật và không bị thiếu sót.
>
> **File tham chiếu mẫu:** `src/features/auth/auth.model.ts`

---

## 1. Nguyên tắc cốt lõi

Model **CHỈ** làm 3 việc:

| Bước | Mô tả |
|------|-------|
| ① Định nghĩa shape | Khai báo interface TypeScript, schema Mongoose |
| ② Bảo vệ dữ liệu | Hooks, validation, `select: false` cho trường nhạy cảm |
| ③ Transform output | `toJSON` để loại bỏ trường nhạy cảm khi trả về client |

> **KHÔNG BAO GIỜ** viết business logic, gọi service, hay tạo HTTP response bên trong Model.

---

## 2. Cấu trúc file bắt buộc — 6 section theo thứ tự

```
1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
2. SCHEMA
3. HOOKS                    ← chỉ khi có logic pre/post save
4. INSTANCE METHODS         ← chỉ khi cần method riêng của document
5. DATA TRANSFORM (toJSON)  ← BẮT BUỘC, dù đơn giản đến đâu
6. EXPORT
```

### Comment phân cách giữa các section:

```typescript
// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

// ...

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

// ...
```

---

## 3. Section 1 — Interface TypeScript

### 3.1 Quy tắc đặt tên interface

| Thành phần | Pattern | Ví dụ |
|---|---|---|
| Interface chính | `I{ModelName}` | `IUser`, `IChild`, `IDevice` |
| Interface methods | `I{ModelName}Methods` | `IUserMethods` |
| Type alias Model | `{ModelName}Model` | `UserModel`, `ChildModel` |

### 3.2 Interface chính — bắt buộc kế thừa `Document`

```typescript
export interface IUser extends Document, IUserMethods {
  // Các trường dữ liệu
  email: string;
  name: string;

  // Trường nhạy cảm — thêm ? vì select: false
  password?: string;

  // Nullable fields — dùng | null
  lastLoginAt: Date | null;

  // Timestamps — BẮT BUỘC khai báo khi dùng timestamps: true
  createdAt: Date;
  updatedAt: Date;
}
```

> **Lưu ý quan trọng:**
> - `createdAt` và `updatedAt` phải được khai báo trong interface khi bật `timestamps: true`
> - Trường có `select: false` trong schema → thêm `?` trong interface (ví dụ: `password?: string`)
> - Nullable field → dùng `Type | null`, không dùng `?`

### 3.3 Interface methods (chỉ khi cần instance method)

```typescript
// Khai báo riêng — sau đó merge vào interface chính
interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUser extends Document, IUserMethods {
  // ...
}
```

Nếu không có instance method:

```typescript
// Không cần IUserMethods — interface đơn giản hơn
export interface IChild extends Document {
  name: string;
  age: number;
}

type ChildModel = Model<IChild>;
```

### 3.4 Type alias Model

```typescript
// Khi có instance methods
type UserModel = Model<IUser, {}, IUserMethods>;

// Khi không có instance methods
type ChildModel = Model<IChild>;
```

---

## 4. Section 2 — Schema

### 4.1 Khai báo Schema với generic types

```typescript
// Có instance methods
const userSchema = new Schema<IUser, UserModel, IUserMethods>({ ... }, { timestamps: true });

// Không có instance methods
const childSchema = new Schema<IChild, ChildModel>({ ... }, { timestamps: true });
```

> `timestamps: true` — **BẮT BUỘC** cho mọi schema, đặt trong options (tham số thứ 2).

### 4.2 Cấu hình các loại trường

#### String thông thường:
```typescript
name: {
  type: String,
  required: [true, "Tên là bắt buộc"],
  trim: true,
  minlength: [2, "Tên phải có ít nhất 2 ký tự"],
  maxlength: [50, "Tên không được vượt quá 50 ký tự"],
},
```

#### String có format (email, url...):
```typescript
// Khai báo Regex ngoài schema để tái sử dụng
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

email: {
  type: String,
  required: [true, "Email là bắt buộc"],
  unique: true,
  trim: true,
  lowercase: true,
  match: [EMAIL_REGEX, "Định dạng email không hợp lệ"],
},
```

#### String nhạy cảm (không trả về client):
```typescript
password: {
  type: String,
  required: [true, "Mật khẩu là bắt buộc"],
  minlength: [8, "Mật khẩu phải có ít nhất 8 ký tự"],
  select: false,    // ← BẮT BUỘC cho mọi trường nhạy cảm
},
```

#### Number:
```typescript
age: {
  type: Number,
  required: [true, "Tuổi là bắt buộc"],
  min: [0, "Tuổi không được nhỏ hơn 0"],
  max: [18, "Tuổi không được lớn hơn 18"],
},
```

#### Boolean có default:
```typescript
isActive: {
  type: Boolean,
  default: true,
  index: true,      // index nếu hay dùng để filter
},
```

#### Nullable String (default null):
```typescript
lastLoginToken: {
  type: String,
  default: null,
},
```

#### ObjectId — liên kết với model khác:
```typescript
parentId: {
  type: Schema.Types.ObjectId,
  ref: "User",              // tên Model tham chiếu
  required: [true, "Parent ID là bắt buộc"],
  index: true,              // index vì thường dùng để filter
},
```

#### Nested object:
```typescript
notifications: {
  email: { type: Boolean, default: true },
  browser: { type: Boolean, default: true },
},
```

### 4.3 Quy tắc message lỗi

- **required:** `"[Tên trường] là bắt buộc"` → ví dụ: `"Email là bắt buộc"`
- **minlength:** `"[Tên trường] phải có ít nhất X ký tự"` → ví dụ: `"Tên phải có ít nhất 2 ký tự"`
- **maxlength:** `"[Tên trường] không được vượt quá X ký tự"`
- **min/max (số):** `"[Tên trường] không được nhỏ hơn/lớn hơn X"`
- **match:** `"Định dạng [tên trường] không hợp lệ"`

### 4.4 Quy tắc Index

| Trường | Khi nào đánh index |
|---|---|
| `unique: true` | Tự động có index |
| Foreign key (ObjectId) | `index: true` — vì hay dùng để query |
| Trường thường filter (`isActive`, `status`) | `index: true` |
| Token/code có thể null | `index: { sparse: true }` — chỉ index document có giá trị |
| Trường nội bộ, ít query | Không cần index |

```typescript
// sparse index — dùng khi trường thường null và chỉ query khi không null
emailVerifyToken: {
  type: String,
  default: null,
  index: { sparse: true },
},
```

---

## 5. Section 3 — Hooks (chỉ khi có nghiệp vụ)

Dùng hook khi cần xử lý **tự động trước khi lưu**, ví dụ: hash password, tạo slug.

```typescript
// ✅ Ví dụ chuẩn: pre-save hash password
userSchema.pre("save", async function (this: any) {
  // Guard: chỉ hash khi password thực sự bị thay đổi
  if (!this.isModified("password") || !this.password) return;

  const saltRound = 10;
  const salt = await bcrypt.genSalt(saltRound);
  this.password = await bcrypt.hash(this.password, salt);
});
```

> **Lưu ý:** Dùng `this.isModified("field")` để tránh hash lại khi update các trường khác.

Nếu không có nghiệp vụ cần hook → **bỏ qua section này hoàn toàn**.

---

## 6. Section 4 — Instance Methods (chỉ khi cần)

Dùng instance method khi cần hàm xử lý **liên quan trực tiếp đến dữ liệu của document**.

```typescript
// ✅ Ví dụ chuẩn: so sánh password
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};
```

Nếu không có nghiệp vụ cần instance method → **bỏ qua section này hoàn toàn**.

---

## 7. Section 5 — Data Transform (toJSON) — BẮT BUỘC

**Mọi schema đều PHẢI có `toJSON` transform**, dù đơn giản hay phức tạp.

### 7.1 Transform tối thiểu (không có trường nhạy cảm):

```typescript
// ✅ Dùng cho model đơn giản như Child, Device...
childSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;   // Map _id → id
    delete ret._id;     // Xóa _id gốc
    delete ret.__v;     // Xóa version key của Mongoose
    return ret;
  },
});
```

### 7.2 Transform đầy đủ (có trường nhạy cảm):

```typescript
// ✅ Dùng cho model có trường nhạy cảm như User
userSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Xóa tất cả trường nhạy cảm — không bao giờ để lọt ra ngoài
    delete ret.password;
    delete ret.emailVerifyToken;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.refreshTokenId;
    return ret;
  },
});
```

> **Quy tắc vàng:** Mọi trường có `select: false` trong schema → **PHẢI** bị `delete` trong `toJSON` transform.

---

## 8. Section 6 — Export

```typescript
// Luôn đặt cuối file, sau tất cả các section
const User = mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
```

> **Chỉ `export default` model** — interface `IUser` đã được `export` trực tiếp ở trên để các file khác import type.

---

## 9. Quy tắc Import

```typescript
// BẮT BUỘC — luôn import đủ 3 thành phần từ mongoose
import mongoose, { Document, Schema, Model } from "mongoose";

// Import thư viện xử lý (chỉ khi dùng trong hook/method)
import bcrypt from "bcryptjs";
```

---

## 10. Template tạo Model mới

### Template đơn giản (không có Hook, không có Instance Method):

```typescript
import mongoose, { Document, Schema, Model } from "mongoose";

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

export interface I{Entity} extends Document {
  // Foreign key (nếu có)
  parentId: mongoose.Types.ObjectId;

  // Các trường dữ liệu
  fieldA: string;
  fieldB: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type {Entity}Model = Model<I{Entity}>;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const {entity}Schema = new Schema<I{Entity}, {Entity}Model>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "{ParentModel}",
      required: [true, "Parent ID là bắt buộc"],
      index: true,
    },
    fieldA: {
      type: String,
      required: [true, "FieldA là bắt buộc"],
      trim: true,
      minlength: [2, "FieldA phải có ít nhất 2 ký tự"],
      maxlength: [100, "FieldA không được vượt quá 100 ký tự"],
    },
    fieldB: {
      type: Number,
      required: [true, "FieldB là bắt buộc"],
      min: [0, "FieldB không được nhỏ hơn 0"],
    },
  },
  {
    timestamps: true,
  }
);

// -----------------------------------------------------------------------------
// 3. DATA TRANSFORM
// -----------------------------------------------------------------------------

{entity}Schema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 4. EXPORT
// -----------------------------------------------------------------------------

const {Entity} = mongoose.model<I{Entity}, {Entity}Model>("{Entity}", {entity}Schema);

export default {Entity};
```

### Template đầy đủ (có Hook + Instance Method + trường nhạy cảm):

Tham khảo trực tiếp `src/features/auth/auth.model.ts`.

---

## 11. Prompt Template cho AI

Khi cần AI viết file Model, cung cấp prompt sau:

---

**Đóng vai:** Bạn là Senior Back-end Developer chuyên Node.js, Express, MongoDB và TypeScript.

**Nhiệm vụ:** Viết file Mongoose Model cho entity `[TÊN ENTITY]` theo đúng chuẩn dự án.

**Yêu cầu bắt buộc:**
- Cấu trúc 6 section theo thứ tự: Interface → Schema → Hooks → Instance Methods → toJSON → Export
- Bỏ qua section Hooks nếu không có nghiệp vụ pre/post save
- Bỏ qua section Instance Methods nếu không cần method riêng
- Interface `I{Entity}` kế thừa `Document` (và `I{Entity}Methods` nếu có method)
- `timestamps: true` trong Schema options
- Mọi trường `required` phải có message lỗi tiếng Việt: `[true, "Tên trường là bắt buộc"]`
- Trường nhạy cảm có `select: false`
- Trường hay dùng để filter có `index: true`, token nullable có `index: { sparse: true }`
- `toJSON` transform: map `_id → id`, xóa `__v`, xóa mọi trường nhạy cảm
- Trường có `select: false` phải thêm `?` trong interface TypeScript
- Chỉ `export default` model; interface được `export` trực tiếp
- Comment section bằng `// ---` dashes style

**Thông tin entity:**
- **Tên entity:** `[Tên - ví dụ: Device]`
- **Các trường dữ liệu:** `[Danh sách - ví dụ: childId (ObjectId ref Child), deviceName (String), deviceToken (String nhạy cảm), isActive (Boolean default true)]`
- **Trường nhạy cảm (cần select:false + xóa khỏi toJSON):** `[Danh sách - ví dụ: deviceToken]`
- **Trường cần index:** `[Danh sách - ví dụ: childId (index), isActive (index)]`
- **Hooks cần thiết:** `[Mô tả hoặc "Không có"]`
- **Instance methods cần thiết:** `[Mô tả hoặc "Không có"]`
- **Yêu cầu đặc biệt:** `[Nếu có]`

---

## 12. Checklist tự kiểm tra trước khi commit

- [ ] Import đủ `mongoose, { Document, Schema, Model }` từ `"mongoose"`
- [ ] Interface `I{Entity}` khai báo `extends Document`
- [ ] Interface có khai báo `createdAt: Date` và `updatedAt: Date`
- [ ] Trường có `select: false` → thêm `?` trong interface (`password?: string`)
- [ ] Nullable field dùng `Type | null` trong interface
- [ ] Schema có `{ timestamps: true }` trong options
- [ ] Mọi `required` có message lỗi tiếng Việt dạng array `[true, "..."]`
- [ ] Mọi `minlength/maxlength/min/max` có message lỗi tiếng Việt dạng array `[value, "..."]`
- [ ] Trường nhạy cảm có `select: false`
- [ ] Foreign key ObjectId dùng `Schema.Types.ObjectId` + `ref: "ModelName"` + `index: true`
- [ ] Token/code nullable dùng `index: { sparse: true }`
- [ ] `toJSON` transform: có `ret.id = ret._id`, `delete ret._id`, `delete ret.__v`
- [ ] `toJSON` transform: xóa **tất cả** trường nhạy cảm (`select: false`)
- [ ] Chỉ `export default` model ở cuối file
- [ ] Interface được `export` trực tiếp (không qua `export default`)
- [ ] Section Hooks **không có** → xóa hẳn section, không để trống
- [ ] Section Instance Methods **không có** → xóa hẳn section, không để trống
