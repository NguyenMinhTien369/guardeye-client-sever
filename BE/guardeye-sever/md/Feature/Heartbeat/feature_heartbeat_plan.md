# Kế hoạch Tính năng Heartbeat — Online / Offline Indicator

---

## 📌 API Endpoints — Heartbeat

> **Base URL:** `http://localhost:5000/api/v1`

| Method | Endpoint | Xác thực | Vai trò |
|--------|----------|----------|---------|
| `POST` | `/agent/heartbeat` | X-Device-Token | Agent ping định kỳ để báo "tôi đang sống" |
| `GET` | `/devices` | JWT Bearer | Phụ huynh đọc `lastSeenAt` để biết Agent online/offline |

---

## Tóm tắt

Thêm cơ chế **heartbeat** để hệ thống biết Agent đang chạy hay đã tắt:

1. **Agent** gọi `POST /api/v1/agent/heartbeat` mỗi **60 giây**
2. **BE** nhận ping → cập nhật trường `lastSeenAt` trên document `Device` trong MongoDB
3. **Frontend** đọc `lastSeenAt` từ `GET /api/v1/devices`:
   - Nếu `lastSeenAt` cách hiện tại **≤ 2 phút** → 🟢 **Online**
   - Nếu `lastSeenAt` cách hiện tại **> 2 phút** hoặc `null` → 🔴 **Offline**

---

## Hiện trạng (đã verify trong code)

### Trường `status` hiện tại KHÔNG đủ

Trong [`devices.model.ts`](../../../../../src/features/devices/devices.model.ts):
```typescript
enum DeviceStatus {
  pending  = "pending",   // Mới tạo, chưa cài agent
  active   = "active",    // Agent đã từng kết nối (KHÔNG có nghĩa đang online)
  inactive = "inactive",  // Chỉ set thủ công — không có automation
}
```

**Vấn đề:** `status = "active"` được set 1 lần duy nhất khi Agent kết nối lần đầu (trong `agent.middleware.ts`). Sau đó không bao giờ thay đổi tự động → không phân biệt được Agent đang chạy hay đã tắt từ lâu.

### Chưa có `lastSeenAt`

`IDevice` interface chưa có trường này. Cần bổ sung.

### Agent chưa có HeartbeatService

Agent hiện có:
- `PauseController` — poll `/agent/status` mỗi 30s
- `SyncService` — push events lên `/agent/sync`

Cần thêm `HeartbeatService` — post `/agent/heartbeat` mỗi 60s.

---

## Luồng hoạt động chi tiết

```
Agent khởi động
    │
    ▼
HeartbeatService.start()
    │ poll ngay lần đầu (không chờ 60s)
    ▼
POST /api/v1/agent/heartbeat
[Header: X-Device-Token: <token>]
    │
    ▼  verifyDeviceToken middleware
    │  (xác thực token, tìm Device trong DB)
    │
    ▼  agentController.heartbeat()
    │
    ▼  agentService.recordHeartbeat(deviceId)
    │
    ▼  agentRepository.updateLastSeen(deviceId)
    │  Device.findByIdAndUpdate({ lastSeenAt: new Date() })
    │
    ▼  Response 200: { success: true, message: "Heartbeat ghi nhận" }
    │
    │  [60s sau, lặp lại]
    ▼
...
```

```
Phụ huynh mở Dashboard
    │
    ▼
GET /api/v1/devices
[Header: Authorization: Bearer <JWT>]
    │
    ▼  devices.service.getAll()
    │  trả về mảng DeviceResponseDto
    │  (bao gồm lastSeenAt)
    │
    ▼  Frontend tính toán:
       const now = new Date();
       const twoMinutesAgo = new Date(now - 2 * 60 * 1000);
       const isOnline = lastSeenAt && new Date(lastSeenAt) > twoMinutesAgo;
```

---

## Chi tiết thay đổi cần thực hiện

---

### PHẦN 1 — Backend (BE)

#### [MODIFY] `devices.model.ts`

Thêm trường `lastSeenAt` vào interface và schema:

```typescript
// Thêm vào IDevice interface
lastSeenAt: Date | null;  // Thời điểm Agent ping gần nhất

// Thêm vào Schema
lastSeenAt: {
  type: Date,
  default: null,
  index: true,  // Index vì frontend hay query/sort theo trường này
},
```

