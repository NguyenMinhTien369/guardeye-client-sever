import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

// -----------------------------------------------------------------------------
// 1. ĐỊNH NGHĨA INTERFACE (TYPESCRIPT)
// -----------------------------------------------------------------------------

interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUser extends Document, IUserMethods {
  email: string;
  password?: string;
  name: string;
  avatarUrl: string | null;
  notificationEmail: string | null;
  notifications: {
    email: boolean;
    browser: boolean;
  };
  isActive: boolean;
  emailVerified: boolean;
  emailVerifyToken: string | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  lastLoginAt: Date | null;

  // [MỚI] ID định danh refresh token hiện tại của user.
  // Mỗi lần login hoặc refresh token → cập nhật field này.
  // Khi logout → set về null để vô hiệu hóa token cũ ngay lập tức.
  // Cơ chế này cho phép revoke token trên một thiết bị mà không ảnh hưởng thiết bị khác
  // vì mỗi refresh token đều mang tokenId riêng, khớp với field này mới được chấp nhận.
  refreshTokenId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -----------------------------------------------------------------------------
// 2. SCHEMA
// -----------------------------------------------------------------------------

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Định dạng email không hợp lệ"],
    },
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minlength: [8, "Mật khẩu phải có ít nhất 8 ký tự"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Tên là bắt buộc"],
      trim: true,
      minlength: [2, "Tên phải có ít nhất 2 ký tự"],
      maxlength: [50, "Tên không được vượt quá 50 ký tự"],
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    notificationEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Định dạng email thông báo không hợp lệ"],
    },
    notifications: {
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      default: null,
      index: { sparse: true },
    },
    passwordResetToken: {
      type: String,
      default: null,
      index: { sparse: true },
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },

    // [MỚI] Lưu tokenId của refresh token hợp lệ hiện tại.
    // select: false — không bao giờ trả về client, chỉ dùng nội bộ để verify.
    refreshTokenId: {
      type: String,
      default: null,
      select: false,
      index: { sparse: true },
    },
  },
  {
    timestamps: true,
  },
);

// -----------------------------------------------------------------------------
// 3. HOOKS
// -----------------------------------------------------------------------------

userSchema.pre("save", async function (this: any) {
  if (!this.isModified("password") || !this.password) return;

  const saltRound = 10;
  const salt = await bcrypt.genSalt(saltRound);
  this.password = await bcrypt.hash(this.password, salt);
});

// -----------------------------------------------------------------------------
// 4. INSTANCE METHODS
// -----------------------------------------------------------------------------

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// -----------------------------------------------------------------------------
// 5. DATA TRANSFORM
// -----------------------------------------------------------------------------

userSchema.set("toJSON", {
  transform: (doc, ret: Record<string, any>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.emailVerifyToken;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    // [MỚI] refreshTokenId cũng không được trả ra ngoài
    delete ret.refreshTokenId;
    return ret;
  },
});

// -----------------------------------------------------------------------------
// 6. EXPORT
// -----------------------------------------------------------------------------

const User = mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
