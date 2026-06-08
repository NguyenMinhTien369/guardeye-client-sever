// test/children/children.validation.test.ts

// -----------------------------------------------------------------------------
// Validation tests không cần mock — chỉ test logic thuần Zod schema.
// Không gọi DB, không gọi HTTP — hoàn toàn pure function.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import {
  createChildSchema,
  updateChildSchema,
  validate,
} from "../../src/features/children/children.validation";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function buildMockRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

// Bộ dữ liệu hợp lệ dùng chung cho createChildSchema
const validCreateBase = {
  name: "Nguyen Van A",
  age: 5,
  gender: "male" as const,
};

// -----------------------------------------------------------------------------
// TEST SUITE: createChildSchema
// -----------------------------------------------------------------------------

describe("createChildSchema", () => {
  // ---------------------------------------------------------------------------
  // name field
  // ---------------------------------------------------------------------------

  describe("name field", () => {
    it("should be valid when name has exactly 2 characters (min boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, name: "AB" };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when name has exactly 50 characters (max boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, name: "A".repeat(50) };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should fail when name is missing (required)", () => {
      // Arrange
      const { name, ...withoutName } = validCreateBase;

      // Act
      const result = createChildSchema.safeParse(withoutName);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name")
        );
        expect(nameError?.message).toBe("Tên là bắt buộc");
      }
    });

    it("should fail when name has fewer than 2 characters (below min boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, name: "A" };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name")
        );
        expect(nameError?.message).toBe("Tên phải có ít nhất 2 ký tự");
      }
    });

    it("should fail when name has more than 50 characters (above max boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, name: "A".repeat(51) };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name")
        );
        expect(nameError?.message).toBe("Tên không được vượt quá 50 ký tự");
      }
    });

    it("should fail when name is only whitespace (trim behavior)", () => {
      // Arrange — Zod thực thi .trim() trước, chuỗi '   ' → '' → vi phạm min(2)
      const testData = { ...validCreateBase, name: "   " };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name")
        );
        expect(nameError?.message).toBe("Tên phải có ít nhất 2 ký tự");
      }
    });

    it("should trim whitespace from name before storing", () => {
      // Arrange
      const testData = { ...validCreateBase, name: "  An Binh  " };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("An Binh");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // age field
  // ---------------------------------------------------------------------------

  describe("age field", () => {
    it("should be valid when age is 0 (min boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, age: 0 };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when age is 18 (max boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, age: 18 };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should fail when age is missing (required)", () => {
      // Arrange
      const { age, ...withoutAge } = validCreateBase;

      // Act
      const result = createChildSchema.safeParse(withoutAge);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const ageError = result.error.issues.find((i) =>
          i.path.includes("age")
        );
        expect(ageError?.message).toBe("Tuổi là bắt buộc");
      }
    });

    it("should fail when age is less than 0 (below min boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, age: -1 };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const ageError = result.error.issues.find((i) =>
          i.path.includes("age")
        );
        expect(ageError?.message).toBe("Tuổi không thể nhỏ hơn 0");
      }
    });

    it("should fail when age is greater than 18 (above max boundary)", () => {
      // Arrange
      const testData = { ...validCreateBase, age: 19 };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const ageError = result.error.issues.find((i) =>
          i.path.includes("age")
        );
        expect(ageError?.message).toBe("Tuổi không thể lớn hơn 18");
      }
    });

    it("should fail when age is not a number", () => {
      // Arrange
      const testData = { ...validCreateBase, age: "five" as any };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // gender field
  // ---------------------------------------------------------------------------

  describe("gender field", () => {
    it("should be valid when gender is 'male'", () => {
      // Arrange
      const testData = { ...validCreateBase, gender: "male" as const };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when gender is 'female'", () => {
      // Arrange
      const testData = { ...validCreateBase, gender: "female" as const };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when gender is 'other'", () => {
      // Arrange
      const testData = { ...validCreateBase, gender: "other" as const };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should fail when gender is missing (required)", () => {
      // Arrange
      const { gender, ...withoutGender } = validCreateBase;

      // Act
      const result = createChildSchema.safeParse(withoutGender);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const genderError = result.error.issues.find((i) =>
          i.path.includes("gender")
        );
        expect(genderError?.message).toBe("Giới tính là bắt buộc");
      }
    });

    it("should fail when gender is an invalid value", () => {
      // Arrange
      const testData = { ...validCreateBase, gender: "unknown" as any };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const genderError = result.error.issues.find((i) =>
          i.path.includes("gender")
        );
        expect(genderError?.message).toBe("Giới tính không hợp lệ");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Full schema valid case
  // ---------------------------------------------------------------------------

  describe("full schema", () => {
    it("should be valid when all required fields are correct", () => {
      // Arrange
      const testData = { name: "Bao Chau", age: 7, gender: "female" };

      // Act
      const result = createChildSchema.safeParse(testData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should fail when body is empty", () => {
      // Arrange & Act
      const result = createChildSchema.safeParse({});

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

// -----------------------------------------------------------------------------
// TEST SUITE: updateChildSchema
// -----------------------------------------------------------------------------

describe("updateChildSchema", () => {
  it("should be valid when all fields are provided and correct", () => {
    // Arrange
    const testData = { name: "Tran Thi B", age: 10, gender: "female" };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be valid when body is empty (all fields are optional)", () => {
    // Arrange & Act
    const result = updateChildSchema.safeParse({});

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be valid when only name is provided", () => {
    // Arrange
    const testData = { name: "Nguyen Thi C" };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be valid when only age is provided", () => {
    // Arrange
    const testData = { age: 12 };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be valid when only gender is provided", () => {
    // Arrange
    const testData = { gender: "male" };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should fail when name is provided but has fewer than 2 characters", () => {
    // Arrange
    const testData = { name: "X" };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) =>
        i.path.includes("name")
      );
      expect(nameError?.message).toBe("Tên phải có ít nhất 2 ký tự");
    }
  });

  it("should fail when age is provided but exceeds 18", () => {
    // Arrange
    const testData = { age: 20 };

    // Act
    const result = updateChildSchema.safeParse(testData);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const ageError = result.error.issues.find((i) => i.path.includes("age"));
      expect(ageError?.message).toBe("Tuổi không thể lớn hơn 18");
    }
  });

  it("should fail when gender is provided but has an invalid value", () => {
    // Arrange
    const testData = { gender: "nonbinary" as any };

    // Act
    const result = updateChildSchema.safeParse(testData);

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

  it("should call next() when body passes createChildSchema validation", () => {
    // Arrange
    const req = {
      body: { name: "An Binh", age: 5, gender: "male" },
    } as Request;
    const middleware = validate(createChildSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should respond with 400 and success: false when body is invalid", () => {
    // Arrange
    const req = {
      body: { name: "A", age: -1, gender: "unknown" },
    } as Request;
    const middleware = validate(createChildSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, errors: expect.any(Object) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should replace req.body with trimmed data after validation", () => {
    // Arrange
    const req = {
      body: { name: "  Bao Chau  ", age: 8, gender: "female" },
    } as Request;
    const middleware = validate(createChildSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(req.body.name).toBe("Bao Chau");
    expect(next).toHaveBeenCalled();
  });

  it("should return one error message per field, not multiple", () => {
    // Arrange
    const req = {
      body: { name: "A", age: -1 },
    } as Request;
    const middleware = validate(createChildSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    const errors: Record<string, string> = jsonCall.errors;

    for (const value of Object.values(errors)) {
      expect(typeof value).toBe("string");
    }
  });

  it("should call next() when body passes updateChildSchema with empty object", () => {
    // Arrange — update cho phép object rỗng vì mọi field đều optional
    const req = { body: {} } as Request;
    const middleware = validate(updateChildSchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