---

#### [MODIFY] `devices.dto.ts`

Thêm `lastSeenAt` vào `DeviceResponseDto`:

```typescript
export interface DeviceResponseDto {
  id:             string;
  childId:        string;
  parentId:       string;
  deviceName:     string;
  monitoredUsers: string[];
  status:         string;
  isPaused:       boolean;
  pausedSince:    Date | null;
  pausedUntil:    Date | null;
  lastSeenAt:     Date | null;  // ← THÊM MỚI
  createdAt:      Date;
  updatedAt:      Date;
}
```

---

#### [MODIFY] `devices.service.ts` — hàm `toResponseDto()`

Thêm `lastSeenAt` vào mapping:

```typescript
private toResponseDto(device: IDevice): DeviceResponseDto {
  return {
    // ...các trường hiện có...
    lastSeenAt: device.lastSeenAt,  // ← THÊM MỚI
  };
}
```

---

#### [MODIFY] `agent.repository.ts`

Thêm hàm `updateLastSeen()`:

```typescript
/**
 * Cập nhật lastSeenAt → gọi mỗi khi Agent ping heartbeat.
 */
async updateLastSeen(deviceId: string): Promise<void> {
  await Device.findByIdAndUpdate(
    deviceId,
    { lastSeenAt: new Date() },
    { runValidators: false },
  );
},
```

---

#### [MODIFY] `agent.service.ts`

Thêm hàm `recordHeartbeat()`:

```typescript
/**
 * Xử lý heartbeat từ Agent — chỉ cập nhật lastSeenAt.
 */
async recordHeartbeat(deviceId: string): Promise<void> {
  await agentRepository.updateLastSeen(deviceId);
}
```

---

#### [MODIFY] `agent.controller.ts`

Thêm handler `heartbeat`:

```typescript
/**
 * POST /api/v1/agent/heartbeat
 * Agent ping định kỳ để báo đang chạy.
 */
export const heartbeat = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const deviceId = req.device!._id.toString();
    await agentService.recordHeartbeat(deviceId);
    new OKResponse({
      message: "Heartbeat ghi nhận",
    }).send(res);
  } catch (error) {
    next(error);
  }
};
```

---

#### [MODIFY] `agent.routes.ts`

Đăng ký route mới:

```typescript
// POST /api/v1/agent/heartbeat
// Agent ping định kỳ mỗi 60s để báo đang chạy.
//
// Header bắt buộc: X-Device-Token: <deviceToken>
//
// Response:
//   200 — { success: true, message: "Heartbeat ghi nhận" }
//   401 — deviceToken không hợp lệ
router.post(
  "/heartbeat",
  verifyDeviceToken,        // ① Xác thực X-Device-Token
  agentController.heartbeat, // ② Cập nhật lastSeenAt
);
```

---

### PHẦN 2 — Agent (Desktop Client)

#### [NEW] `src/services/HeartbeatService.ts`

