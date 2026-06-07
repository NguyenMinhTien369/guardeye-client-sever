// test/auth/auth.validation.test.ts

// -----------------------------------------------------------------------------
// Validation tests không cần mock — chỉ test logic thuần Zod schema.
// Không gọi DB, không gọi HTTP — hoàn toàn pure function.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  refreshTokenSchema,
  validate,
} from "../../src/features/auth/auth.validation";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function buildMockRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

// -----------------------------------------------------------------------------
// TEST SUITE: registerSchema
// -----------------------------------------------------------------------------

describe("registerSchema", () => {
  describe("name field", () => {
    // it("should be valid when name has at least 2 characters", () => {
    //   // Arrange & Act
    //   const result = registerSchema.safeParse({
    //     name: "AB",
    //     email: "test@example.com",
    //     password: "Password1!",
    //     confirmPassword: "Password1!",
    //   });

    //   // Assert
    //   expect(result.success).toBe(true);
    // });

    // it("should be invalid when name has fewer than 2 characters", () => {
    //   // Arrange & Act
    //   const result = registerSchema.safeParse({
    //     name: "A",
    //     email: "test@example.com",
    //     password: "Password1!",
    //     confirmPassword: "Password1!",
    //   });

    //   // Assert
    //   expect(result.success).toBe(false);
    //   if (!result.success) {
    //     expect(result.error.errors[0].path).toContain("name");
    //   }
    // });

    // it("should be invalid when name exceeds 50 characters", () => {
    //   // Arrange & Act
    //   const result = registerSchema.safeParse({
    //     name: "A".repeat(51),
    //     email: "test@example.com",
    //     password: "Password1!",
    //     confirmPassword: "Password1!",
    //   });

    //   // Assert
    //   expect(result.success).toBe(false);
    // });

    // Chuẩn bị một bộ data gốc hợp lệ (Valid Base Data)
  // Để đảm bảo rằng khi form bị lỗi, nguyên nhân duy nhất là do trường [name]
  const validBaseData = {
    email: 'admin@gmail.com',
    password: 'Password@123!',
    confirmPassword: 'Password@123!',
  };

  it('TC03 - Required: Nên báo lỗi khi bỏ trống hoặc truyền undefined', () => {
    // Arrange: Cố tình không truyền name hoặc truyền undefined
    const testData = { ...validBaseData, name: undefined };

    // Act
    const result = registerSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod trả về mảng các lỗi, chúng ta tìm lỗi ở field "name"
      const nameError = result.error.issues.find(issue => issue.path.includes('name'));
      expect(nameError?.message).toBe('Tên là bắt buộc');
    }
  });

  it('TC04 - Min Boundary: Nên báo lỗi khi nhập chuỗi chỉ có 1 ký tự', () => {
    // Arrange: Nhập 1 ký tự
    const testData = { ...validBaseData, name: 'A' };

    // Act
    const result = registerSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(issue => issue.path.includes('name'));
      expect(nameError?.message).toBe('Tên phải có ít nhất 2 ký tự');
    }
  });

  it('TC05 - Max Boundary: Nên báo lỗi khi nhập chuỗi có 51 ký tự', () => {
    // Arrange: Tạo chuỗi 51 ký tự bằng hàm repeat
    const testData = { ...validBaseData, name: 'A'.repeat(51) };

    // Act
    const result = registerSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(issue => issue.path.includes('name'));
      expect(nameError?.message).toBe('Tên không được vượt quá 50 ký tự');
    }
  });

  it('TC06 - Trim Behavior: Nên báo lỗi độ dài khi chỉ nhập khoảng trắng', () => {
    // Arrange: Nhập toàn khoảng trắng
    const testData = { ...validBaseData, name: '   ' };

    // Act
    const result = registerSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(issue => issue.path.includes('name'));
      // Vì Zod thực thi .trim() trước, chuỗi '   ' biến thành '', 
      // dẫn đến việc vi phạm lỗi .min(2) thay vì lỗi required
      expect(nameError?.message).toBe('Tên phải có ít nhất 2 ký tự');
    }
  });


  });

  describe("email field", () => {
    it("should be valid for a proper email format", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "valid@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
      });

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid for malformed email", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "not-an-email",
        password: "Password1!",
        confirmPassword: "Password1!",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("email");
      }
    });

    it("should convert email to lowercase", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "UPPER@EXAMPLE.COM",
        password: "Password1!",
        confirmPassword: "Password1!",
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("upper@example.com");
      }
    });
  });

  describe("password field", () => {
    it("should be valid when password meets all requirements", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
      });

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when password is shorter than 8 characters", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Pa1!",
        confirmPassword: "Pa1!",
      });

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when password has no uppercase letter", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "password1!",
        confirmPassword: "password1!",
      });

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when password has no digit", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password!!",
        confirmPassword: "Password!!",
      });

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when password has no special character", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password12",
        confirmPassword: "Password12",
      });

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("confirmPassword field", () => {
    it("should be invalid when confirmPassword does not match password", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password1!",
        confirmPassword: "DifferentPass1!",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmPasswordError = result.error.errors.find((e) =>
          e.path.includes("confirmPassword")
        );
        expect(confirmPasswordError).toBeDefined();
      }
    });
  });

  describe("notificationEmail field", () => {
    it("should be valid when notificationEmail is not provided (optional)", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
      });

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when notificationEmail is provided but has bad format", () => {
      // Arrange & Act
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
        notificationEmail: "not-an-email",
      });

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: loginSchema
// -----------------------------------------------------------------------------

