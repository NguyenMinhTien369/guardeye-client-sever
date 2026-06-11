# SRS — Feature: `agent` (GuardEye Backend)

> **Mục đích tài liệu này:** Mô tả chi tiết từng file trong thư mục `src/features/agent/` và luồng dữ liệu (data flow) đầy đủ để AI hoặc developer mới có thể nắm bối cảnh nhanh chóng mà không cần đọc source code từng dòng.

---

## 1. Bối Cảnh Tổng Quan

**GuardEye** là hệ thống kiểm soát nội dung dành cho phụ huynh. Nó bao gồm:

- **Backend** (`BE/guardeye-sever`) — Express + TypeScript + MongoDB
- **Agent** (`agent/`) — Ứng dụng Node.js desktop cài trên máy của **trẻ** (Windows), chạy ngầm như Windows Service

Feature `agent` ở phía **Backend** chịu trách nhiệm:
1. **Nhận batch events** từ Agent (cửa sổ đang active, lịch sử duyệt web)
2. **Trả trạng thái pause** khi Agent hỏi có nên dừng thu thập hay không

---

## 2. Danh Sách File và Vai Trò

```
src/features/agent/
├── agent.dto.ts          — TypeScript interfaces (data contract)
├── agent.validation.ts   — Zod schemas + Express middleware validators
├── agent.middleware.ts   — Xác thực X-Device-Token header
├── agent.model.ts        — Mongoose schemas: WindowEvent, HistoryEvent
├── agent.repository.ts   — Data Access Layer (query MongoDB)
├── agent.service.ts      — Business Logic Layer
├── agent.controller.ts   — HTTP handlers (nhận req → gọi service → gửi res)
└── agent.routes.ts       — Khai báo routes, ghép middleware + controller
```

---

## 3. Mô Tả Chi Tiết Từng File

### 3.1 `agent.dto.ts` — Data Transfer Objects

**Vai trò:** Định nghĩa "hợp đồng dữ liệu" giữa Agent và Backend. Chỉ là TypeScript `interface`, không có logic.

**Các type quan trọng:**

| Type | Hướng | Mô tả |
|---|---|---|
| `WindowEventDto` | Agent → Server | Một cửa sổ đang active: `{type, timestamp, title, processName, isIncognito}` |
| `HistoryEventDto` | Agent → Server | Một URL trong lịch sử: `{type, timestamp, url, title, browser, visitTime}` |
| `AgentEventDto` | Agent → Server | Union type: `WindowEventDto \| HistoryEventDto` |
| `SyncRequestDto` | Agent → Server | Payload POST sync: `{deviceToken, sentAt, eventCount, events[]}` |
| `StatusQueryDto` | Agent → Server | Query params GET status: `{deviceToken?}` |
| `SyncResponseDto` | Server → Agent | Kết quả sync: `{success, savedCount, windowCount, historyCount, message}` |
| `AgentStatusResponseDto` | Server → Agent | Trạng thái pause: `{paused, since?, reason?}` |

**Lưu ý thiết kế:**
- `eventCount` trong `SyncRequestDto` **phải bằng** `events.length` — server sẽ từ chối nếu không khớp.
- `timestamp` và `visitTime` dùng chuỗi ISO 8601, server tự convert sang `Date` khi lưu DB.
- `AgentStatusResponseDto.since` là `string | undefined` (không phải `Date`) để JSON serialize thẳng.

---

### 3.2 `agent.validation.ts` — Zod Schemas & Middleware

**Vai trò:** Validate dữ liệu đầu vào trước khi tới controller. Đóng vai trò "guard" tầng HTTP.

**Exports:**

#### Schemas
- **`syncBodySchema`** — Validate `req.body` của `POST /api/v1/agent/sync`:
  - `deviceToken`: string, không rỗng
  - `sentAt`: ISO 8601 datetime string
  - `eventCount`: số nguyên ≥ 0
  - `events[]`: mảng dùng `z.discriminatedUnion("type", [...])` để phân biệt window vs history event
  - `.refine()`: kiểm tra `eventCount === events.length`, trả 400 nếu không khớp

- **`statusQuerySchema`** — Validate `req.query` của `GET /api/v1/agent/status`:
  - `deviceToken`: optional string (vì token ưu tiên lấy từ header)

