// test/auth/auth.controller.test.ts

// -----------------------------------------------------------------------------
// Mock dependency: authService — Controller chỉ gọi Service, không gọi DB
// -----------------------------------------------------------------------------

jest.mock("../../src/features/auth/auth.service");

import { Request, Response, NextFunction } from "express";
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
} from "../../src/features/auth/auth.controller";
import authService from "../../src/features/auth/auth.service";
import {
  ConflictError,
  BadRequestError,
  AuthFailureError,
  ForbiddenError,
} from "../../src/shared/core/error.response";

// -----------------------------------------------------------------------------
// TYPE HELPERS
// -----------------------------------------------------------------------------

const mockService = authService as jest.Mocked<typeof authService>;

// -----------------------------------------------------------------------------
// MOCK FACTORY — Express req / res / next
// -----------------------------------------------------------------------------

function buildMockRes(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

function buildMockReq(body: Record<string, unknown> = {}, user?: { _id: { toString: () => string } }): Partial<Request> {
  return { body, user: user as any };
}

// -----------------------------------------------------------------------------
// BUILDER — mock user data
// -----------------------------------------------------------------------------

function buildUserResponse() {
  return {
    id: "user_001",
    name: "Nguyen Van A",
    email: "test@example.com",
    notificationEmail: null,
    notifications: { email: true, browser: true },
    isActive: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: AuthController
// -----------------------------------------------------------------------------

describe("AuthController", () => {
  let res: jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe("register", () => {
    const registerBody = {
      name: "Nguyen Van A",
      email: "test@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
    };

    it("should respond with 201 and user data when registration is successful", async () => {
      // Arrange
      const serviceResult = {
        user: buildUserResponse(),
        message: "Đăng ký thành công. Vui lòng kiểm tra email.",
      };
      mockService.register.mockResolvedValue(serviceResult);
      const req = buildMockReq(registerBody);

      // Act
      await register(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call next with ConflictError when email is already in use", async () => {
      // Arrange
      mockService.register.mockRejectedValue(
        new Error("Email này đã được sử dụng")
      );
      const req = buildMockReq(registerBody);

      // Act
      await register(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
    });

    it("should call next with BadRequestError for generic registration errors", async () => {
      // Arrange
      mockService.register.mockRejectedValue(new Error("Lỗi không xác định"));
      const req = buildMockReq(registerBody);

      // Act
      await register(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe("login", () => {
    const loginBody = {
      email: "test@example.com",
      password: "Password1!",
    };

    it("should respond with 200 and tokens when credentials are valid", async () => {
      // Arrange
      const serviceResult = {
        user: buildUserResponse(),
        accessToken: "access_token_123",
        refreshToken: "refresh_token_456",
      };
      mockService.login.mockResolvedValue(serviceResult);
      const req = buildMockReq(loginBody);

      // Act
      await login(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should call next with ForbiddenError when account is deactivated", async () => {
      // Arrange
      mockService.login.mockRejectedValue(
        new Error("Tài khoản đã bị vô hiệu hóa")
      );
      const req = buildMockReq(loginBody);

      // Act
      await login(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("should call next with AuthFailureError when credentials are invalid", async () => {
      // Arrange
      mockService.login.mockRejectedValue(
        new Error("Email hoặc mật khẩu không chính xác")
      );
      const req = buildMockReq(loginBody);

      // Act
      await login(req as Request<{}, {}, any>, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthFailureError));
    });
  });

  // ---------------------------------------------------------------------------
  // verifyEmail
  // ---------------------------------------------------------------------------

  describe("verifyEmail", () => {
    it("should respond with 200 when email verification is successful", async () => {
      // Arrange
      mockService.verifyEmail.mockResolvedValue(undefined);
      const req = buildMockReq({ token: "valid_token" });

      // Act
      await verifyEmail(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with BadRequestError when verify token is invalid", async () => {
      // Arrange
      mockService.verifyEmail.mockRejectedValue(
        new Error("Token xác thực không hợp lệ hoặc đã hết hạn")
      );
      const req = buildMockReq({ token: "bad_token" });

      // Act
      await verifyEmail(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // forgotPassword
  // ---------------------------------------------------------------------------

  describe("forgotPassword", () => {
    it("should respond with 200 regardless of whether email exists", async () => {
      // Arrange
      mockService.forgotPassword.mockResolvedValue(undefined);
      const req = buildMockReq({ email: "any@example.com" });

      // Act
      await forgotPassword(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with ErrorResponse when an unexpected error occurs", async () => {
      // Arrange
      mockService.forgotPassword.mockRejectedValue(new Error("DB connection error"));
      const req = buildMockReq({ email: "test@example.com" });

      // Act
      await forgotPassword(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------------------

  describe("resetPassword", () => {
    it("should respond with 200 when password is reset successfully", async () => {
      // Arrange
      mockService.resetPassword.mockResolvedValue(undefined);
      const req = buildMockReq({ token: "valid_token", newPassword: "NewPass1!" });

      // Act
      await resetPassword(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with BadRequestError when reset token is invalid", async () => {
      // Arrange
      mockService.resetPassword.mockRejectedValue(
        new Error("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn")
      );
      const req = buildMockReq({ token: "bad_token", newPassword: "NewPass1!" });

      // Act
      await resetPassword(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // refreshToken
  // ---------------------------------------------------------------------------

  describe("refreshToken", () => {
    it("should respond with 200 and new tokens when refresh token is valid", async () => {
      // Arrange
      mockService.refreshTokens.mockResolvedValue({
        accessToken: "new_access",
        refreshToken: "new_refresh",
      });
      const req = buildMockReq({ refreshToken: "valid_refresh_token" });

      // Act
      await refreshToken(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with AuthFailureError when refresh token is expired", async () => {
      // Arrange
      mockService.refreshTokens.mockRejectedValue(
        new Error("Token hết hạn")
      );
      const req = buildMockReq({ refreshToken: "expired_token" });

      // Act
      await refreshToken(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthFailureError));
    });

    it("should call next with AuthFailureError when refresh token is invalid", async () => {
      // Arrange
      mockService.refreshTokens.mockRejectedValue(
        new Error("Token không hợp lệ")
      );
      const req = buildMockReq({ refreshToken: "invalid_token" });

      // Act
      await refreshToken(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthFailureError));
    });

    it("should call next with BadRequestError for unexpected refresh token errors", async () => {
      // Arrange
      mockService.refreshTokens.mockRejectedValue(new Error("Lỗi ngẫu nhiên"));
      const req = buildMockReq({ refreshToken: "some_token" });

      // Act
      await refreshToken(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  describe("logout", () => {
    it("should respond with 200 when logout is successful", async () => {
      // Arrange
      mockService.logout.mockResolvedValue(undefined);
      const mockUser = { _id: { toString: () => "user_001" } };
      const req = buildMockReq({}, mockUser);

      // Act
      await logout(req as Request, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call authService.logout with the correct user ID from req.user", async () => {
      // Arrange
      mockService.logout.mockResolvedValue(undefined);
      const mockUser = { _id: { toString: () => "user_001" } };
      const req = buildMockReq({}, mockUser);

      // Act
      await logout(req as Request, res, next);

      // Assert
      expect(mockService.logout).toHaveBeenCalledWith("user_001");
    });

    it("should call next with ErrorResponse when logout fails", async () => {
      // Arrange
      mockService.logout.mockRejectedValue(new Error("DB error"));
      const mockUser = { _id: { toString: () => "user_001" } };
      const req = buildMockReq({}, mockUser);

      // Act
      await logout(req as Request, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });
});