describe("loginSchema", () => {
  it("should be valid with correct email and password", () => {
    // Arrange & Act
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "anypassword",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be invalid when email is missing", () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ password: "anypassword" });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when email format is wrong", () => {
    // Arrange & Act
    const result = loginSchema.safeParse({
      email: "bad-email",
      password: "anypassword",
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when password is missing", () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: "test@example.com" });

    // Assert
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: forgotPasswordSchema
// -----------------------------------------------------------------------------

describe("forgotPasswordSchema", () => {
  it("should be valid with a proper email", () => {
    // Arrange & Act
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be invalid when email is missing", () => {
    // Arrange & Act
    const result = forgotPasswordSchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when email has bad format", () => {
    // Arrange & Act
    const result = forgotPasswordSchema.safeParse({ email: "notanemail" });

    // Assert
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: resetPasswordSchema
// -----------------------------------------------------------------------------

describe("resetPasswordSchema", () => {
  it("should be valid when all fields are correct and passwords match", () => {
    // Arrange & Act
    const result = resetPasswordSchema.safeParse({
      token: "valid_reset_token",
      newPassword: "NewPassword1!",
      confirmNewPassword: "NewPassword1!",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be invalid when token is missing", () => {
    // Arrange & Act
    const result = resetPasswordSchema.safeParse({
      newPassword: "NewPassword1!",
      confirmNewPassword: "NewPassword1!",
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when newPassword does not meet strength requirements", () => {
    // Arrange & Act
    const result = resetPasswordSchema.safeParse({
      token: "token",
      newPassword: "weakpassword",
      confirmNewPassword: "weakpassword",
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when confirmNewPassword does not match newPassword", () => {
    // Arrange & Act
    const result = resetPasswordSchema.safeParse({
      token: "token",
      newPassword: "NewPassword1!",
      confirmNewPassword: "DifferentPass1!",
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const matchError = result.error.errors.find((e) =>
        e.path.includes("confirmNewPassword")
      );
      expect(matchError).toBeDefined();
    }
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: verifyEmailSchema
// -----------------------------------------------------------------------------

describe("verifyEmailSchema", () => {
  it("should be valid when token is a non-empty string", () => {
    // Arrange & Act
    const result = verifyEmailSchema.safeParse({ token: "some_verify_token" });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be invalid when token is missing", () => {
    // Arrange & Act
    const result = verifyEmailSchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when token is an empty string", () => {
    // Arrange & Act
    const result = verifyEmailSchema.safeParse({ token: "" });

    // Assert
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: refreshTokenSchema
// -----------------------------------------------------------------------------

describe("refreshTokenSchema", () => {
  it("should be valid when refreshToken is a non-empty string", () => {
    // Arrange & Act
    const result = refreshTokenSchema.safeParse({
      refreshToken: "some.jwt.token",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be invalid when refreshToken is missing", () => {
    // Arrange & Act
    const result = refreshTokenSchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });

  it("should be invalid when refreshToken is an empty string", () => {
    // Arrange & Act
    const result = refreshTokenSchema.safeParse({ refreshToken: "" });

    // Assert
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: validate middleware factory
// -----------------------------------------------------------------------------

describe("validate middleware", () => {
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  it("should call next() when request body passes schema validation", () => {
    // Arrange
    const req = {
      body: { email: "test@example.com", password: "Password1!" },
    } as Request;
    const middleware = validate(loginSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should respond with 400 and validation errors when body is invalid", () => {
    // Arrange
    const req = {
      body: { email: "not-an-email", password: "" },
    } as Request;
    const middleware = validate(loginSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, errors: expect.any(Object) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should replace req.body with Zod-parsed and transformed data after validation", () => {
    // Arrange
    const req = {
      body: { email: "  UPPER@EXAMPLE.COM  ", password: "somepassword" },
    } as Request;
    const middleware = validate(loginSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(req.body.email).toBe("upper@example.com");
    expect(next).toHaveBeenCalled();
  });

  it("should return one error message per field, not multiple", () => {
    // Arrange — email rỗng và password rỗng
    const req = {
      body: { email: "bad", password: "" },
    } as Request;
    const middleware = validate(loginSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    const errors: Record<string, string> = jsonCall.errors;

    // Mỗi field chỉ có đúng 1 string, không phải mảng
    for (const value of Object.values(errors)) {
      expect(typeof value).toBe("string");
    }
  });
});