```typescript
import { AgentConfig } from "../types/agent.types";

export interface HeartbeatServiceOptions {
  config: AgentConfig;
  fetchFn?: typeof fetch;
}

/**
 * HeartbeatService — ping /agent/heartbeat định kỳ để BE biết Agent đang chạy.
 *
 * Thiết kế:
 *  - Fail-safe: nếu ping thất bại → chỉ log cảnh báo, không crash agent.
 *  - Ping ngay lần đầu khi start() để BE cập nhật lastSeenAt sớm nhất có thể.
 *  - Interval mặc định: 60s (cấu hình qua config.heartbeatIntervalMs).
 */
export class HeartbeatService {
  private readonly config: AgentConfig;
  private readonly fetchFn: typeof fetch;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures: number = 0;

  private static readonly FAILURE_WARN_THRESHOLD = 3;

  constructor(options: HeartbeatServiceOptions) {
    this.config = options.config;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // Ping ngay lần đầu, sau đó lặp mỗi heartbeatIntervalMs
  public async start(): Promise<void> {
    if (this.intervalHandle !== null) return;

    await this.ping();

    this.intervalHandle = setInterval(async () => {
      await this.ping();
    }, this.config.heartbeatIntervalMs);

    console.log(
      `[HeartbeatService] Đã khởi động, ping mỗi ${this.config.heartbeatIntervalMs / 1000}s.`,
    );
  }

  public stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("[HeartbeatService] Đã dừng.");
    }
  }

  private async ping(): Promise<void> {
    const url = `${this.config.serverUrl.replace(/\/$/, "")}/api/v1/agent/heartbeat`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);

      const response = await this.fetchFn(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": this.config.deviceToken,
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      // Reset counter khi thành công
      if (this.consecutiveFailures > 0) {
        console.log("[HeartbeatService] Kết nối lại thành công ✓");
      }
      this.consecutiveFailures = 0;

    } catch (err) {
      this.consecutiveFailures++;
      const shouldLog =
        this.consecutiveFailures === 1 ||
        this.consecutiveFailures % HeartbeatService.FAILURE_WARN_THRESHOLD === 0;

      if (shouldLog) {
        console.warn(
          `[HeartbeatService] Ping thất bại lần ${this.consecutiveFailures}: ` +
          `${(err as Error).message} — BE sẽ thấy device Offline sau 2 phút.`,
        );
      }
    }
  }
}
```

---

#### [MODIFY] `agent.types.ts` — `AgentConfig`

Thêm trường mới:

```typescript
export interface AgentConfig {
  deviceToken:          string;
  serverUrl:            string;
  monitoredUsers:       string[];
  syncIntervalMs:       number;
  mainLoopIntervalMs:   number;
  pausePollIntervalMs:  number;
  heartbeatIntervalMs:  number;  // ← THÊM MỚI (mặc định: 60_000)
}
```

---

#### [MODIFY] `agent/config.json`

Thêm giá trị mặc định:

```json
{
  "deviceToken": "fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5",
  "serverUrl": "http://localhost:5000",
  "monitoredUsers": ["MinhCup"],
  "syncIntervalMs": 300000,
  "mainLoopIntervalMs": 5000,
  "pausePollIntervalMs": 30000,
  "heartbeatIntervalMs": 60000
}
```

---

#### [MODIFY] `ConfigReader.ts`

Thêm validate và default cho `heartbeatIntervalMs`:

```typescript
heartbeatIntervalMs: parsed.heartbeatIntervalMs ?? 60_000,
```

---

#### [MODIFY] `src/index.ts`

Khởi tạo và quản lý `HeartbeatService`:

```typescript
import { HeartbeatService } from "./services/HeartbeatService";

// Trong bootstrap():
const heartbeatService = new HeartbeatService({ config });

// Trong registerShutdownHandlers():
heartbeatService.stop();

// Sau pauseController.start():
await heartbeatService.start();
```

---

### PHẦN 3 — Frontend (Logic gợi ý)

Không cần API mới — đọc `lastSeenAt` từ `GET /api/v1/devices`:

```javascript
// Hàm tính toán trạng thái online/offline
function getDeviceOnlineStatus(device) {
  if (!device.lastSeenAt) return "offline";  // Chưa từng ping

  const now = new Date();
  const lastSeen = new Date(device.lastSeenAt);
  const diffMs = now - lastSeen;
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes <= 2 ? "online" : "offline";
}

// Hiển thị
// "online"  → 🟢 Online
// "offline" → 🔴 Offline (hoặc hiện kèm "Lần cuối thấy: X phút trước")
```

---

## Thứ tự code (khuyến nghị)

```
Bước 1 — BE Model
  └─ devices.model.ts    thêm lastSeenAt vào IDevice + Schema

Bước 2 — BE Repository
  └─ agent.repository.ts  thêm updateLastSeen()

Bước 3 — BE Service + Controller + Route
  └─ agent.service.ts     thêm recordHeartbeat()
  └─ agent.controller.ts  thêm handler heartbeat
  └─ agent.routes.ts      đăng ký POST /heartbeat

Bước 4 — BE DTO
  └─ devices.dto.ts       thêm lastSeenAt vào DeviceResponseDto
  └─ devices.service.ts   thêm lastSeenAt vào toResponseDto()

Bước 5 — Agent Types + Config
  └─ agent.types.ts       thêm heartbeatIntervalMs vào AgentConfig
  └─ config.json          thêm heartbeatIntervalMs: 60000
  └─ ConfigReader.ts      thêm validate/default

Bước 6 — Agent Service
  └─ HeartbeatService.ts  tạo mới

Bước 7 — Agent Entry Point
  └─ index.ts             khởi tạo + lifecycle HeartbeatService
```

