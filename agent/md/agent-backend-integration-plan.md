# Kế Hoạch Tích Hợp: Agent ↔ GuardEye Server

> **Phương pháp:** Test-Driven Development (TDD) — Viết Test trước, code logic sau.
> **Nguyên tắc tối thượng:** Chỉ test Logic, không test I/O vật lý (mock tất cả HTTP, DB, File System).

---

## Tổng Quan Luồng Kết Nối

```
Agent (Windows)                         GuardEye Server (Express)
─────────────────────────────────────────────────────────────────
[PauseController]  ──GET /api/agent/status?deviceToken=──►  [AgentController]
                                                                    │
                   ◄── { paused: boolean, since?, reason? } ────────┘

[SyncService]  ──POST /api/agent/sync──►  [AgentController]
               ◄── { success, savedCount } ──────────────────────────
```

**Hai endpoint cần tạo mới trên Server:**

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/agent/status` | GET | Agent poll trạng thái pause |
| `/api/agent/sync` | POST | Agent đẩy batch events lên server |

**Middleware xác thực Agent:**
- Header: `X-Device-Token: <token>`
- Khác với JWT của user — device token lưu trong `config.json` của Agent

---

## Phân Tích Hiện Trạng

### Phía Agent (đã có)
- ✅ `SyncService.ts` — POST `/api/agent/sync`, payload `{ deviceToken, events, sentAt, eventCount }`
- ✅ `PauseController.ts` — GET `/api/agent/status?deviceToken={token}`, header `X-Device-Token`
- ✅ `DataBuffer.ts`, `WindowMonitor.ts`, `HistoryReader.ts` — thu thập data
- ❌ Chưa có test cho `SyncService`, `PauseController`, `WindowMonitor`, `HistoryReader`

### Phía Server (đã có)
- ✅ Cấu trúc feature: `auth/` với Controller → Service → Repository
- ✅ Shared: `error.response.ts`, `success.response.ts`, `auth.middleware.ts`
- ✅ Pattern: Validation middleware (Zod) → Controller → Service → Repository
- ❌ Chưa có `agent/` feature nào cả
- ❌ Chưa có Device authentication middleware

---

## Kế Hoạch Thực Thi (TDD Từng Bước)

---

### PHASE 1 — Server: Xây Dựng Feature `agent`

#### Bước 1.1 — `agent.dto.ts` (Không cần test — chỉ là types)

**Mục đích:** Định nghĩa cấu trúc data contract giữa Agent và Server.

```
BE/guardeye-sever/src/features/agent/
└── agent.dto.ts   [NEW]
```

**Nội dung cần tạo:**

```typescript
// Request từ Agent (POST /api/agent/sync)
export interface WindowEventDto {
  type: "window";
  timestamp: string;   // ISO 8601
  title: string;
  processName: string;
  isIncognito: boolean;
}

export interface HistoryEventDto {
  type: "history";
  timestamp: string;   // ISO 8601
  url: string;
  title: string;
  browser: "chrome" | "edge" | "unknown";
  visitTime: string;   // ISO 8601
}

export type AgentEventDto = WindowEventDto | HistoryEventDto;

export interface SyncRequestDto {
  deviceToken: string;
  events: AgentEventDto[];
  sentAt: string;
  eventCount: number;
}

// Response từ Server
export interface SyncResponseDto {
  success: boolean;
  savedCount: number;
  message?: string;
}

// Response cho GET /api/agent/status
export interface AgentStatusResponseDto {
  paused: boolean;
  since?: string;   // ISO 8601 nếu đang pause
  reason?: string;
}
```

---

#### Bước 1.2 — `agent.validation.ts` + TEST ⭐

**File cần tạo:**
```
BE/guardeye-sever/src/features/agent/agent.validation.ts   [NEW]
BE/guardeye-sever/test/agent/agent.validation.test.ts      [NEW]
```

**TDD Workflow:**

**① Viết Test trước — `agent.validation.test.ts`**

```typescript
import { syncSchema, statusQuerySchema } from "../../src/features/agent/agent.validation";