#### Middleware factories
- **`validate(schema)`** — Wrap một schema Zod thành Express middleware validate `req.body`. Khi thành công, ghi `result.data` trở lại `req.body`.
- **`validateQuery(schema)`** — Tương tự nhưng validate `req.query`.

> ⚠️ **Bug đã biết:** `req.query = result.data` có thể gây lỗi `Cannot set property query of #<IncomingMessage> which has only a getter` ở một số phiên bản Express/Node. Nếu gặp lỗi này, xóa dòng gán `req.query =` đi — code vẫn hoạt động vì `validateQuery` chỉ cần phát hiện lỗi và chặn request, không cần normalize lại query.

---

### 3.3 `agent.middleware.ts` — Device Token Authentication

**Vai trò:** Xác thực danh tính của Agent dựa trên `deviceToken`. Tương tự `auth.middleware.ts` nhưng dành cho thiết bị thay vì user JWT.

**Middleware duy nhất: `verifyDeviceToken`**

**Logic:**
```
1. Lấy token từ:
   - Header: req.headers["x-device-token"]  (ưu tiên)
   - Query:  req.query["deviceToken"]        (fallback)

2. Token rỗng → 401 "Device token không được cung cấp"

3. Device.findOne({ deviceToken: token }).select("+deviceToken")
   Không tìm thấy → 401 "Device token không hợp lệ"

4. device.status === "inactive" → 403 "Thiết bị đã bị vô hiệu hóa"

5. device.status === "pending" → tự động set "active"
   (Agent kết nối lần đầu = đã cài xong)

6. Gắn vào request:
   req.device  = device        (IDevice object)
   req.ownerId = device.parentId.toString()

7. next()
```

**Express augmentation:** File này khai báo `declare global { namespace Express { interface Request { device?: IDevice; ownerId?: string; } } }` để TypeScript nhận biết hai trường mở rộng.

**Import từ:** `../devices/devices.model` — dùng model `Device` hiện có, không phải model riêng.

---

### 3.4 `agent.model.ts` — Mongoose Schemas

**Vai trò:** Định nghĩa cấu trúc và index cho dữ liệu lưu MongoDB. Hai collection riêng biệt.

#### Collection `windowevents` — Model `WindowEvent`

| Field | Type | Mô tả |
|---|---|---|
| `deviceId` | ObjectId (ref: Device) | Thiết bị gửi event |
| `ownerId` | ObjectId (ref: User) | Phụ huynh — denormalized để query Dashboard nhanh |
| `timestamp` | Date | Thời điểm Agent ghi nhận |
| `title` | String (max 500) | Title bar cửa sổ |
| `processName` | String (max 100) | Tên tiến trình (vd: `chrome.exe`) |
| `isIncognito` | Boolean | Agent phát hiện chế độ ẩn danh |
| `dateKey` | String (`YYYY-MM-DD`) | Dùng để group by day nhanh |
| `createdAt`, `updatedAt` | Date | Auto timestamps |

**Indexes:**
- `{ deviceId: 1, timestamp: -1 }` — Dashboard xem lịch sử theo thời gian
- `{ deviceId: 1, dateKey: 1 }` — Thống kê theo ngày
- `{ timestamp: 1 }` TTL 90 ngày — Tự động xóa dữ liệu cũ

#### Collection `historyevents` — Model `HistoryEvent`

| Field | Type | Mô tả |
|---|---|---|
| `deviceId` | ObjectId (ref: Device) | Thiết bị gửi event |
| `ownerId` | ObjectId (ref: User) | Phụ huynh — denormalized |
| `timestamp` | Date | Thời điểm Agent đọc được URL |
| `url` | String (max 2048) | URL đầy đủ |
| `title` | String (max 500) | Tiêu đề trang |
| `browser` | `"chrome" \| "edge" \| "unknown"` | Trình duyệt |
| `visitTime` | Date | Thời điểm browser ghi nhận (từ SQLite của Chrome/Edge) |
| `domain` | String | Domain trích từ URL (vd: `youtube.com`) |
| `dateKey` | String (`YYYY-MM-DD`) | Group by day |
| `createdAt`, `updatedAt` | Date | Auto timestamps |

