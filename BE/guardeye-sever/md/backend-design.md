# GuardEye — Backend Design Document

> **Vai trò tài liệu**: Đặc tả kỹ thuật cho phần Backend phục vụ Windows Agent (Parental Control).
> **Phiên bản**: 1.0 | **Ngày**: 2026-06-04
> **Tác giả**: Senior Solution Architect

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Tech Stack & Lý do chọn](#2-tech-stack--lý-do-chọn)
3. [Database Schema (MongoDB)](#3-database-schema-mongodb)
4. [Cấu trúc thư mục Backend](#4-cấu-trúc-thư-mục-backend)
5. [Đặc tả API](#5-đặc-tả-api)
   - [5.1 POST /api/v1/agent/sync](#51-post-apiv1agentsync)
   - [5.2 GET /api/v1/agent/status](#52-get-apiv1agentstatus)
6. [Xử lý Logic & Edge Cases](#6-xử-lý-logic--edge-cases)
7. [Kế hoạch triển khai (Implementation Roadmap)](#7-kế-hoạch-triển-khai-implementation-roadmap)
8. [Mẫu Payload JSON để test Postman](#8-mẫu-payload-json-để-test-postman)

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         HỆ THỐNG GUARDEYE                                │
├─────────────────────────┬────────────────────────────────────────────────┤
│   MÁY CON (Windows)     │               SERVER BACKEND                   │
│                         │                                                │
│  ┌─────────────────┐    │   ┌──────────────────────────────────────────┐ │
│  │  Windows Agent  │    │   │         Express + TypeScript             │ │
│  │  (.exe / Node)  │───►│──►│  /api/v1/agent/sync  (POST, mỗi 5 phút) │ │
│  │                 │◄───│◄──│  /api/v1/agent/status (GET, mỗi 30s)    │ │
│  └─────────────────┘    │   └──────────────┬───────────────────────────┘ │
│                         │                  │                             │
│  ┌─────────────────┐    │   ┌──────────────▼───────────────────────────┐ │
│  │  Dashboard Web  │    │   │           MongoDB Atlas                  │ │
│  │  (Phụ huynh)    │───►│──►│  users | devices | windowEvents          │ │
│  └─────────────────┘    │   │          | historyEvents                 │ │
│                         │   └──────────────────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────────────────────┘
```

**Luồng dữ liệu chính:**
1. Agent → `POST /sync` → Backend parse → Bulk Insert MongoDB → `200 OK` → Agent clear buffer
2. Agent → `GET /status` → Backend tra cứu trạng thái device → `{ paused: bool }` → Agent quyết định chạy/dừng

---

## 2. Tech Stack & Lý do chọn

### Hiện tại (giữ nguyên, tận dụng code đã có)

| Layer | Công nghệ | Lý do |
|---|---|---|
| Runtime | **Node.js 20+** | Agent viết Node.js → backend cùng ecosystem, chia sẻ types dễ dàng |
| Framework | **Express 5 + TypeScript** | Đã setup sẵn trong `src/app.ts`, kiến trúc feature-based sạch |
| Database | **MongoDB (Mongoose)** | Đã kết nối qua `src/shared/config/db.ts`; schema-flexible phù hợp với `AgentEvent` có 2 shape khác nhau |
| Auth (User) | **JWT Access/Refresh Token** | Đã implement trong `auth.middleware.ts` |

### Mới cần thêm cho Agent feature

| Thành phần | Công nghệ đề xuất | Lý do |
|---|---|---|
| **Device Token Auth** | **Static hashed token** lưu trong `Device` document | Nhẹ hơn JWT (không cần verify signature), phù hợp machine-to-machine |
| **Rate Limiting** | `rateLimiter.middleware.ts` đã có sẵn | Chống Agent bị lợi dụng gửi spam |
| **Bulk Insert** | `Model.insertMany({ ordered: false })` | MongoDB native bulk, tốc độ cao, không dừng khi có 1 doc lỗi |
| **Input Validation** | **Zod** | Type-safe, parse ra TypeScript type trực tiếp, không cần transform thêm |

### Tại sao MongoDB phù hợp cho time-series event?

```
WindowEvent & HistoryEvent là "append-only" data:
  ✅ Không cần JOIN — mỗi event tự đứng độc lập
  ✅ Schema flexible — WindowEvent và HistoryEvent có fields khác nhau
  ✅ insertMany() cực nhanh cho write-heavy workload
  ✅ TTL Index — tự động xóa data cũ sau N ngày mà không cần cron job
  ✅ Aggregation Pipeline — query dashboard (group by day, top sites, v.v.)
```

---

## 3. Database Schema (MongoDB)

### 3.1 Collection: `devices`

Mỗi thiết bị của trẻ được đăng ký 1 document. `deviceToken` được dùng để Agent xác thực.

```typescript
// src/features/agent/agent.model.ts

interface IDevice extends Document {
  /** Tham chiếu đến tài khoản phụ huynh sở hữu thiết bị này */
  ownerId: Types.ObjectId;         // ref: 'User'

  /** Tên hiển thị của thiết bị (VD: "Laptop con trai") */
  name: string;

  /** Token bí mật, được hash SHA-256 trước khi lưu.
   *  Agent giữ plain token trong config.json của nó. */
  tokenHash: string;               // SHA-256(plain_token)

  /** Trạng thái tạm dừng giám sát do phụ huynh bấm nút */
  isPaused: boolean;

  /** Lý do tạm dừng (optional, hiển thị trên Dashboard) */
  pauseReason?: string;

  /** Thời điểm Agent sync thành công lần cuối (heartbeat) */
  lastSeenAt: Date | null;

  /** Agent có đang online không (tính từ lastSeenAt < 10 phút) */
  // → tính toán ở application layer, không lưu DB

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Index cần thiết:**
```javascript
// Lookup nhanh khi Agent gửi request (xảy ra mỗi 30s)
db.devices.createIndex({ tokenHash: 1 }, { unique: true });

// Dashboard phụ huynh: lấy danh sách thiết bị theo ownerId
db.devices.createIndex({ ownerId: 1, isActive: 1 });
```

---

### 3.2 Collection: `windowevents`

Lưu thông tin cửa sổ active trên máy trẻ.

```typescript
interface IWindowEvent extends Document {
  /** Thiết bị gửi event này */
  deviceId: Types.ObjectId;        // ref: 'Device'

  /** Phụ huynh sở hữu (denormalized để query dashboard 1 hop) */
  ownerId: Types.ObjectId;         // ref: 'User'

  /** Thời điểm Agent thu thập (từ Agent gửi lên) */
  timestamp: Date;

  /** Tiêu đề cửa sổ đang active */
  title: string;

  /** Tên file .exe của process (vd: "chrome.exe") */
  processName: string;

  /** Có phải cửa sổ ẩn danh (Incognito) không */
  isIncognito: boolean;

  /** Ngày thu thập dạng "YYYY-MM-DD" — dùng để group by day nhanh */
  dateKey: string;
}
```

**Index cần thiết:**
```javascript
// Query cơ bản của Dashboard: xem lịch sử 1 thiết bị theo ngày
db.windowevents.createIndex({ deviceId: 1, timestamp: -1 });

// Group by day cho biểu đồ thống kê
db.windowevents.createIndex({ deviceId: 1, dateKey: 1 });

// TTL: tự động xóa event cũ hơn 90 ngày (tùy config)
db.windowevents.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 90 * 24 * 3600 }
);
```

---

### 3.3 Collection: `historyevents`

Lưu lịch sử duyệt web từ Chrome/Edge.

```typescript
interface IHistoryEvent extends Document {
  deviceId: Types.ObjectId;
  ownerId: Types.ObjectId;

  /** Thời điểm Agent thu thập */
  timestamp: Date;

  /** URL đã truy cập */
  url: string;

  /** Tiêu đề trang */
  title: string;

  /** Trình duyệt nguồn */
  browser: "chrome" | "edge" | "unknown";

  /** Thời điểm trình duyệt ghi nhận visit (từ SQLite) */
  visitTime: Date;

  /** Domain trích ra từ url — dùng để group "top sites" nhanh */
  domain: string;

  /** Ngày thu thập "YYYY-MM-DD" */
  dateKey: string;
}
```

**Index cần thiết:**
```javascript
db.historyevents.createIndex({ deviceId: 1, visitTime: -1 });

// Top domain query
db.historyevents.createIndex({ deviceId: 1, domain: 1 });

// TTL 90 ngày
db.historyevents.createIndex(
  { visitTime: 1 },
  { expireAfterSeconds: 90 * 24 * 3600 }
);
```

---

### 3.4 Sơ đồ quan hệ

```
User (phụ huynh)
 │ _id ─────────────────────────────────────────────┐
 │                                                  │
 └──► Device (thiết bị trẻ)                         │
       │ _id ──────────────────────┐                │
       │ ownerId ──────────────────┘────────────────┘
       │
       ├──► WindowEvent (n documents)
       │     deviceId → Device._id
       │     ownerId  → User._id  (denormalized)
       │
       └──► HistoryEvent (n documents)
             deviceId → Device._id
             ownerId  → User._id  (denormalized)
```

> **Tại sao denormalize `ownerId` vào event?**
> Dashboard query theo phụ huynh (`ownerId`) rất phổ biến.
> Nếu không denormalize, phải lookup qua Device → tốn thêm 1 hop.
> Với time-series data write-heavy, trade-off này hoàn toàn hợp lý.

---

## 4. Cấu trúc thư mục Backend

```
src/
├── app.ts                          # Express setup (đã có)
├── index.ts                        # Entry point (đã có)
│
├── routes/
│   └── index.ts                    # Gắn /auth, /agent vào router chính
│
├── features/
│   ├── auth/                       # Đã có (login, register, refresh token)
│   │   └── ...
│   │
│   └── agent/                      # ← MỚI: toàn bộ logic Agent
│       ├── agent.model.ts          # Device model (Mongoose schema)
│       ├── agent.dto.ts            # Zod schemas (validate payload từ Agent)
│       ├── agent.repository.ts     # DB queries (findByTokenHash, bulkInsert)
│       ├── agent.service.ts        # Business logic (xử lý sync, check status)
│       ├── agent.controller.ts     # HTTP layer (parse req, gọi service, trả res)
│       └── agent.routes.ts         # Router: POST /sync, GET /status
│
└── shared/
    ├── config/
    │   ├── db.ts                   # MongoDB connect (đã có)
    │   └── env.ts                  # ENV variables (đã có)
    ├── middlewares/
    │   ├── auth.middleware.ts      # JWT auth cho Dashboard (đã có)
    │   ├── deviceToken.middleware.ts  # ← MỚI: xác thực X-Device-Token
    │   ├── error.middleware.ts     # Error handler (đã có)
    │   └── rateLimiter.middleware.ts  # Rate limit (đã có)
    ├── core/
    │   └── error.response.ts       # Custom errors (đã có)
    └── utils/
        ├── crypto.ts               # ← MỚI: hashToken(), verifyToken()
        └── url.ts                  # ← MỚI: extractDomain()
```

---

## 5. Đặc tả API

> **Base URL**: `https://your-backend.example.com/api/v1`
> **Xác thực Agent**: Header `X-Device-Token: <plain_token>`
> **Content-Type**: `application/json`

---

### 5.1 `POST /api/v1/agent/sync`

**Mô tả**: Agent gửi batch events (cả Window và History) lên server mỗi 5 phút. Backend phân loại và Bulk Insert vào 2 collection riêng.

#### Request

```
POST /api/v1/agent/sync
X-Device-Token: tok_abc123xyz
Content-Type: application/json
```

**Request Body:**

```jsonc
{
  "deviceToken": "tok_abc123xyz",   // Bắt buộc — phải khớp với header
  "sentAt": "2026-06-04T08:30:00.000Z",  // ISO 8601 — thời điểm gửi
  "eventCount": 3,                  // Số events trong batch (để validate)
  "events": [
    {
      "type": "window",
      "timestamp": "2026-06-04T08:25:01.000Z",
      "title": "YouTube - Minecraft Gameplay",
      "processName": "chrome.exe",
      "isIncognito": false
    },
    {
      "type": "window",
      "timestamp": "2026-06-04T08:25:06.000Z",
      "title": "Roblox",
      "processName": "RobloxPlayerBeta.exe",
      "isIncognito": false
    },
    {
      "type": "history",
      "timestamp": "2026-06-04T08:26:00.000Z",
      "url": "https://www.youtube.com/watch?v=abc123",
      "title": "Minecraft Gameplay",
      "browser": "chrome",
      "visitTime": "2026-06-04T08:24:55.000Z"
    }
  ]
}
```

**Validation Rules (Zod):**

| Field | Rule |
|---|---|
| `deviceToken` | string, min 10 chars |
| `sentAt` | ISO datetime string |
| `eventCount` | number, phải bằng `events.length` |
| `events` | array, min 0, max 1000 |
| `events[].type` | enum: `"window"` \| `"history"` |
| `events[].timestamp` | ISO datetime |
| Window: `title` | string, max 500 |
| Window: `processName` | string, max 100 |
| Window: `isIncognito` | boolean |
| History: `url` | string, valid URL, max 2048 |
| History: `title` | string, max 500 |
| History: `browser` | enum: `"chrome"` \| `"edge"` \| `"unknown"` |
| History: `visitTime` | ISO datetime |

#### Responses

**✅ 200 OK — Sync thành công**

```json
{
  "success": true,
  "message": "Sync thành công",
  "data": {
    "savedCount": 3,
    "windowCount": 2,
    "historyCount": 1
  }
}
```

> Agent sẽ **clear DataBuffer** khi nhận được `200`.

**❌ 400 Bad Request — Payload không hợp lệ**

```json
{
  "success": false,
  "message": "Payload không hợp lệ",
  "errors": [
    { "field": "events[2].url", "message": "URL không hợp lệ" }
  ]
}
```

> Agent **giữ nguyên buffer**, log lỗi để admin xem xét config.

**❌ 401 Unauthorized — Token không hợp lệ**

```json
{
  "success": false,
  "message": "Device token không hợp lệ hoặc thiết bị không tồn tại",
  "code": "DEVICE_TOKEN_INVALID"
}
```

**❌ 429 Too Many Requests — Rate limit**

```json
{
  "success": false,
  "message": "Gửi quá nhiều request. Vui lòng chờ.",
  "retryAfter": 60
}
```

**❌ 500 Internal Server Error — Lỗi Server**

```json
{
  "success": false,
  "message": "Lỗi server khi lưu dữ liệu. Sẽ retry tự động."
}
```

> Agent **giữ nguyên buffer** và retry ở chu kỳ 5 phút tiếp theo.

#### Luồng xử lý (Flowchart)

```
Request đến
     │
     ▼
[deviceToken.middleware]
  Hash token → tìm Device trong DB
  ✗ Không tìm thấy → 401
  ✓ Tìm thấy → gắn device vào req.device
     │
     ▼
[Zod Validation]
  ✗ Schema sai → 400 + chi tiết lỗi
  ✓ Schema đúng → continue
     │
     ▼
[agent.service.sync()]
  Tách events theo type:
    windowEvents = events.filter(e => e.type === 'window')
    historyEvents = events.filter(e => e.type === 'history')
     │
     ▼
[Enrich data]
  Thêm deviceId, ownerId vào mỗi event
  Tính toán: dateKey = timestamp.toISOString().slice(0,10)
  Với historyEvent: domain = extractDomain(url)
     │
     ▼
[Bulk Insert - PARALLEL]
  Promise.allSettled([
    WindowEvent.insertMany(windowEvents, { ordered: false }),
    HistoryEvent.insertMany(historyEvents, { ordered: false })
  ])
     │
     ▼
[Cập nhật Device.lastSeenAt = now()]
     │
     ▼
200 OK { savedCount, windowCount, historyCount }
```

---

### 5.2 `GET /api/v1/agent/status`

**Mô tả**: Agent poll mỗi 30 giây để kiểm tra xem phụ huynh có bấm nút "Tạm dừng giám sát" hay không.

> **Lưu ý về xác thực**: Agent hiện tại gửi token qua cả **header** (`X-Device-Token`) và **query param** (`?deviceToken=...`). Backend nên hỗ trợ cả hai để linh hoạt.

#### Request

```
GET /api/v1/agent/status?deviceToken=tok_abc123xyz
X-Device-Token: tok_abc123xyz
```

#### Responses

**✅ 200 OK**

```json
{
  "success": true,
  "data": {
    "paused": false,
    "since": null,
    "reason": null
  }
}
```

Hoặc khi phụ huynh đã bấm tạm dừng:

```json
{
  "success": true,
  "data": {
    "paused": true,
    "since": "2026-06-04T10:00:00.000Z",
    "reason": "Đến giờ ăn tối"
  }
}
```

> **Agent parse `data.paused`** để quyết định chạy/dừng vòng lặp thu thập.

**❌ 401 Unauthorized**

```json
{
  "success": false,
  "message": "Device token không hợp lệ",
  "code": "DEVICE_TOKEN_INVALID"
}
```

---

## 6. Xử lý Logic & Edge Cases

### 6.1 Device Token Authentication (Middleware mới)

**Vấn đề:** JWT không phù hợp cho machine-to-machine auth (Agent không có session, không cần refresh).

**Giải pháp:** Static token được hash SHA-256 lưu trong DB.

```typescript
// src/shared/utils/crypto.ts
import { createHash } from "crypto";

export function hashDeviceToken(plainToken: string): string {
  return createHash("sha256").update(plainToken).digest("hex");
}
```

```typescript
// src/shared/middlewares/deviceToken.middleware.ts
import { Request, Response, NextFunction } from "express";
import { hashDeviceToken } from "../utils/crypto";
import { agentRepository } from "../../features/agent/agent.repository";

// Mở rộng Express Request để gắn device
declare global {
  namespace Express {
    interface Request {
      device?: IDevice;
    }
  }
}

export async function authenticateDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Đọc từ header (ưu tiên) hoặc query param (fallback cho PauseController)
  const rawToken =
    (req.headers["x-device-token"] as string) ||
    (req.query["deviceToken"] as string);

  if (!rawToken) {
    res.status(401).json({
      success: false,
      message: "Thiếu Device Token",
      code: "DEVICE_TOKEN_MISSING",
    });
    return;
  }

  const tokenHash = hashDeviceToken(rawToken);
  const device = await agentRepository.findByTokenHash(tokenHash);

  if (!device || !device.isActive) {
    res.status(401).json({
      success: false,
      message: "Device token không hợp lệ hoặc thiết bị đã bị vô hiệu hóa",
      code: "DEVICE_TOKEN_INVALID",
    });
    return;
  }

  req.device = device;
  next();
}
```

---

### 6.2 Bulk Insert tối ưu

**Vấn đề:** Agent gửi 1000 events/lần → phải insert nhanh, không block.

**Giải pháp:**

```typescript
// src/features/agent/agent.service.ts

async sync(device: IDevice, payload: SyncPayload): Promise<SyncResult> {
  const windowEvents = payload.events
    .filter((e): e is WindowEventDto => e.type === "window")
    .map((e) => ({
      deviceId: device._id,
      ownerId: device.ownerId,
      timestamp: new Date(e.timestamp),
      title: e.title,
      processName: e.processName,
      isIncognito: e.isIncognito,
      dateKey: e.timestamp.slice(0, 10), // "2026-06-04"
    }));

  const historyEvents = payload.events
    .filter((e): e is HistoryEventDto => e.type === "history")
    .map((e) => ({
      deviceId: device._id,
      ownerId: device.ownerId,
      timestamp: new Date(e.timestamp),
      url: e.url,
      title: e.title,
      browser: e.browser,
      visitTime: new Date(e.visitTime),
      domain: extractDomain(e.url),
      dateKey: e.visitTime.slice(0, 10),
    }));

  // Chạy song song, không dừng nếu 1 document bị trùng (ordered: false)
  const [windowResult, historyResult] = await Promise.allSettled([
    windowEvents.length > 0
      ? WindowEvent.insertMany(windowEvents, { ordered: false })
      : Promise.resolve([]),
    historyEvents.length > 0
      ? HistoryEvent.insertMany(historyEvents, { ordered: false })
      : Promise.resolve([]),
  ]);

  // Cập nhật heartbeat của device
  await Device.updateOne(
    { _id: device._id },
    { $set: { lastSeenAt: new Date() } }
  );

  return {
    savedCount: payload.events.length,
    windowCount: windowEvents.length,
    historyCount: historyEvents.length,
  };
}
```

> **`ordered: false`** là chìa khóa: MongoDB tiếp tục insert các document còn lại ngay cả khi có document bị lỗi (vd: duplicate key). Agent sẽ không mất toàn bộ batch chỉ vì 1 record lỗi.

---

### 6.3 Xử lý Clock Skew

Agent lưu timestamp theo đồng hồ máy con. Máy con có thể lệch giờ so với Server.

**Giải pháp:**

```typescript
// agent.service.ts — kiểm tra khi nhận payload
const sentAt = new Date(payload.sentAt);
const serverNow = new Date();
const skewMs = Math.abs(serverNow.getTime() - sentAt.getTime());

if (skewMs > 10 * 60 * 1000) { // > 10 phút
  console.warn(
    `[AgentSync] Clock skew cảnh báo: device=${device._id}, skew=${skewMs}ms`
  );
  // Không reject — chỉ log để admin biết
}
```

---

### 6.4 eventCount Mismatch

Agent gửi `eventCount: 3` nhưng `events.length === 2`.

**Giải pháp (Zod refine):**

```typescript
// agent.dto.ts
const SyncPayloadSchema = z.object({
  deviceToken: z.string().min(10),
  sentAt: z.string().datetime(),
  eventCount: z.number().int().min(0).max(1000),
  events: z.array(AgentEventSchema).max(1000),
}).refine(
  (data) => data.eventCount === data.events.length,
  {
    message: "eventCount phải bằng số phần tử trong mảng events",
    path: ["eventCount"],
  }
);
```

---

### 6.5 Rate Limiting cho Agent endpoints

```typescript
// agent.routes.ts
import rateLimit from "express-rate-limit";

// Agent sync: tối đa 5 request/5 phút/IP
const syncRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  message: {
    success: false,
    message: "Gửi quá nhiều request sync",
    retryAfter: 300,
  },
});

// Status poll: tối đa 3 request/phút/IP (30s interval → max 2/phút, cho thêm buffer)
const statusRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
});

router.post("/sync", syncRateLimiter, authenticateDevice, agentController.sync);
router.get("/status", statusRateLimiter, authenticateDevice, agentController.getStatus);
```

---

### 6.6 Đăng ký Device (API cho Dashboard phụ huynh)

Phụ huynh cần tạo Device từ Dashboard để lấy `deviceToken` cài vào Agent.

```
POST /api/v1/devices
Authorization: Bearer <parent_access_token>
Body: { "name": "Laptop con trai" }

Response 201:
{
  "success": true,
  "data": {
    "deviceId": "...",
    "name": "Laptop con trai",
    "plainToken": "tok_xyz...",  // CHỈ trả về 1 LẦN DUY NHẤT
    "message": "Lưu token này ngay, sẽ không hiển thị lại"
  }
}
```

> Backend lưu `SHA-256(plainToken)` trong DB, không lưu `plainToken`. Phụ huynh copy token này vào `config.json` của Agent.

---

## 7. Kế hoạch triển khai (Implementation Roadmap)

### Phase 1 — Core Agent API (Ưu tiên cao nhất)

- [ ] Tạo `src/shared/utils/crypto.ts` — `hashDeviceToken()`
- [ ] Tạo `src/shared/utils/url.ts` — `extractDomain()`
- [ ] Tạo `src/features/agent/agent.model.ts` — Device, WindowEvent, HistoryEvent schemas
- [ ] Tạo `src/features/agent/agent.dto.ts` — Zod validation schemas
- [ ] Tạo `src/features/agent/agent.repository.ts` — DB query methods
- [ ] Tạo `src/features/agent/agent.service.ts` — Business logic
- [ ] Tạo `src/features/agent/agent.controller.ts` — HTTP handlers
- [ ] Tạo `src/features/agent/agent.routes.ts` — Route definitions
- [ ] Tạo `src/shared/middlewares/deviceToken.middleware.ts`
- [ ] Cập nhật `src/routes/index.ts` — mount `/agent` routes

### Phase 2 — Dashboard API (Sau khi Agent hoạt động)

- [ ] `GET /api/v1/devices` — Danh sách thiết bị của phụ huynh
- [ ] `POST /api/v1/devices` — Đăng ký thiết bị mới
- [ ] `PATCH /api/v1/devices/:id/pause` — Bật/tắt tạm dừng
- [ ] `GET /api/v1/devices/:id/events` — Xem lịch sử event
- [ ] `GET /api/v1/devices/:id/stats` — Thống kê (top apps, top sites)

---

## 8. Mẫu Payload JSON để test Postman

Dùng payload dưới đây để test endpoint `/sync` trước khi ráp Agent thực tế.

```json
{
  "deviceToken": "tok_test_device_abc123xyz",
  "sentAt": "2026-06-04T08:30:00.000Z",
  "eventCount": 5,
  "events": [
    {
      "type": "window",
      "timestamp": "2026-06-04T08:25:01.000Z",
      "title": "YouTube - Minecraft Tutorial - Google Chrome",
      "processName": "chrome.exe",
      "isIncognito": false
    },
    {
      "type": "window",
      "timestamp": "2026-06-04T08:25:06.000Z",
      "title": "Roblox",
      "processName": "RobloxPlayerBeta.exe",
      "isIncognito": false
    },
    {
      "type": "window",
      "timestamp": "2026-06-04T08:25:11.000Z",
      "title": "InPrivate - Bing - Microsoft Edge",
      "processName": "msedge.exe",
      "isIncognito": true
    },
    {
      "type": "history",
      "timestamp": "2026-06-04T08:26:00.000Z",
      "url": "https://www.youtube.com/watch?v=abc123",
      "title": "Minecraft Tutorial - YouTube",
      "browser": "chrome",
      "visitTime": "2026-06-04T08:24:55.000Z"
    },
    {
      "type": "history",
      "timestamp": "2026-06-04T08:27:00.000Z",
      "url": "https://minecraft.fandom.com/wiki/Crafting",
      "title": "Crafting – Minecraft Wiki",
      "browser": "chrome",
      "visitTime": "2026-06-04T08:26:30.000Z"
    }
  ]
}
```

**Postman Headers:**

```
X-Device-Token: tok_test_device_abc123xyz
Content-Type: application/json
```

**Test GET /status:**

```
GET /api/v1/agent/status?deviceToken=tok_test_device_abc123xyz
X-Device-Token: tok_test_device_abc123xyz
```

---

## Phụ lục: Luồng onboarding thiết bị đầy đủ

```
Phụ huynh đăng ký tài khoản
         │
         ▼
Dashboard: Thêm thiết bị mới
POST /api/v1/devices { name: "Laptop con" }
         │
         ▼ Nhận plainToken (hiển thị 1 lần)
         │
         ▼ Phụ huynh cài Agent lên máy con
           → Sửa config.json: deviceToken = "tok_xyz..."
           → Chạy Agent
         │
         ▼
Agent bắt đầu hoạt động:
  - Poll GET /status mỗi 30s
  - Collect & sync POST /sync mỗi 5 phút
         │
         ▼
Dashboard phụ huynh theo dõi real-time
  - Xem active apps, top sites, thời gian dùng
  - Bấm "Tạm dừng" → Device.isPaused = true
  - Agent nhận paused=true → dừng thu thập
```

---

*Tài liệu này được sinh tự động dựa trên phân tích mã nguồn Agent tại `agent/src/` và cấu trúc Backend hiện tại tại `BE/guardeye-sever/src/`.*
