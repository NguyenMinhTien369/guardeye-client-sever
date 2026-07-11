// src/modules/auth/auth.service.ts

import crypto from "crypto";
import authRepository from "./auth.repository";
import jwtService from "../../shared/utils/jwt.util";
import {
  RegisterRequestDto,
  LoginRequestDto,
  UserResponseDto,
  RegisterResponseDto,
  LoginResponseDto,
} from "./auth.dto";
import { IUser } from "./auth.model";

// -----------------------------------------------------------------------------
// AUTH SERVICE
// Chứa toàn bộ business logic của luồng xác thực.
// Không tương tác trực tiếp với DB — đó là việc của Repository.
// Không xử lý HTTP request/response — đó là việc của Controller.
// -----------------------------------------------------------------------------

const PASSWORD_RESET_EXPIRES_MS = 15 * 60 * 1000;

class AuthService {
  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Map IUser document sang UserResponseDto thuần túy.
   * Tập trung logic transform ở một chỗ, tránh lặp code ở nhiều nơi.
   */
  private toUserResponse(user: IUser): UserResponseDto {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      notificationEmail: user.notificationEmail,
      notifications: user.notifications,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Tạo token ngẫu nhiên dạng hex dùng cho email verify và reset password.
   * crypto.randomBytes là cryptographically secure — an toàn hơn Math.random().
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // ---------------------------------------------------------------------------
  // REGISTER
  // ---------------------------------------------------------------------------

  async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    // 1. Kiểm tra email đã tồn tại chưa
    const existingUser = await authRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error("Email này đã được sử dụng");
    }

    // 2. Tách confirmPassword ra — không lưu vào DB
    const { confirmPassword, ...userData } = dto;

    // 3. Tạo user mới (password sẽ được hash bởi pre-save hook trong Model)
    const newUser = await authRepository.createUser(userData);

    // 4. Tạo và lưu email verify token
    const verifyToken = this.generateSecureToken();
    await authRepository.setEmailVerifyToken(
      newUser._id.toString(),
      verifyToken,
    );

    // 5. TODO: Gửi email xác thực kèm verifyToken
    // await emailService.sendVerificationEmail(newUser.email, verifyToken);

    return {
      user: this.toUserResponse(newUser),
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.",
    };
  }

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    // 1. Tìm user kèm password (select: false nên phải dùng method riêng)
    const user = await authRepository.findByEmailWithPassword(dto.email);

    // 2. Trả về cùng một thông báo lỗi dù sai email hay sai password
    //    để tránh attacker dò được email nào đã tồn tại trong hệ thống
    const INVALID_CREDENTIALS_MSG = "Email hoặc mật khẩu không chính xác";

    if (!user) {
      throw new Error(INVALID_CREDENTIALS_MSG);
    }

    // 3. Kiểm tra tài khoản có đang hoạt động không
    if (!user.isActive) {
      throw new Error("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.");
    }

    // 4. So sánh mật khẩu qua instance method của Model
    const isPasswordValid = await user.comparePassword(dto.password);
    if (!isPasswordValid) {
      throw new Error(INVALID_CREDENTIALS_MSG);
    }

    // 5. Cập nhật lastLoginAt bất đồng bộ — không cần await vì không ảnh hưởng response
    authRepository.updateLastLogin(user._id.toString()).catch((err) => {
      console.error("[AuthService] Không thể cập nhật lastLoginAt:", err);
    });

    // 6. Cấp cặp token: access token (15 phút) + refresh token (7 ngày)
    //    issueTokenPair đồng thời lưu tokenId vào DB, vô hiệu hóa session cũ nếu có
    const { accessToken, refreshToken } = await jwtService.issueTokenPair(
      user._id.toString(),
    );

    return {
      user: this.toUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  // ---------------------------------------------------------------------------
  // REFRESH TOKEN
  // ---------------------------------------------------------------------------

  /**
   * Cấp lại cặp token mới từ refresh token còn hiệu lực.
   * Áp dụng token rotation — mỗi lần refresh là một cặp token hoàn toàn mới.
   *
   * @throws Error nếu refresh token hết hạn, không hợp lệ, hoặc đã bị revoke
   */
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Toàn bộ logic verify + rotation nằm trong jwtService
    return jwtService.refreshTokens(refreshToken);
  }

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------

  /**
   * Đăng xuất: thu hồi refresh token của user.
   * Access token vẫn còn hiệu lực đến khi hết hạn tự nhiên (15 phút).
   * Client có trách nhiệm xóa cả hai token phía local storage / cookie.
   */
  async logout(userId: string): Promise<void> {
    await jwtService.revokeRefreshToken(userId);
  }

  // ---------------------------------------------------------------------------
  // EMAIL VERIFICATION
  // ---------------------------------------------------------------------------

  async verifyEmail(token: string): Promise<void> {
    const user = await authRepository.findByEmailVerifyToken(token);

    if (!user) {
      throw new Error("Token xác thực không hợp lệ hoặc đã hết hạn");
    }

    if (user.emailVerified) {
      throw new Error("Email này đã được xác thực trước đó");
    }

    await authRepository.verifyEmail(user._id.toString());
  }

  // ---------------------------------------------------------------------------
  // FORGOT PASSWORD
  // ---------------------------------------------------------------------------

  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findByEmail(email);

    // Không throw lỗi khi không tìm thấy email — tránh email enumeration attack.
    // Client luôn nhận được response thành công giống nhau.
    if (!user) return;

    const resetToken = this.generateSecureToken();
    const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);

    await authRepository.setPasswordResetToken(
      user._id.toString(),
      resetToken,
      expires,
    );

    // TODO: Gửi email reset password kèm resetToken
    // await emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  // ---------------------------------------------------------------------------
  // RESET PASSWORD
  // ---------------------------------------------------------------------------

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await authRepository.findByPasswordResetToken(token);

    if (!user) {
      throw new Error("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }

    // Repository.resetPassword dùng findById + save để trigger pre-save hook hash password
    await authRepository.resetPassword(user._id.toString(), newPassword);
  }

  // ---------------------------------------------------------------------------
  // PROFILE & SETTINGS
  // ---------------------------------------------------------------------------

  async updateProfile(userId: string, data: any): Promise<any> {
    const updatedUser = await authRepository.updateProfile(userId, data);
    if (!updatedUser) throw new Error("Người dùng không tồn tại");
    return this.toUserResponse(updatedUser);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await authRepository.findByIdWithRefreshTokenId(userId); // Need a way to get user with password, let's use findByEmailWithPassword
    if (!user) throw new Error("Người dùng không tồn tại");
    
    const userWithPassword = await authRepository.findByEmailWithPassword(user.email);
    if (!userWithPassword) throw new Error("Người dùng không tồn tại");

    const isMatch = await userWithPassword.comparePassword(oldPassword);
    if (!isMatch) {
      throw new Error("Mật khẩu hiện tại không đúng");
    }

    await authRepository.changePassword(userId, newPassword);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<any> {
    // Return relative url or full url depending on config
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const updatedUser = await authRepository.updateAvatar(userId, avatarUrl);
    if (!updatedUser) throw new Error("Người dùng không tồn tại");
    return this.toUserResponse(updatedUser);
  }
}

export default new AuthService();