**Indexes:**
- `{ deviceId: 1, visitTime: -1 }` — Lịch sử theo thời gian truy cập
- `{ deviceId: 1, domain: 1 }` — Top domain query
- `{ visitTime: 1 }` TTL 90 ngày — Tự động xóa dữ liệu cũ

---

### 3.5 `agent.repository.ts` — Data Access Layer

**Vai trò:** Layer duy nhất được phép import Mongoose model trực tiếp. Không chứa business logic, chỉ thao tác DB.

**Exports:** Object `agentRepository` với 3 hàm:

#### `bulkInsertWindowEvents(events, deviceId, ownerId): Promise<number>`
- Map `WindowEventDto[]` → Mongoose documents
- Dùng `WindowEvent.insertMany(docs, { ordered: false })` — bỏ qua bản ghi trùng lặp, không dừng khi gặp lỗi 1 record
- Trả về số document insert thành công

#### `bulkInsertHistoryEvents(events, deviceId, ownerId): Promise<number>`
- Map `HistoryEventDto[]` → Mongoose documents
- Tự động gọi helper `extractDomain(url)` để điền trường `domain`
- Dùng `HistoryEvent.insertMany(docs, { ordered: false })`

#### `getDevicePauseStatus(deviceId): Promise<{ paused, since?, reason? }>`
- `Device.findById(deviceId).select("isPaused pausedSince")`
- Nếu không tìm thấy device → `{ paused: false }` (fail-safe)
- Convert `pausedSince: Date` → ISO string nếu có
- `reason` hiện tại luôn là `undefined` (model chưa có trường này)

**Helper functions (private):**
- `extractDomain(url)` — Parse URL lấy hostname, bỏ `www.` (dùng `new URL()`)
- `toDateKey(isoString)` — Cắt 10 ký tự đầu (`"YYYY-MM-DD"`)

---

### 3.6 `agent.service.ts` — Business Logic Layer

**Vai trò:** Xử lý nghiệp vụ, điều phối repository. Controller không được gọi DB trực tiếp.

**Exports:** Object `agentService` với 2 hàm:

#### `syncEvents(dto, deviceId, ownerId): Promise<SyncResponseDto>`
1. Tách `dto.events` thành 2 mảng: `windowEvents` và `historyEvents` (dùng type guard filter)
2. Gọi song song `Promise.all([bulkInsertWindowEvents, bulkInsertHistoryEvents])`
3. Tính `savedCount = windowCount + historyCount`
4. Trả `SyncResponseDto { success: true, savedCount, windowCount, historyCount, message }`

> **Lưu ý:** Nếu một trong hai insert fail, toàn bộ `Promise.all` reject và controller sẽ bắt lỗi gửi về 400.

#### `getAgentStatus(deviceId): Promise<AgentStatusResponseDto>`
- Ủy thác hoàn toàn cho `agentRepository.getDevicePauseStatus(deviceId)`
- Trả thẳng kết quả (hiện tại không có transform thêm)

---

### 3.7 `agent.controller.ts` — HTTP Handlers

**Vai trò:** Nhận HTTP request → extract data → gọi service → gửi response. Không chứa logic nghiệp vụ.

#### `sync` — handler cho `POST /api/v1/agent/sync`
```typescript
const deviceId = (req.device as any)._id.toString();
const ownerId = req.ownerId!;
const result = await agentService.syncEvents(req.body, deviceId, ownerId);
// → 200 OKResponse với result
// catch → next(new BadRequestError(message))
```

#### `getStatus` — handler cho `GET /api/v1/agent/status`
```typescript
// Guard: kiểm tra req.device tồn tại (middleware đã set)
const deviceId = (req.device as any)._id.toString();
const result = await agentService.getAgentStatus(deviceId);
// → 200 OKResponse với result
// catch → next(new BadRequestError(message))
```

**Lưu ý:** `req.device` và `req.ownerId` được gắn bởi `verifyDeviceToken` middleware trước đó. Controller tin tưởng middleware đã làm việc của nó.

---

### 3.8 `agent.routes.ts` — Route Definitions

**Vai trò:** Khai báo 2 endpoints, ghép middleware pipeline đúng thứ tự.