---

## Hướng dẫn Test Thủ Công

### Kịch bản 1 — Xác nhận heartbeat được ghi nhận

#### 1a. Gọi trực tiếp POST /agent/heartbeat

```http
POST http://localhost:5000/api/v1/agent/heartbeat
X-Device-Token: fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Heartbeat ghi nhận"
}
```

#### 1b. Kiểm tra `lastSeenAt` đã được cập nhật

```http
GET http://localhost:5000/api/v1/devices
Authorization: Bearer <accessToken>
```

**Response mong đợi — `lastSeenAt` vừa được cập nhật:**
```json
{
  "data": [
    {
      "id": "6a292fe7e72f521646e7feca",
      "deviceName": "Laptop của Minh",
      "lastSeenAt": "2026-07-09T15:20:00.000Z",
      "isPaused": false
    }
  ]
}
```

> ✅ **Kiểm tra:** `lastSeenAt` phải là thời điểm vừa gọi, không phải `null`.

---

### Kịch bản 2 — Agent đang chạy → hiển thị Online

Khi Agent đang chạy, cứ mỗi 60s sẽ tự ping. Gọi `GET /devices` và kiểm tra:

- `lastSeenAt` cách hiện tại < 2 phút → **🟢 Online**

**Log Agent mong đợi:**
```
[HeartbeatService] Đã khởi động, ping mỗi 60s.
```
*(sau 60s)*
*(không log vì ping thành công và consecutiveFailures = 0)*

---

### Kịch bản 3 — Tắt Agent → sau 2 phút hiển thị Offline

1. Tắt Agent (Ctrl+C)
2. Chờ 2 phút
3. Gọi `GET /api/v1/devices`
4. `lastSeenAt` cách hiện tại > 2 phút → **🔴 Offline**

> ⚠️ **Lưu ý:** BE không tự động cập nhật `status = "inactive"` — đây là thiết kế cố ý. Frontend tự tính `online/offline` dựa vào `lastSeenAt` để tránh cần thêm background job/scheduler phức tạp ở BE.

---

### Kịch bản 4 — Token sai (401)

```http
POST http://localhost:5000/api/v1/agent/heartbeat
X-Device-Token: token_sai
```

**Response mong đợi (401):**
```json
{
  "success": false,
  "message": "Device token không hợp lệ"
}
```

---

## Bảng tóm tắt file thay đổi

| File | Loại | Thay đổi |
|------|------|---------|
| `BE/src/features/devices/devices.model.ts` | MODIFY | Thêm `lastSeenAt: Date \| null` vào IDevice + Schema |
| `BE/src/features/devices/devices.dto.ts` | MODIFY | Thêm `lastSeenAt` vào `DeviceResponseDto` |
| `BE/src/features/devices/devices.service.ts` | MODIFY | Map `lastSeenAt` trong `toResponseDto()` |
| `BE/src/features/agent/agent.repository.ts` | MODIFY | Thêm hàm `updateLastSeen()` |
| `BE/src/features/agent/agent.service.ts` | MODIFY | Thêm hàm `recordHeartbeat()` |
| `BE/src/features/agent/agent.controller.ts` | MODIFY | Thêm handler `heartbeat` |
| `BE/src/features/agent/agent.routes.ts` | MODIFY | Đăng ký `POST /heartbeat` |
| `agent/src/types/agent.types.ts` | MODIFY | Thêm `heartbeatIntervalMs` vào `AgentConfig` |
| `agent/config.json` | MODIFY | Thêm `heartbeatIntervalMs: 60000` |
| `agent/src/config/ConfigReader.ts` | MODIFY | Thêm validate/default `heartbeatIntervalMs` |
| `agent/src/services/HeartbeatService.ts` | **NEW** | Tạo mới toàn bộ |
| `agent/src/index.ts` | MODIFY | Khởi tạo + lifecycle `HeartbeatService` |
