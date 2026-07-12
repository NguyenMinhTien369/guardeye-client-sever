// src/modules/auth/auth.repository.ts

import User, { IUser } from "./auth.model";
import { RegisterRequestDto } from "./auth.dto";

// -----------------------------------------------------------------------------
// AUTH REPOSITORY
// Chịu trách nhiệm duy nhất: tương tác với database thông qua Mongoose Model.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

export class AuthRepository {
  // ---------------------------------------------------------------------------
  // WRITE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tạo user mới từ dữ liệu đã được validate và xử lý ở Service.
   * Service sẽ bỏ confirmPassword trước khi truyền vào đây.
   */
  async createUser(
    data: Omit<RegisterRequestDto, "confirmPassword">,
  ): Promise<IUser> {
    const user = new User(data);
    return user.save();
  }

  /**
   * Cập nhật thời điểm đăng nhập gần nhất.
   * Dùng $set thay vì findById + save để tránh trigger pre-save hook hash lại password.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { lastLoginAt: new Date() },
    });
  }

  /**
   * Lưu token xác thực email vào user.
   */
  async setEmailVerifyToken(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { emailVerifyToken: token },
    });
  }

  /**
   * Xác thực email thành công: bật cờ emailVerified và xóa token đi.
   */
  async verifyEmail(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { emailVerified: true },
      $unset: { emailVerifyToken: "" },
    });
  }

  /**
   * Lưu token và thời hạn reset password.
   */
  async setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });
  }

  /**
   * Cập nhật mật khẩu mới và xóa reset token.
   * QUAN TRỌNG: Dùng findById + save (thay vì findByIdAndUpdate) để
   * trigger pre-save hook tự động hash password mới trong Model.
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) return;

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();
  }

  /**
   * Cập nhật thông tin profile
   */
  async updateProfile(userId: string, data: any): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, { $set: data }, { new: true });
  }

  /**
   * Cập nhật ảnh đại diện
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, { $set: { avatarUrl } }, { new: true });
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) return;
    user.password = newPassword;
    await user.save();
  }

  // ---------------------------------------------------------------------------
  // [MỚI] REFRESH TOKEN OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Lưu tokenId của refresh token vào DB.
   *
   * Được gọi sau mỗi lần:
   *   - Login thành công
   *   - Refresh token thành công (rotation: tokenId cũ bị thay bằng tokenId mới)
   *
   * tokenId này sẽ được đối chiếu mỗi khi client dùng refresh token,
   * đảm bảo chỉ refresh token mới nhất là hợp lệ — các token cũ bị vô hiệu hóa
   * ngay cả khi chưa hết hạn (chống token reuse attack).
   */
  async saveRefreshTokenId(userId: string, tokenId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { refreshTokenId: tokenId },
    });
  }

  /**
   * Xóa refreshTokenId khỏi DB — dùng khi logout.
   *
   * Sau khi xóa, mọi refresh token của user này đều trở nên vô hiệu
   * vì không còn tokenId nào để đối chiếu.
   * Dùng $unset thay vì $set: null để giữ document gọn, index sparse cũng sạch hơn.
   */
  async clearRefreshTokenId(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshTokenId: "" },
    });
  }

  // ---------------------------------------------------------------------------
  // READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Tìm user theo email — dùng cho đăng nhập và kiểm tra email trùng.
   * Mặc định KHÔNG select password (schema đã config select: false).
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase().trim() });
  }

  /**
   * Tìm user theo email và select thêm password.
   * Chỉ dùng khi cần comparePassword (luồng đăng nhập).
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password",
    );
  }

  /**
   * Tìm user theo ID — dùng phổ biến sau khi đã xác thực JWT.
   */
  async findById(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }

  /**
   * Tìm user theo ID kèm refreshTokenId để verify khi refresh token.
   * select: false nên phải select tường minh khi cần.
   */
  async findByIdWithRefreshTokenId(userId: string): Promise<IUser | null> {
    return User.findById(userId).select("+refreshTokenId");
  }

  /**
   * Tìm user theo email verify token.
   * Dùng khi user click link xác thực email.
   */
  async findByEmailVerifyToken(token: string): Promise<IUser | null> {
    return User.findOne({ emailVerifyToken: token });
  }

  /**
   * Tìm user theo reset password token và kiểm tra token chưa hết hạn.
   * $gt: new Date() — chỉ lấy token còn hiệu lực.
   */
  async findByPasswordResetToken(token: string): Promise<IUser | null> {
    return User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
  }

  /**
   * Tìm user theo email và reset password token và kiểm tra token chưa hết hạn.
   * $gt: new Date() — chỉ lấy token còn hiệu lực.
   */
  async findByEmailAndResetToken(email: string, token: string): Promise<IUser | null> {
    return User.findOne({
      email: email.toLowerCase().trim(),
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
  }
}

export default new AuthRepository();