```
POST /api/v1/agent/sync
  └─ verifyDeviceToken      ← Xác thực token, gắn req.device + req.ownerId
  └─ validate(syncBodySchema) ← Validate body JSON
  └─ agentController.sync    ← Xử lý và lưu events

GET /api/v1/agent/status
  └─ verifyDeviceToken         ← Xác thực token
  └─ validateQuery(statusQuerySchema) ← Validate query params (optional)
  └─ agentController.getStatus  ← Trả trạng thái pause
```

**Đăng ký trong** `src/routes/index.ts`:
```typescript
router.use("/agent", agentRoutes); // → /api/v1/agent/*
```

---

## 4. Data Flow Đầy Đủ

### 4.1 Flow: Agent Sync Events (`POST /api/v1/agent/sync`)

```
Agent (Windows Desktop)
│
│  POST /api/v1/agent/sync
│  Headers: { "X-Device-Token": "fc0e8ad2-..." }
│  Body: {
│    deviceToken: "fc0e8ad2-...",
│    sentAt: "2026-06-11T10:00:00Z",
│    eventCount: 3,
│    events: [
│      { type: "window", timestamp: "...", title: "YouTube - Chrome", processName: "chrome.exe", isIncognito: false },
│      { type: "window", timestamp: "...", title: "Gmail - Chrome",   processName: "chrome.exe", isIncognito: false },
│      { type: "history", timestamp: "...", url: "https://youtube.com/...", title: "...", browser: "chrome", visitTime: "..." }
│    ]
│  }
│
▼
[Express Router → /api/v1/agent/sync]
│
▼ Middleware 1: verifyDeviceToken
│  ├─ Đọc header "x-device-token"
│  ├─ Device.findOne({ deviceToken }).select("+deviceToken")
│  ├─ Nếu device.status === "pending" → update → "active"
│  └─ Gắn req.device, req.ownerId → next()
│
▼ Middleware 2: validate(syncBodySchema)
│  ├─ Zod parse req.body
│  ├─ Kiểm tra eventCount === events.length
│  └─ Nếu ok → req.body = parsed data → next()
│
▼ Controller: agentController.sync
│  ├─ Extract deviceId = req.device._id.toString()
│  ├─ Extract ownerId = req.ownerId
│  └─ Gọi agentService.syncEvents(req.body, deviceId, ownerId)
│
▼ Service: agentService.syncEvents
│  ├─ filter window events  → [WindowEventDto, ...]
│  ├─ filter history events → [HistoryEventDto, ...]
│  └─ Promise.all([
│       agentRepository.bulkInsertWindowEvents(...),
│       agentRepository.bulkInsertHistoryEvents(...)
│     ])
│
▼ Repository: bulkInsertWindowEvents + bulkInsertHistoryEvents
│  ├─ Map DTO → Mongoose document (convert string timestamps → Date)
│  ├─ extractDomain(url) cho history events
│  └─ WindowEvent.insertMany(..., { ordered: false })
│     HistoryEvent.insertMany(..., { ordered: false })
│
▼ MongoDB
│  └─ Lưu vào collections: windowevents, historyevents
│
▼ Response về Agent
   HTTP 200: {
     success: true,
     statusCode: 200,
     message: "Đồng bộ thành công: đã lưu 3 sự kiện",
     data: { success: true, savedCount: 3, windowCount: 2, historyCount: 1, message: "..." }
   }
   → Agent nhận 200 → clear DataBuffer
```

### 4.2 Flow: Agent Poll Status (`GET /api/v1/agent/status`)

