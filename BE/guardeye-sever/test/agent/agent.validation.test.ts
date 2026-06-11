// test/agent/agent.validation.test.ts

// -----------------------------------------------------------------------------
// Agent Validation tests — kiểm tra Zod schema và middleware validate.
// Không gọi DB, không gọi HTTP — hoàn toàn pure function.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import type { ZodIssue } from "zod";
import {
  syncBodySchema,
  statusQuerySchema,
  validate,
  validateQuery,
} from "../../src/features/agent/agent.validation";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function buildMockRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function buildValidWindowEvent() {
  return {
    type: "window" as const,
    timestamp: "2025-01-01T10:00:00.000Z",
    title: "YouTube - Google Chrome",
    processName: "chrome.exe",
    isIncognito: false,
  };
}

function buildValidHistoryEvent() {
  return {
    type: "history" as const,
    timestamp: "2025-01-01T10:00:00.000Z",
    url: "https://www.youtube.com/watch?v=abc",
    title: "YouTube",
    browser: "chrome" as const,
    visitTime: "2025-01-01T09:55:00.000Z",
  };
}

function buildValidSyncBody(overrides: Record<string, unknown> = {}) {
  const events = [buildValidWindowEvent()];
  return {
    deviceToken: "device-token-abc-123",
    sentAt: "2025-01-01T10:00:00.000Z",
    eventCount: events.length,
    events,
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE: syncBodySchema
// =============================================================================

describe("syncBodySchema", () => {
  // ---------------------------------------------------------------------------
  // deviceToken
  // ---------------------------------------------------------------------------

  describe("deviceToken field", () => {
    it("should be valid when deviceToken is a non-empty string", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(buildValidSyncBody());

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when deviceToken is missing", () => {
      // Arrange & Act
      const { deviceToken, ...rest } = buildValidSyncBody();
      const result = syncBodySchema.safeParse(rest);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i: ZodIssue) =>
          i.path.includes("deviceToken")
        );
        expect(err).toBeDefined();
      }
    });

    it("should be invalid when deviceToken is an empty string", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ deviceToken: "" })
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i: ZodIssue) =>
          i.path.includes("deviceToken")
        );
        expect(err).toBeDefined();
      }
    });

    it("should trim leading and trailing whitespace from deviceToken", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ deviceToken: "  token-abc  " })
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deviceToken).toBe("token-abc");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // sentAt
  // ---------------------------------------------------------------------------

  describe("sentAt field", () => {
    it("should be valid when sentAt is a valid ISO 8601 datetime string", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(buildValidSyncBody());

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when sentAt is missing", () => {
      // Arrange & Act
      const { sentAt, ...rest } = buildValidSyncBody();
      const result = syncBodySchema.safeParse(rest);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i: ZodIssue) => i.path.includes("sentAt"));
        expect(err).toBeDefined();
      }
    });

    it("should be invalid when sentAt is not a valid datetime string", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ sentAt: "not-a-date" })
      );

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // eventCount
  // ---------------------------------------------------------------------------

  describe("eventCount field", () => {
    it("should be invalid when eventCount is missing", () => {
      // Arrange & Act
      const { eventCount, ...rest } = buildValidSyncBody();
      const result = syncBodySchema.safeParse(rest);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i: ZodIssue) =>
          i.path.includes("eventCount")
        );
        expect(err).toBeDefined();
      }
    });

    it("should be invalid when eventCount is negative", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ eventCount: -1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when eventCount is not an integer", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ eventCount: 1.5 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be valid when eventCount equals 0", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ eventCount: 0, events: [] })
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // eventCount ↔ events.length cross-field validation (refine)
  // ---------------------------------------------------------------------------

  describe("eventCount vs events.length cross-validation", () => {
    it("should be invalid when eventCount does not match events.length", () => {
      // Arrange: khai báo eventCount=2 nhưng chỉ có 1 event
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ eventCount: 2 })
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i: ZodIssue) =>
          i.path.includes("eventCount")
        );
        expect(err?.message).toContain("eventCount");
      }
    });

    it("should be valid when eventCount exactly matches events.length", () => {
      // Arrange
      const events = [buildValidWindowEvent(), buildValidHistoryEvent()];
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ eventCount: 2, events })
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // events array — WindowEvent
  // ---------------------------------------------------------------------------

  describe("events[] — WindowEvent", () => {
    it("should be valid for a well-formed window event", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(buildValidSyncBody());

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when window event is missing title", () => {
      // Arrange
      const badEvent = { ...buildValidWindowEvent() };
      delete (badEvent as any).title;
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when window event is missing processName", () => {
      // Arrange
      const badEvent = { ...buildValidWindowEvent() };
      delete (badEvent as any).processName;
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when window event is missing isIncognito", () => {
      // Arrange
      const badEvent = { ...buildValidWindowEvent() };
      delete (badEvent as any).isIncognito;
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when window event has invalid timestamp format", () => {
      // Arrange
      const badEvent = { ...buildValidWindowEvent(), timestamp: "not-a-date" };
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // events array — HistoryEvent
  // ---------------------------------------------------------------------------

  describe("events[] — HistoryEvent", () => {
    it("should be valid for a well-formed history event", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({
          events: [buildValidHistoryEvent()],
          eventCount: 1,
        })
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when history event is missing url", () => {
      // Arrange
      const badEvent = { ...buildValidHistoryEvent() };
      delete (badEvent as any).url;
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be invalid when browser is not one of chrome, edge, or unknown", () => {
      // Arrange
      const badEvent = { ...buildValidHistoryEvent(), browser: "firefox" };
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });

    it("should be valid when browser is chrome", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({
          events: [{ ...buildValidHistoryEvent(), browser: "chrome" }],
          eventCount: 1,
        })
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when browser is edge", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({
          events: [{ ...buildValidHistoryEvent(), browser: "edge" }],
          eventCount: 1,
        })
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be valid when browser is unknown", () => {
      // Arrange & Act
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({
          events: [{ ...buildValidHistoryEvent(), browser: "unknown" }],
          eventCount: 1,
        })
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("should be invalid when history event has invalid visitTime format", () => {
      // Arrange
      const badEvent = { ...buildValidHistoryEvent(), visitTime: "not-a-date" };
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events: [badEvent], eventCount: 1 })
      );

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Mixed events array
  // ---------------------------------------------------------------------------

  describe("events[] — mixed window and history events", () => {
    it("should be valid when events array contains both window and history events", () => {
      // Arrange
      const events = [buildValidWindowEvent(), buildValidHistoryEvent()];
      const result = syncBodySchema.safeParse(
        buildValidSyncBody({ events, eventCount: 2 })
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: statusQuerySchema
// =============================================================================

describe("statusQuerySchema", () => {
  it("should be valid when deviceToken is provided as a non-empty string", () => {
    // Arrange & Act
    const result = statusQuerySchema.safeParse({
      deviceToken: "device-token-abc",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should be valid when deviceToken is not provided (optional)", () => {
    // Arrange & Act
    const result = statusQuerySchema.safeParse({});

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceToken).toBeUndefined();
    }
  });

  it("should be invalid when deviceToken is provided but is an empty string", () => {
    // Arrange & Act
    const result = statusQuerySchema.safeParse({ deviceToken: "" });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues.find((i: ZodIssue) =>
        i.path.includes("deviceToken")
      );
      expect(err).toBeDefined();
    }
  });

  it("should trim whitespace from deviceToken when provided", () => {
    // Arrange & Act
    const result = statusQuerySchema.safeParse({
      deviceToken: "  token-abc  ",
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceToken).toBe("token-abc");
    }
  });
});

// =============================================================================
// TEST SUITE: validate middleware factory
// =============================================================================

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
    const req = { body: buildValidSyncBody() } as Request;
    const middleware = validate(syncBodySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should respond with 400 and errors when body fails validation", () => {
    // Arrange — thiếu deviceToken
    const req = {
      body: { sentAt: "2025-01-01T10:00:00.000Z", eventCount: 0, events: [] },
    } as Request;
    const middleware = validate(syncBodySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: expect.any(Object),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should replace req.body with Zod-parsed and trimmed data on success", () => {
    // Arrange — deviceToken có trailing space
    const req = {
      body: buildValidSyncBody({ deviceToken: "  token-abc  " }),
    } as Request;
    const middleware = validate(syncBodySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(req.body.deviceToken).toBe("token-abc");
    expect(next).toHaveBeenCalled();
  });

  it("should return one error string per field, not an array of messages", () => {
    // Arrange — body hoàn toàn rỗng
    const req = { body: {} } as Request;
    const middleware = validate(syncBodySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    const errors: Record<string, string> = jsonCall.errors;

    for (const value of Object.values(errors)) {
      expect(typeof value).toBe("string");
    }
  });
});

// =============================================================================
// TEST SUITE: validateQuery middleware factory
// =============================================================================

describe("validateQuery middleware", () => {
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildMockRes();
    next = jest.fn();
  });

  it("should call next() when query params pass schema validation", () => {
    // Arrange
    const req = { query: { deviceToken: "valid-token" } } as unknown as Request;
    const middleware = validateQuery(statusQuerySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should call next() when optional deviceToken is absent in query", () => {
    // Arrange
    const req = { query: {} } as Request;
    const middleware = validateQuery(statusQuerySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond with 400 when query params fail validation", () => {
    // Arrange — empty string deviceToken không được phép
    const req = { query: { deviceToken: "" } } as unknown as Request;
    const middleware = validateQuery(statusQuerySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("should replace req.query with Zod-parsed data on success", () => {
    // Arrange
    const req = {
      query: { deviceToken: "  trimmed-token  " },
    } as unknown as Request;
    const middleware = validateQuery(statusQuerySchema);

    // Act
    middleware(req, res as Response, next);

    // Assert
    expect((req as any).query.deviceToken).toBe("trimmed-token");
    expect(next).toHaveBeenCalled();
  });
});