describe("agent.validation", () => {

  // ── syncSchema ──────────────────────────────────────────────────────────────
  describe("syncSchema", () => {
    const validWindowEvent = {
      type: "window",
      timestamp: "2024-01-01T00:00:00.000Z",
      title: "Google Chrome",
      processName: "chrome.exe",
      isIncognito: false,
    };

    const validHistoryEvent = {
      type: "history",
      timestamp: "2024-01-01T00:00:00.000Z",
      url: "https://example.com",
      title: "Example",
      browser: "chrome",
      visitTime: "2024-01-01T00:00:00.000Z",
    };

    const validPayload = {
      deviceToken: "abc-token-123",
      events: [validWindowEvent],
      sentAt: "2024-01-01T00:00:00.000Z",
      eventCount: 1,
    };

    // Happy path
    it("should parse valid sync payload successfully");
    it("should accept empty events array");
    it("should accept mixed window and history events");

    // deviceToken
    it("should fail when deviceToken is missing");
    it("should fail when deviceToken is empty string");

    // events
    it("should fail when events is not an array");
    it("should fail when window event is missing title");
    it("should fail when history event has invalid url format");
    it("should fail when event type is unknown");

    // eventCount
    it("should fail when eventCount does not match events.length");

    // sentAt
    it("should fail when sentAt is not a valid ISO datetime");
  });

  // ── statusQuerySchema ────────────────────────────────────────────────────────
  describe("statusQuerySchema", () => {
    it("should parse valid deviceToken query param");
    it("should fail when deviceToken query param is missing");
    it("should fail when deviceToken query param is empty");
  });
});
```

> **② Quăng cho AI:** "Đây là schema Zod cần viết để pass các test trên. Interface input/output đã có trong `agent.dto.ts`."

> **③ AI trả về `agent.validation.ts`** → copy dán → chạy test.

---

#### Bước 1.3 — `agent.middleware.ts` + TEST ⭐

**Mục đích:** Xác thực `X-Device-Token` header từ Agent. Tương tự `auth.middleware.ts` nhưng dành cho device.

```
BE/guardeye-sever/src/features/agent/agent.middleware.ts   [NEW]
BE/guardeye-sever/test/agent/agent.middleware.test.ts      [NEW]
```

**Interface cần mock:**
- `req.headers["x-device-token"]`
- `agentRepository.findByDeviceToken(token)` → trả về `IDevice | null`

**Test cases cần viết:**

```typescript
describe("agentAuthenticate middleware", () => {

  // Mock agentRepository
  jest.mock("../../src/features/agent/agent.repository");

  describe("khi header X-Device-Token hợp lệ và device tồn tại", () => {
    it("should call next() and attach device to req.device");
  });

  describe("khi không có header X-Device-Token", () => {
    it("should return 401 with MISSING_DEVICE_TOKEN code");
  });

  describe("khi header X-Device-Token rỗng", () => {
    it("should return 401 with MISSING_DEVICE_TOKEN code");
  });

  describe("khi device token không tồn tại trong DB", () => {
    it("should return 401 with INVALID_DEVICE_TOKEN code");
  });

  describe("khi device bị deactivated", () => {
    it("should return 403 with DEVICE_INACTIVE code");
  });

  describe("khi DB throw lỗi", () => {
    it("should return 500 and not leak error details");
  });
});
```

> **Nguyên tắc mock:** `agentRepository` phải được mock hoàn toàn — không có DB thật.

---

#### Bước 1.4 — `agent.model.ts` (Không cần test — Mongoose Schema)

**Mục đích:** Lưu thông tin device đã đăng ký, bao gồm `deviceToken`.

```
BE/guardeye-sever/src/features/agent/agent.model.ts   [NEW]
```

**Schema đề xuất:**

```typescript
interface IDevice {
  deviceToken: string;  // unique, index
  ownerId: ObjectId;    // ref User (phụ huynh)
  childName: string;    // tên hiển thị của trẻ
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

> **Lý do không test Model:** Mongoose schema là định nghĩa cấu trúc, không phải logic.
> Test Mongoose là I/O DB → thuộc Integration Test, không phải Unit Test.

---

#### Bước 1.5 — `agent.repository.ts` + TEST (chỉ test interface) ⭐

**Mục đích:** Data access layer — không chứa logic, chỉ query DB.

```
BE/guardeye-sever/src/features/agent/agent.repository.ts   [NEW]
BE/guardeye-sever/test/agent/agent.repository.test.ts      [NEW]
```

**Lưu ý quan trọng:** Repository test phải mock Mongoose model.

```typescript
// Cấu trúc repository cần tạo
class AgentRepository {
  findByDeviceToken(token: string): Promise<IDevice | null>
  updateLastSeen(deviceId: string): Promise<void>
  saveEvents(deviceId: string, events: AgentEventDto[]): Promise<number>
  getDeviceStatus(deviceId: string): Promise<{ paused: boolean; since?: Date; reason?: string }>
}
```

**Test cases (mock Mongoose):**

```typescript
describe("AgentRepository", () => {
  // Mock toàn bộ Mongoose model
  jest.mock("../../src/features/agent/agent.model");

  describe("findByDeviceToken", () => {
    it("should return device when token exists");
    it("should return null when token does not exist");
  });

  describe("saveEvents", () => {
    it("should return count of saved events");
    it("should return 0 when events array is empty");
  });

  describe("getDeviceStatus", () => {
    it("should return { paused: false } when device is not paused");
    it("should return { paused: true, since, reason } when device is paused");
  });
});
```

---

#### Bước 1.6 — `agent.service.ts` + TEST ⭐⭐ (Quan trọng nhất)

**Đây là tầng Business Logic — cần test kỹ nhất.**

```
BE/guardeye-sever/src/features/agent/agent.service.ts   [NEW]
BE/guardeye-sever/test/agent/agent.service.test.ts      [NEW]
```

**Interface của Service:**

```typescript
class AgentService {
  // Xử lý batch events từ agent
  async syncEvents(dto: SyncRequestDto, deviceId: string): Promise<SyncResponseDto>

  // Lấy trạng thái pause của device
  async getStatus(deviceId: string): Promise<AgentStatusResponseDto>
}
```

**Test cases — mock agentRepository hoàn toàn:**

```typescript
describe("AgentService", () => {
  // Mock dependency
  jest.mock("../../src/features/agent/agent.repository");
  let mockRepo: jest.Mocked<AgentRepository>;
  let service: AgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new AgentRepository() as jest.Mocked<AgentRepository>;
    service = new AgentService(mockRepo); // DI
  });

  // ── syncEvents ──────────────────────────────────────────────────────────────
  describe("syncEvents", () => {

    it("should return savedCount equal to events.length on success");

    it("should call updateLastSeen after successful sync");

    it("should return savedCount: 0 when events array is empty");

    it("should throw error when eventCount does not match events.length");
    // Arrange: dto.eventCount = 5, nhưng dto.events.length = 3
    // Act: service.syncEvents(dto, deviceId)
    // Assert: rejects.toThrow("eventCount không khớp")

    it("should still return partial count when some events fail to save");
  });

  // ── getStatus ───────────────────────────────────────────────────────────────
  describe("getStatus", () => {

    it("should return { paused: false } when device is not paused");
    // Arrange: mockRepo.getDeviceStatus.mockResolvedValue({ paused: false })
    // Assert: result.paused === false, result.since === undefined

    it("should return { paused: true, since, reason } when device is paused");
    // Arrange: mockRepo.getDeviceStatus.mockResolvedValue({
    //   paused: true, since: new Date("2024-01-01"), reason: "Giờ học"
    // })
    // Assert: result.paused === true, result.since là ISO string, result.reason === "Giờ học"

    it("should convert Date to ISO string in response");
    // Since: Date object → phải convert sang string ISO 8601
  });
});
```

---

#### Bước 1.7 — `agent.controller.ts` + TEST ⭐

**Mục đích:** Nhận HTTP request → gọi Service → trả response.

```
BE/guardeye-sever/src/features/agent/agent.controller.ts   [NEW]
BE/guardeye-sever/test/agent/agent.controller.test.ts      [NEW]
```

**Test pattern:** Mock `agentService`, dùng `jest.fn()` cho `req`, `res`, `next`.

```typescript
describe("AgentController", () => {
  jest.mock("../../src/features/agent/agent.service");
  let mockService: jest.Mocked<AgentService>;

  describe("syncEvents controller", () => {
    it("should respond 200 with savedCount on success");
    it("should call next(error) when service throws");
    it("should pass deviceId from req.device to service");
  });

  describe("getStatus controller", () => {
    it("should respond 200 with paused status");
    it("should call next(error) when service throws");
  });
});
```

---

#### Bước 1.8 — `agent.routes.ts` + Đăng ký vào Router

**Không cần test** — routes chỉ khai báo, không chứa logic.

```
BE/guardeye-sever/src/features/agent/agent.routes.ts   [NEW]
```

```typescript
// Route definition
router.get("/status", agentAuthenticate, agentController.getStatus);
router.post("/sync",  agentAuthenticate, validate(syncSchema), agentController.syncEvents);
```

**Cập nhật `routes/index.ts`:**
```typescript
router.use("/agent", agentRoutes); // Thêm dòng này
```

---

### PHASE 2 — Agent: Bổ Sung Test Cho Các Module Còn Thiếu

#### Bước 2.1 — `SyncService.test.ts` ⭐⭐

**File cần tạo:**
```
agent/tests/sync/SyncService.test.ts   [NEW]
```

**Mock strategy:**
- `fetchFn` inject qua DI constructor (đã có trong code!)
- `DataBuffer` — tạo instance thật (không cần mock, pure in-memory)

```typescript
describe("SyncService", () => {
  let buffer: DataBuffer;
  let mockFetch: jest.Mock;
  let service: SyncService;
  const config = {
    deviceToken: "test-token",
    serverUrl: "http://localhost:3000",
    syncIntervalMs: 60_000,
    // ... other fields
  };

  beforeEach(() => {
    jest.clearAllMocks();
    buffer = new DataBuffer(100);
    mockFetch = jest.fn();
    service = new SyncService({ config, buffer, fetchFn: mockFetch });
  });

  describe("syncOnce (via flushNow)", () => {

    it("should not call fetch when buffer is empty");

    it("should POST to /api/agent/sync with correct payload");
    // Assert: mockFetch được gọi với URL đúng, method POST, headers đúng

    it("should clear buffer after HTTP 200 response");
    // Arrange: buffer có 5 events, mockFetch trả về 200
    // Assert: buffer.isEmpty === true sau khi flushNow()

    it("should NOT clear buffer when HTTP 500 response");
    // Arrange: buffer có 5 events, mockFetch trả về 500
    // Assert: buffer.size === 5 sau khi flushNow()

    it("should NOT clear buffer when fetch throws network error");
    // Arrange: mockFetch.mockRejectedValue(new Error("Network error"))
    // Assert: buffer.size === 5, không throw ra ngoài

    it("should NOT clear buffer when request times out (AbortError)");
    // Arrange: mockFetch.mockRejectedValue(
    //   Object.assign(new Error("Aborted"), { name: "AbortError" })
    // )

    it("should update successCount stats after successful sync");

    it("should update failureCount stats after failed sync");

    it("should include correct X-Device-Token header");
    // Assert: mockFetch.mock.calls[0][1].headers["X-Device-Token"] === "test-token"
  });

  describe("start/stop lifecycle", () => {
    it("should not sync immediately on start");
    it("should warn when start() called twice");
    it("should stop interval when stop() is called");
  });

  describe("getStats", () => {
    it("should return immutable stats object");
    it("should return initial zero stats before any sync");
  });
});
```

---

#### Bước 2.2 — `PauseController.test.ts` ⭐⭐

**File cần tạo:**
```
agent/tests/guards/PauseController.test.ts   [NEW]
```

**Mock strategy:**
- `fetchFn` inject qua constructor (đã có trong code!)
- Fake timers: `jest.useFakeTimers()` để kiểm soát `setInterval`

```typescript
describe("PauseController", () => {
  let mockFetch: jest.Mock;
  let controller: PauseController;
  const config = {
    deviceToken: "test-token",
    serverUrl: "http://localhost:3000",
    pausePollIntervalMs: 30_000,
    // ...
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetch = jest.fn();
    controller = new PauseController({ config, fetchFn: mockFetch });
  });

  afterEach(() => {
    controller.stop();
    jest.useRealTimers();
  });

  describe("getIsPaused — trạng thái cache", () => {
    it("should return false initially (not paused by default)");
  });

  describe("start() — poll lần đầu ngay lập tức", () => {

    it("should poll immediately on start (not wait for interval)");
    // Arrange: mockFetch trả về { paused: false }
    // Act: await controller.start()
    // Assert: mockFetch called once

    it("should set isPaused to true when server returns paused: true");
    // Arrange: mockFetch returns { paused: true, since: "...", reason: "Giờ học" }
    // Assert: controller.getIsPaused() === true

    it("should set isPaused to false when server returns paused: false");

    it("should keep old paused state when fetch throws (fail-safe)");
    // Arrange: controller đang paused, mockFetch throws
    // Assert: controller.getIsPaused() vẫn là true

    it("should keep old paused state when server returns non-200 (fail-safe)");
  });

  describe("poll URL và headers", () => {
    it("should call GET /api/agent/status with deviceToken in query string");
    it("should include X-Device-Token header in request");
  });

  describe("consecutive failures", () => {
    it("should increment consecutiveFailures when fetch fails");
    it("should reset consecutiveFailures to 0 after successful poll");
  });

  describe("stop()", () => {
    it("should stop polling interval when stop() is called");
  });
});
```

---

#### Bước 2.3 — `WindowMonitor.test.ts` ⭐

**File cần tạo:**
```
agent/tests/collectors/WindowMonitor.test.ts   [NEW]
```

**Mock strategy:**
- `active-win` là I/O (đọc thông tin window từ OS) → **phải mock**
- `IncognitoDetector` → inject qua constructor (đã có DI)

```typescript
// Mock active-win module
jest.mock("active-win");
import activeWin from "active-win";

describe("WindowMonitor", () => {
  let mockIncognitoDetector: jest.Mocked<IncognitoDetector>;
  let monitor: WindowMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIncognitoDetector = {
      check: jest.fn().mockReturnValue({ isIncognito: false, matchedKeyword: null })
    } as any;
    monitor = new WindowMonitor({ incognitoDetector: mockIncognitoDetector });
  });

  describe("collect()", () => {

    it("should return WindowEvent with correct fields when window is active");
    // Arrange: (activeWin as jest.Mock).mockResolvedValue({
    //   title: "Google - Chrome",
    //   owner: { path: "C:\\chrome.exe", name: "chrome" }
    // })
    // Assert: result.type === "window", result.title === "Google - Chrome"

    it("should return null when active-win returns undefined (no window)");

    it("should return null when title did not change (dedup)");
    // Gọi collect() 2 lần liên tiếp với cùng title → lần 2 return null

    it("should return new event when title changes");

    it("should set isIncognito: true when IncognitoDetector.check returns true");

    it("should use basename of owner.path as processName");
    // path: "C:\\Program Files\\Google\\Chrome\\chrome.exe"
    // → processName: "chrome.exe"

    it("should fallback to owner.name when owner.path is empty");

    it("should return null (not throw) when active-win throws");
    // active-win throws → collect() trả về null, không crash
  });
});
```

---

#### Bước 2.4 — `IncognitoDetector.test.ts` ⭐

**File cần tạo:**
```
agent/tests/collectors/IncognitoDetector.test.ts   [NEW]
```

**Lưu ý:** Module này là **pure logic** — không có I/O nào → test rất đơn giản, không cần mock.

```typescript
describe("IncognitoDetector", () => {
  let detector: IncognitoDetector;

  beforeEach(() => {
    detector = new IncognitoDetector();
  });

  describe("check()", () => {
    // Happy path — phát hiện đúng
    it('should detect "incognito" in title');
    it('should detect "private browsing" in title (case insensitive)');
    it('should detect "InPrivate" in title (case insensitive)');
    it('should detect "Private Window" in title');

    // Not incognito
    it("should return isIncognito: false for normal browser title");
    it("should return matchedKeyword: null when not incognito");

    // Extra keywords
    it("should detect custom keyword passed via constructor");

    // Edge cases
    it("should handle empty string title");
    it("should handle title with no keywords");
  });
});
```

---

#### Bước 2.5 — `UserGuard.test.ts` ⭐

**File cần tạo:**
```
agent/tests/guards/UserGuard.test.ts   [NEW]
```

**Mock strategy:** `os.userInfo()` là I/O (OS call) → phải mock.

```typescript
jest.mock("os");
import * as os from "os";

describe("UserGuard", () => {

  describe("isAllowed()", () => {
    it("should return true when current username is in monitoredUsers");
    it("should return false when current username is not in monitoredUsers");

    it("should be case insensitive by default");
    // monitoredUsers: ["John"], os.userInfo().username = "john" → allowed

    it("should be case sensitive when caseInsensitive: false");

    it("should return false (not throw) when os.userInfo() throws");
    // Arrange: (os.userInfo as jest.Mock).mockImplementation(() => { throw new Error() })

    it("should use cached result for same username");
    it("should invalidate cache when username changes");
  });

  describe("getMonitoredUsers()", () => {
    it("should return the list of monitored users");
  });
});
```

---

#### Bước 2.6 — `DataBuffer.test.ts` ⭐ (Pure logic — không cần mock)

**File cần tạo:**
```
agent/tests/sync/DataBuffer.test.ts   [NEW]
```

```typescript
describe("DataBuffer", () => {
  const makeWindowEvent = (title: string): WindowEvent => ({
    type: "window",
    timestamp: new Date().toISOString(),
    title,
    processName: "chrome.exe",
    isIncognito: false,
  });

  describe("push()", () => {
    it("should increase size by 1");
    it("should evict oldest event (FIFO) when buffer is full");
    // Arrange: maxSize = 3, push 4 events
    // Assert: size = 3, oldest event đã bị xóa
  });

  describe("pushMany()", () => {
    it("should push all events when buffer has capacity");
    it("should evict oldest events when batch exceeds capacity");
  });

  describe("snapshot()", () => {
    it("should return a copy, not the original array reference");
    it("should not be affected when original buffer is cleared after snapshot");
  });

  describe("clear()", () => {
    it("should set size to 0 and isEmpty to true");
  });

  describe("isEmpty", () => {
    it("should return true for new buffer");
    it("should return false after push");
    it("should return true after clear");
  });
});
```

---

### PHASE 3 — Kết Nối Thực Tế & Cấu Hình

#### Bước 3.1 — Cập nhật `config.json` của Agent

```json
{
  "deviceToken": "<token-thật-từ-DB-sau-khi-tạo-device>",
  "serverUrl": "http://localhost:3000",
  "monitoredUsers": ["<Windows-username-của-trẻ>"],
  "syncIntervalMs": 300000,
  "mainLoopIntervalMs": 5000,
  "pausePollIntervalMs": 30000
}
```

#### Bước 3.2 — Cập nhật `.env` của Server

```env
# Thêm vào .env nếu cần cấu hình prefix API
AGENT_API_PREFIX=/api/agent
```

#### Bước 3.3 — Seed dữ liệu Device Token (Script 1 lần)

Tạo script `scripts/seed-device.ts` để tạo device token đầu tiên trong DB.

---

## Thứ Tự Thực Hiện Gợi Ý

```
Phase 1 (Server — từ dưới lên trên):
  1. agent.dto.ts              (types, không test)
  2. agent.model.ts            (schema, không test)
  3. agent.validation.test.ts  → agent.validation.ts
  4. agent.repository.ts       → agent.repository.test.ts
  5. agent.service.test.ts     → agent.service.ts
  6. agent.middleware.test.ts  → agent.middleware.ts
  7. agent.controller.test.ts  → agent.controller.ts
  8. agent.routes.ts           (routes, không test)
  9. Cập nhật routes/index.ts

Phase 2 (Agent — pure logic trước):
  10. DataBuffer.test.ts        → (DataBuffer đã có code, chỉ viết test)
  11. IncognitoDetector.test.ts → (IncognitoDetector đã có code)
  12. UserGuard.test.ts         → (UserGuard đã có code)
  13. WindowMonitor.test.ts     → (WindowMonitor đã có code, mock active-win)
  14. PauseController.test.ts   → (PauseController đã có code, mock fetch)
  15. SyncService.test.ts       → (SyncService đã có code, mock fetch)

Phase 3 (Integration):
  16. Cấu hình config.json thật
  17. Seed device token
  18. Chạy thật npm run dev (cả 2 phía)
```

---

## Cheat Sheet: Quy Trình TDD Cho Mỗi Bước

```
1. Viết test (chỉ Arrange + Assert) → Chạy → ĐỎ ✗
2. Copy interface + test → quăng cho AI → nhận code logic
3. Dán code vào file → Chạy test → XANH ✓
4. Nếu đỏ: copy dòng lỗi → quăng lại AI → lặp lại bước 3
5. Refactor nếu cần (test vẫn xanh = an toàn)
6. Đóng file lại (Hộp đen hoàn chỉnh)
```

---

## Cấu Trúc Thư Mục Cuối Cùng

```
BE/guardeye-sever/
├── src/
│   ├── features/
│   │   ├── auth/              ← (đã có)
│   │   └── agent/             ← [NEW]
│   │       ├── agent.dto.ts
│   │       ├── agent.model.ts
│   │       ├── agent.validation.ts
│   │       ├── agent.repository.ts
│   │       ├── agent.service.ts
│   │       ├── agent.middleware.ts
│   │       ├── agent.controller.ts
│   │       └── agent.routes.ts
│   └── routes/
│       └── index.ts           ← thêm /agent route
└── test/
    ├── auth/                  ← (đã có)
    └── agent/                 ← [NEW]
        ├── agent.validation.test.ts
        ├── agent.repository.test.ts
        ├── agent.service.test.ts
        ├── agent.middleware.test.ts
        └── agent.controller.test.ts

agent/
├── src/                       ← (đã có code)
└── tests/
    ├── config/
    │   └── ConfigReader.test.ts   ← (đã có)
    ├── sync/                      ← [NEW]
    │   ├── DataBuffer.test.ts
    │   └── SyncService.test.ts
    ├── guards/                    ← [NEW]
    │   ├── UserGuard.test.ts
    │   └── PauseController.test.ts
    └── collectors/                ← [NEW]
        ├── IncognitoDetector.test.ts
        └── WindowMonitor.test.ts
```

---

## Nguyên Tắc Mock Theo Từng Loại Dependency

| Dependency | Cách Mock | Lý do |
|---|---|---|
| `fetch` (HTTP call) | Inject `fetchFn` qua constructor | Đã có DI sẵn trong Agent code |
| `fs` (file system) | `jest.mock("fs")` | I/O vật lý |
| `os.userInfo()` | `jest.mock("os")` | I/O OS |
| `active-win` | `jest.mock("active-win")` | I/O OS (đọc window info) |
| `better-sqlite3` | `jest.mock("better-sqlite3")` | I/O database file |
| `Mongoose Model` | `jest.mock("../agent.model")` | I/O database |
| `agentRepository` | `jest.mock("../agent.repository")` | Isolate Service khỏi DB |
| `agentService` | `jest.mock("../agent.service")` | Isolate Controller khỏi logic |
| `DataBuffer` | **Không mock** — tạo instance thật | Pure in-memory, không I/O |
| `IncognitoDetector` | **Không mock khi test chính nó** — mock khi là dependency | Pure logic |

---

_Tài liệu này do Senior Engineer tạo ra để hướng dẫn TDD integration giữa Agent và GuardEye Server._
_Cập nhật lần cuối: 2026-06-07_
