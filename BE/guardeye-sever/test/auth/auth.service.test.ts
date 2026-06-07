// test/auth/auth.service.test.ts

// -----------------------------------------------------------------------------
// Mock các dependency TRƯỚC KHI import module cần test
// Thứ tự này bắt buộc: Jest hoist jest.mock() lên đầu file
// -----------------------------------------------------------------------------

jest.mock("../../src/features/auth/auth.repository");
jest.mock("../../src/shared/utils/jwt.util");

import authService from "../../src/features/auth/auth.service";
import authRepository from "../../src/features/auth/auth.repository";
import jwtService from "../../src/shared/utils/jwt.util";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockRepo = authRepository as jest.Mocked<typeof authRepository>;
const mockJwt = jwtService as jest.Mocked<typeof jwtService>;

// -----------------------------------------------------------------------------
// BUILDER — tạo mock IUser object tái sử dụng được
// -----------------------------------------------------------------------------

function buildMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "user_001" },
    name: "Nguyen Van A",
    email: "test@example.com",
    notificationEmail: null,
    notifications: { email: true, browser: true },
    isActive: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    comparePassword: jest.fn(),
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: AuthService
// -----------------------------------------------------------------------------

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe("register", () => {
    const validDto = {
      name: "Nguyen Van A",
      email: "test@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
    };

    it("should return user and message when registration is successful", async () => {
      // Arrange
      mockRepo.findByEmail.mockResolvedValue(null);
      const createdUser = buildMockUser();
      mockRepo.createUser.mockResolvedValue(createdUser as any);
      mockRepo.setEmailVerifyToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.register(validDto);

      // Assert
      expect(result.user.id).toBe("user_001");
      expect(result.user.email).toBe("test@example.com");
      expect(result.message).toContain("Đăng ký thành công");
    });

    it("should throw an error when email is already in use", async () => {
      // Arrange
      mockRepo.findByEmail.mockResolvedValue(buildMockUser() as any);

      // Act & Assert
      await expect(authService.register(validDto)).rejects.toThrow(
        "Email này đã được sử dụng"
      );
    });

    it("should call createUser without confirmPassword field", async () => {
      // Arrange
      mockRepo.findByEmail.mockResolvedValue(null);
      const createdUser = buildMockUser();
      mockRepo.createUser.mockResolvedValue(createdUser as any);
      mockRepo.setEmailVerifyToken.mockResolvedValue(undefined);

      // Act
      await authService.register(validDto);

      // Assert
      const callArg = mockRepo.createUser.mock.calls[0][0];
      expect(callArg).not.toHaveProperty("confirmPassword");
    });

    it("should call setEmailVerifyToken after user is created", async () => {
      // Arrange
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.createUser.mockResolvedValue(buildMockUser() as any);
      mockRepo.setEmailVerifyToken.mockResolvedValue(undefined);

      // Act
      await authService.register(validDto);

      // Assert
      expect(mockRepo.setEmailVerifyToken).toHaveBeenCalledWith(
        "user_001",
        expect.any(String)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe("login", () => {
    const validDto = {
      email: "test@example.com",
      password: "Password1!",
    };

    it("should return user and tokens when credentials are valid", async () => {
      // Arrange
      const mockUser = buildMockUser({
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      mockRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      mockRepo.updateLastLogin.mockResolvedValue(undefined);
      mockJwt.issueTokenPair.mockResolvedValue({
        accessToken: "access_token_123",
        refreshToken: "refresh_token_456",
      });

      // Act
      const result = await authService.login(validDto);

      // Assert
      expect(result.accessToken).toBe("access_token_123");
      expect(result.refreshToken).toBe("refresh_token_456");
      expect(result.user.email).toBe("test@example.com");
    });

    it("should throw an error when email does not exist", async () => {
      // Arrange
      mockRepo.findByEmailWithPassword.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(validDto)).rejects.toThrow(
        "Email hoặc mật khẩu không chính xác"
      );
    });

    it("should throw an error when account is inactive", async () => {
      // Arrange
      const inactiveUser = buildMockUser({ isActive: false });
      mockRepo.findByEmailWithPassword.mockResolvedValue(inactiveUser as any);

      // Act & Assert
      await expect(authService.login(validDto)).rejects.toThrow(
        "Tài khoản đã bị vô hiệu hóa"
      );
    });

    it("should throw an error when password is incorrect", async () => {
      // Arrange
      const mockUser = buildMockUser({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      mockRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(authService.login(validDto)).rejects.toThrow(
        "Email hoặc mật khẩu không chính xác"
      );
    });

    it("should use the same error message for wrong email and wrong password to prevent enumeration", async () => {
      // Arrange — email không tồn tại
      mockRepo.findByEmailWithPassword.mockResolvedValue(null);

      // Act
      let errorWhenNoUser: string | undefined;
      try {
        await authService.login(validDto);
      } catch (e: any) {
        errorWhenNoUser = e.message;
      }

      // Arrange — sai password
      const mockUser = buildMockUser({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      mockRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);

      let errorWhenWrongPassword: string | undefined;
      try {
        await authService.login(validDto);
      } catch (e: any) {
        errorWhenWrongPassword = e.message;
      }

      // Assert — hai thông báo lỗi phải giống hệt nhau
      expect(errorWhenNoUser).toBe(errorWhenWrongPassword);
    });

    it("should call issueTokenPair with the user ID after successful login", async () => {
      // Arrange
      const mockUser = buildMockUser({
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      mockRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      mockRepo.updateLastLogin.mockResolvedValue(undefined);
      mockJwt.issueTokenPair.mockResolvedValue({
        accessToken: "access",
        refreshToken: "refresh",
      });

      // Act
      await authService.login(validDto);

      // Assert
      expect(mockJwt.issueTokenPair).toHaveBeenCalledWith("user_001");
    });
  });

  // ---------------------------------------------------------------------------
  // refreshTokens
  // ---------------------------------------------------------------------------

  describe("refreshTokens", () => {
    it("should return new token pair when refresh token is valid", async () => {
      // Arrange
      mockJwt.refreshTokens.mockResolvedValue({
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
      });

      // Act
      const result = await authService.refreshTokens("valid_refresh_token");

      // Assert
      expect(result.accessToken).toBe("new_access_token");
      expect(result.refreshToken).toBe("new_refresh_token");
    });

    it("should throw an error when refresh token is invalid or expired", async () => {
      // Arrange
      mockJwt.refreshTokens.mockRejectedValue(
        new Error("Refresh token không hợp lệ hoặc đã hết hạn")
      );

      // Act & Assert
      await expect(
        authService.refreshTokens("invalid_token")
      ).rejects.toThrow("Refresh token không hợp lệ hoặc đã hết hạn");
    });
  });

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  describe("logout", () => {
    it("should call revokeRefreshToken with the correct user ID", async () => {
      // Arrange
      mockJwt.revokeRefreshToken.mockResolvedValue(undefined);

      // Act
      await authService.logout("user_001");

      // Assert
      expect(mockJwt.revokeRefreshToken).toHaveBeenCalledWith("user_001");
    });

    it("should complete without error when logout is called", async () => {
      // Arrange
      mockJwt.revokeRefreshToken.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.logout("user_001")).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // verifyEmail
  // ---------------------------------------------------------------------------

  describe("verifyEmail", () => {
    it("should verify email successfully when token is valid and email is not yet verified", async () => {
      // Arrange
      const mockUser = buildMockUser({ emailVerified: false });
      mockRepo.findByEmailVerifyToken.mockResolvedValue(mockUser as any);
      mockRepo.verifyEmail.mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.verifyEmail("valid_token")).resolves.toBeUndefined();
      expect(mockRepo.verifyEmail).toHaveBeenCalledWith("user_001");
    });

    it("should throw an error when verify token is invalid or not found", async () => {
      // Arrange
      mockRepo.findByEmailVerifyToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.verifyEmail("invalid_token")).rejects.toThrow(
        "Token xác thực không hợp lệ hoặc đã hết hạn"
      );
    });

    it("should throw an error when email has already been verified", async () => {
      // Arrange
      const alreadyVerifiedUser = buildMockUser({ emailVerified: true });
      mockRepo.findByEmailVerifyToken.mockResolvedValue(
        alreadyVerifiedUser as any
      );

      // Act & Assert
      await expect(authService.verifyEmail("some_token")).rejects.toThrow(
        "Email này đã được xác thực trước đó"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // forgotPassword
  // ---------------------------------------------------------------------------

  describe("forgotPassword", () => {
    it("should resolve silently when email does not exist (prevent enumeration attack)", async () => {
      // Arrange
      mockRepo.findByEmail.mockResolvedValue(null);

      // Act & Assert — không throw dù email không tồn tại
      await expect(
        authService.forgotPassword("nonexistent@example.com")
      ).resolves.toBeUndefined();
    });

    it("should set password reset token when email exists", async () => {
      // Arrange
      const mockUser = buildMockUser();
      mockRepo.findByEmail.mockResolvedValue(mockUser as any);
      mockRepo.setPasswordResetToken.mockResolvedValue(undefined);

      // Act
      await authService.forgotPassword("test@example.com");

      // Assert
      expect(mockRepo.setPasswordResetToken).toHaveBeenCalledWith(
        "user_001",
        expect.any(String),
        expect.any(Date)
      );
    });

    it("should set reset token with an expiry date in the future", async () => {
      // Arrange
      const mockUser = buildMockUser();
      mockRepo.findByEmail.mockResolvedValue(mockUser as any);
      mockRepo.setPasswordResetToken.mockResolvedValue(undefined);

      const beforeCall = Date.now();

      // Act
      await authService.forgotPassword("test@example.com");

      // Assert
      const expiresArg = mockRepo.setPasswordResetToken.mock.calls[0][2] as Date;
      expect(expiresArg.getTime()).toBeGreaterThan(beforeCall);
    });
  });

  // ---------------------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------------------

  describe("resetPassword", () => {
    it("should reset password successfully when token is valid", async () => {
      // Arrange
      const mockUser = buildMockUser();
      mockRepo.findByPasswordResetToken.mockResolvedValue(mockUser as any);
      mockRepo.resetPassword.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        authService.resetPassword("valid_token", "NewPassword1!")
      ).resolves.toBeUndefined();
    });

    it("should call repository resetPassword with the correct user ID and new password", async () => {
      // Arrange
      const mockUser = buildMockUser();
      mockRepo.findByPasswordResetToken.mockResolvedValue(mockUser as any);
      mockRepo.resetPassword.mockResolvedValue(undefined);

      // Act
      await authService.resetPassword("valid_token", "NewPassword1!");

      // Assert
      expect(mockRepo.resetPassword).toHaveBeenCalledWith(
        "user_001",
        "NewPassword1!"
      );
    });

    it("should throw an error when reset token is invalid or expired", async () => {
      // Arrange
      mockRepo.findByPasswordResetToken.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.resetPassword("expired_token", "NewPassword1!")
      ).rejects.toThrow("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    });
  });
});