```
Agent (Windows Desktop) — chạy mỗi 30 giây
│
│  GET /api/v1/agent/status?deviceToken=fc0e8ad2-...
│  Headers: { "X-Device-Token": "fc0e8ad2-..." }
│
▼
[Express Router → /api/v1/agent/status]
│
▼ Middleware 1: verifyDeviceToken
│  └─ (giống flow sync ở trên)
│
▼ Middleware 2: validateQuery(statusQuerySchema)
│  └─ Zod parse req.query (chỉ validate, không block nếu deviceToken không có)
│
▼ Controller: agentController.getStatus
│  └─ Gọi agentService.getAgentStatus(deviceId)
│
▼ Service: agentService.getAgentStatus
│  └─ Gọi agentRepository.getDevicePauseStatus(deviceId)
│
▼ Repository: getDevicePauseStatus
│  └─ Device.findById(deviceId).select("isPaused pausedSince")
│
▼ MongoDB
│  └─ Query collection devices
│
▼ Response về Agent
   HTTP 200: {
     success: true,
     data: { paused: false }           ← Khi bình thường
   }
   hoặc:
   HTTP 200: {
     success: true,
     data: { paused: true, since: "2026-06-11T09:00:00.000Z", reason: undefined }
   }
   → Agent nhận paused: true → dừng WindowMonitor + SyncService
```

---

## 5. Các Model Liên Quan (Không Nằm Trong Thư Mục Này)

Feature `agent` **phụ thuộc** vào model từ feature khác:

### `Device` model — `src/features/devices/devices.model.ts`

Các trường Agent feature dùng:

| Field | Type | Dùng bởi |
|---|---|---|
| `deviceToken` | string (select: false) | `verifyDeviceToken` — tìm device theo token |
| `status` | `"pending" \| "active" \| "inactive"` | `verifyDeviceToken` — kiểm tra trạng thái |
| `isPaused` | boolean | `getDevicePauseStatus` |
| `pausedSince` | Date \| null | `getDevicePauseStatus` |
| `parentId` | ObjectId | `verifyDeviceToken` → gắn vào `req.ownerId` |

---

## 6. Các Điểm Cần Chú Ý Khi Sửa Code

### 6.1 `deviceToken` có `select: false`
Khi query `Device` theo `deviceToken`, **phải** dùng `.select("+deviceToken")` nếu cần đọc giá trị field này. Repository và middleware đã xử lý đúng.

### 6.2 `ordered: false` trong `insertMany`
Khi Agent gửi batch lớn, một số event có thể trùng với event cũ (vd: Agent bị crash giữa chừng, retry). `ordered: false` cho phép Mongoose bỏ qua record duplicate và tiếp tục insert các record còn lại thay vì dừng hẳn.

### 6.3 Parallel `Promise.all` cho sync
Window events và history events được insert song song. Nếu một bên fail, toàn bộ reject. Controller bắt lỗi và trả 400 — Agent sẽ giữ buffer và retry sau.

### 6.4 `ownerId` được denormalize
`ownerId` được lưu trực tiếp vào `WindowEvent` và `HistoryEvent` (thay vì chỉ lưu `deviceId` rồi join). Đây là quyết định thiết kế có chủ đích: Dashboard query "tất cả events của phụ huynh X" chỉ cần 1 hop thay vì 2 hop.

### 6.5 Trạng thái `reason` chưa có
`getDevicePauseStatus` luôn trả `reason: undefined` vì `Device` model hiện chưa có trường `reason`. Khi cần bổ sung, thêm field vào `devices.model.ts` và cập nhật repository.

---

## 7. Error Codes

| HTTP Status | Tình huống | Ai trả |
|---|---|---|
| 400 | Body không hợp lệ / eventCount mismatch | `validate()` middleware hoặc `BadRequestError` từ controller |
| 401 | Token không tồn tại hoặc thiếu | `verifyDeviceToken` middleware |
| 403 | Device bị `inactive` | `verifyDeviceToken` middleware |
| 500 | Lỗi DB không xác định | `verifyDeviceToken` catch block hoặc global error handler |

---

## 8. Chạy Thử Nhanh (curl)

```bash
# Poll status (thay token thật vào)
curl -X GET "http://localhost:5000/api/v1/agent/status?deviceToken=fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5" \
  -H "X-Device-Token: fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5"

# Sync events
curl -X POST "http://localhost:5000/api/v1/agent/sync" \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5" \
  -d '{
    "deviceToken": "fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5",
    "sentAt": "2026-06-11T10:00:00.000Z",
    "eventCount": 1,
    "events": [{
      "type": "window",
      "timestamp": "2026-06-11T10:00:00.000Z",
      "title": "YouTube - Google Chrome",
      "processName": "chrome.exe",
      "isIncognito": false
    }]
  }'
```
