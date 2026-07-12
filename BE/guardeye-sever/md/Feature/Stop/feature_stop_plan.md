# Kế hoạch Hoàn thiện Chức năng Pause / Resume

---

## 📌 API Endpoints — Chức năng Pause / Resume

> **Base URL:** `http://localhost:5000/api/v1`
> **Biến Postman:** `{{baseUrl}}` = `http://localhost:5000/api/v1`

### Tổng quan nhanh

| Method | Endpoint | Xác thực | Vai trò |
|--------|----------|----------|---------|
| `PATCH` | `/devices/:deviceId/pause` | JWT Bearer | Phụ huynh tạm dừng giám sát |
| `PATCH` | `/devices/:deviceId/resume` | JWT Bearer | Phụ huynh mở lại giám sát |
| `GET` | `/agent/status` | X-Device-Token | Agent poll trạng thái pause |

---

### 1. `PATCH /devices/:deviceId/pause`

**Mục đích:** Phụ huynh ra lệnh tạm dừng thu thập dữ liệu.

**Header:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**URL ví dụ:**
```
PATCH {{baseUrl}}/devices/6a292fe7e72f521646e7feca/pause
```

**Body — pause vô thời hạn:**
```json
{}
```

**Body — pause có thời hạn:**
```json
{
  "pausedUntil": "2026-12-31T23:59:00.000Z"
}
```

**Response 200:**
```json
{
  "status": 200,
  "message": "Thiết bị đã được tạm dừng.",
  "data": {
    "device": {
      "id": "6a292fe7e72f521646e7feca",
      "isPaused": true,
      "pausedSince": "2026-07-09T14:35:07.217Z",
      "pausedUntil": "2026-12-31T23:59:00.000Z",
      "status": "active"
    },
    "message": "Thiết bị đã được tạm dừng đến 2026-12-31T23:59:00.000Z."
  }
}
```

**Lỗi có thể gặp:**

| HTTP | Ý nghĩa |
|------|---------|
| `401` | Thiếu hoặc sai JWT token |
| `404` | `deviceId` không tồn tại hoặc không thuộc phụ huynh này |

---

### 2. `PATCH /devices/:deviceId/resume`

**Mục đích:** Phụ huynh mở lại giám sát — reset toàn bộ trạng thái pause trong DB.

**Header:**
```
Authorization: Bearer <accessToken>
```

**URL ví dụ:**
```
PATCH {{baseUrl}}/devices/6a292fe7e72f521646e7feca/resume
```

**Body:** *(không cần)*

**Response 200:**
```json
{
  "status": 200,
  "message": "Thiết bị đã được tiếp tục giám sát.",
  "data": {
    "device": {
      "id": "6a292fe7e72f521646e7feca",
      "isPaused": false,
      "pausedSince": null,
      "pausedUntil": null,
      "status": "active"
    },
    "message": "Thiết bị đã được tiếp tục giám sát."
  }
}
```

**Lỗi có thể gặp:**

| HTTP | Ý nghĩa |
|------|---------|
| `401` | Thiếu hoặc sai JWT token |
| `404` | `deviceId` không tồn tại hoặc không thuộc phụ huynh này |

---

### 3. `GET /agent/status`

**Mục đích:** Agent poll trạng thái pause mỗi 30 giây — Agent gọi tự động, không cần phụ huynh thao tác.

**Header (ưu tiên):**
```
X-Device-Token: fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5
```

**Hoặc query param (fallback):**
```
GET {{baseUrl}}/agent/status?deviceToken=fc0e8ad2-7ccf-4c50-8fc5-16875404c0e5
```

**URL ví dụ dùng để test thủ công:**
```
GET {{baseUrl}}/agent/status
```

**Response 200 — đang bị pause có thời hạn:**
```json
{
  "status": 200,
  "message": "Lấy trạng thái thành công",
  "data": {
    "paused": true,
    "since": "2026-07-09T14:35:07.217Z",
    "until": "2026-12-31T23:59:00.000Z",
    "reason": null
  }
}
```

**Response 200 — đang bị pause vô thời hạn:**
```json
{
  "status": 200,
  "message": "Lấy trạng thái thành công",
  "data": {
    "paused": true,
    "since": "2026-07-09T14:35:07.217Z",
    "until": null,
    "reason": null
  }
}
```

**Response 200 — không bị pause (đang chạy bình thường):**
```json
{
  "status": 200,
  "message": "Lấy trạng thái thành công",
  "data": {
    "paused": false,
    "since": null,
    "until": null,
    "reason": null
  }
}
```

**Lỗi có thể gặp:**

| HTTP | Ý nghĩa |
|------|---------|
| `401` | Thiếu `X-Device-Token` hoặc token không tìm thấy trong DB |
| `403` | Device đã bị vô hiệu hóa (`status = inactive`) |

---

### (Tham khảo) `GET /devices` — Lấy `deviceId`

Dùng để lấy `deviceId` trước khi gọi pause/resume.

```
GET {{baseUrl}}/devices
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "status": 200,
  "data": [
    {
      "id": "6a292fe7e72f521646e7feca",
      "deviceName": "Laptop của Minh",
      "isPaused": true,
      "pausedSince": "2026-07-09T14:35:07.217Z",
      "pausedUntil": "2026-12-31T23:59:00.000Z",
      "status": "active"
    }
  ]
}
```

---

## Tóm tắt


Hoàn thiện luồng pause/resume hiện có bằng cách sửa **2 vấn đề còn thiếu**:

1. **`agent.repository.ts`** — `reason` đang bị trả cứng `undefined`, cần đọc `pausedUntil` từ DB và trả đúng dữ liệu.
2. **`PauseController.ts`** — chưa có logic auto-resume khi `pausedUntil` đã hết hạn.

> Phạm vi này **không chạm** vào devices model, devices DTO, devices repository hay devices service.

---

## Hiện trạng (đã verify trực tiếp trong code)

### BE — `agent.repository.ts` (dòng 56–76)

```typescript
// HIỆN TẠI: chỉ select 2 trường, bỏ sót pausedUntil
const device = await Device.findById(deviceId).select("isPaused pausedSince");

return {
  paused: device.isPaused,
  since: device.pausedSince ? device.pausedSince.toISOString() : undefined,
  reason: undefined, // ← cứng, không đọc từ DB
};
```

**Thiếu:**
- `pausedUntil` không được select → Agent không biết khi nào tự resume.
- `reason` trả `undefined` cứng (comment trong code cũng xác nhận: *"Hiện tại model chưa có trường reason"*).
  → **Giữ nguyên**, không cần sửa `reason` vì model chưa có trường này. Chỉ cần thêm `pausedUntil`.

### BE — `agent.dto.ts` (dòng 118–133)

```typescript
// HIỆN TẠI: thiếu trường until
export interface AgentStatusResponseDto {
  paused: boolean;
  since?: string;
  reason?: string;  // ← có sẵn
  // ← thiếu until
}
```

### Agent — `agent.types.ts` (dòng 139–148)

```typescript
// HIỆN TẠI: thiếu trường until
export interface PauseStatusResponse {
  paused: boolean;
  since?: string;
  reason?: string;  // ← có sẵn
  // ← thiếu until
}
```

### Agent — `PauseController.ts` (dòng 88–90 & 201–214)

```typescript
// HIỆN TẠI: getIsPaused() chỉ trả this.isPaused, không kiểm tra hết hạn
public getIsPaused(): boolean {
  return this.isPaused; // ← không có logic auto-resume
}

// applyStatus() chỉ cache isPaused, không cache pausedUntil
private applyStatus(data: PauseStatusResponse): void {
  this.isPaused = data.paused;
  // ← không lưu data.until
}
```

---

## Sơ đồ luồng sau khi sửa

```
Agent poll GET /api/v1/agent/status mỗi 30s
           │
           ▼
    BE trả { paused: true, since, until, reason }
           │
           ▼
    PauseController.applyStatus()
      → cache isPaused = true
      → cache pausedUntil = new Date(data.until)
           │
           ▼
    Main loop gọi getIsPaused() mỗi 5s
      → isPaused = true  VÀ  pausedUntil chưa qua  → return true  (skip collect)
      → isPaused = true  VÀ  pausedUntil đã qua    → return false (tự resume, log)
      → isPaused = false                            → return false (bình thường)
```

---

## Proposed Changes

### BE — Feature: Agent

---

#### [MODIFY] [agent.dto.ts](file:///c:/Users/MinhCup/Desktop/GuardEye/BE/guardeye-sever/src/features/agent/agent.dto.ts)

**Thêm trường `until?`** vào `AgentStatusResponseDto` (sau `since`).

```diff
 export interface AgentStatusResponseDto {
   /** true = Agent phải dừng thu thập data ngay lập tức */
   paused: boolean;

   /**
    * ISO 8601 — thời điểm trạng thái pause có hiệu lực.
    * undefined nếu chưa từng pause.
    */
   since?: string;

+  /**
+   * ISO 8601 — thời điểm auto-resume (Agent tự thoát trạng thái pause khi qua mốc này).
+   * undefined nếu pause vô thời hạn — chỉ resume khi phụ huynh bấm resume thủ công.
+   */
+  until?: string;

   /**
    * Lý do tạm dừng — Agent in ra log để debug.
    * undefined nếu phụ huynh không điền lý do.
    */
   reason?: string;
 }
```

---

#### [MODIFY] [agent.repository.ts](file:///c:/Users/MinhCup/Desktop/GuardEye/BE/guardeye-sever/src/features/agent/agent.repository.ts)

**Thay đổi `getDevicePauseStatus()`:**
1. Thêm `pausedUntil` vào `.select()`.
2. Trả thêm trường `until` trong return object.
3. Cập nhật kiểu trả về của hàm khớp với `AgentStatusResponseDto`.

```diff
   async getDevicePauseStatus(deviceId: string): Promise<{
     paused: boolean;
     since?: string;
+    until?: string;
     reason?: string;
   }> {
     const device = await Device.findById(deviceId).select(
-      "isPaused pausedSince",
+      "isPaused pausedSince pausedUntil",
     );

     if (!device) {
       return { paused: false };
     }

     return {
       paused: device.isPaused,
       since: device.pausedSince
         ? device.pausedSince.toISOString()
         : undefined,
+      until: device.pausedUntil
+        ? device.pausedUntil.toISOString()
+        : undefined,
       reason: undefined, // Model chưa có trường reason — giữ nguyên
     };
   },
```

> **Lưu ý:** `devices.model.ts` đã có sẵn `pausedUntil: Date | null` (dòng 29) và schema (dòng 91–94). Không cần sửa model.

---

### Agent (Client)

---

#### [MODIFY] [agent.types.ts](file:///c:/Users/MinhCup/Desktop/GuardEye/agent/src/types/agent.types.ts)

**Thêm trường `until?`** vào `PauseStatusResponse` — đồng bộ với BE.

```diff
 export interface PauseStatusResponse {
   /** true = Agent phải dừng thu thập data ngay lập tức. */
   paused: boolean;

   /** ISO 8601 — thời điểm trạng thái này có hiệu lực (optional). */
   since?: string;

+  /**
+   * ISO 8601 — thời điểm Agent tự resume (client-side auto-resume).
+   * Nếu undefined → pause vô thời hạn, chờ phụ huynh resume thủ công.
+   */
+  until?: string;

   /** Lý do tạm dừng — hiển thị trong log Agent (optional). */
   reason?: string;
 }
```

---

#### [MODIFY] [PauseController.ts](file:///c:/Users/MinhCup/Desktop/GuardEye/agent/src/guards/PauseController.ts)

Đây là thay đổi **trọng tâm** nhất. Cần 3 sửa đổi:

**Sửa đổi 1 — Thêm field `pausedUntil` vào class** (sau dòng `private isPaused`):

```diff
   /** Trạng thái hiện tại được cache. Mặc định: không tạm dừng. */
   private isPaused: boolean = false;

+  /**
+   * Thời điểm auto-resume được cache từ server.
+   * null = pause vô thời hạn (chỉ resume khi phụ huynh bấm thủ công).
+   */
+  private pausedUntil: Date | null = null;
```

---

**Sửa đổi 2 — Cập nhật `applyStatus()` để cache `pausedUntil`** và log thêm thông tin `until`:

```diff
   private applyStatus(data: PauseStatusResponse): void {
     const previousState = this.isPaused;
     this.isPaused = data.paused;
+    this.pausedUntil = data.until ? new Date(data.until) : null;
     this.lastSuccessfulPoll = new Date();
     this.consecutiveFailures = 0;

     // Chỉ log khi trạng thái thay đổi — tránh spam log mỗi 30s
     if (previousState !== this.isPaused) {
       const stateLabel = this.isPaused ? "TẠM DỪNG ⏸" : "TIẾP TỤC ▶";
       const reason = data.reason ? ` (Lý do: ${data.reason})` : "";
+      const until = this.pausedUntil
+        ? ` [Hết hạn: ${this.pausedUntil.toISOString()}]`
+        : "";
       console.log(
-        `[PauseController] Trạng thái thay đổi → ${stateLabel}${reason}`,
+        `[PauseController] Trạng thái thay đổi → ${stateLabel}${reason}${until}`,
       );
     }
   }
```

---

**Sửa đổi 3 — Cập nhật `getIsPaused()` để tự động resume khi hết hạn**:

```diff
   public getIsPaused(): boolean {
+    // Auto-resume client-side: server bảo pause nhưng pausedUntil đã qua → bỏ qua
+    if (this.isPaused && this.pausedUntil !== null) {
+      if (new Date() >= this.pausedUntil) {
+        console.log(
+          "[PauseController] Hết hạn pause — tự động resume ▶" +
+          " (isPaused server-side vẫn = true, sẽ đồng bộ ở poll tiếp theo).",
+        );
+        return false;
+      }
+    }
     return this.isPaused;
   }
```

> **Tại sao log trong `getIsPaused()` lại spam?**
> Main loop gọi `getIsPaused()` mỗi 5s → sẽ log liên tục sau khi hết hạn.
> **Giải pháp:** Thêm guard flag `private hasLoggedAutoResume = false`:

```diff
   /** Đã log auto-resume chưa — tránh spam log mỗi 5s. */
+  private hasLoggedAutoResume: boolean = false;

   public getIsPaused(): boolean {
     if (this.isPaused && this.pausedUntil !== null) {
       if (new Date() >= this.pausedUntil) {
+        if (!this.hasLoggedAutoResume) {
+          this.hasLoggedAutoResume = true;
           console.log(
             "[PauseController] Hết hạn pause — tự động resume ▶" +
             " (isPaused server-side vẫn = true, sẽ đồng bộ ở poll tiếp theo).",
           );
+        }
         return false;
       }
     }
+    // Reset flag khi server xác nhận đã resume (hoặc đang running bình thường)
+    if (!this.isPaused) {
+      this.hasLoggedAutoResume = false;
+    }
     return this.isPaused;
   }
```

---

## Thứ tự thực hiện

```
1. BE: agent.dto.ts        → thêm until? vào AgentStatusResponseDto
2. BE: agent.repository.ts → select thêm pausedUntil, trả until trong return
3. Agent: agent.types.ts   → thêm until? vào PauseStatusResponse
4. Agent: PauseController.ts → thêm pausedUntil field + sửa applyStatus() + sửa getIsPaused()
```

---

## Verification Plan

### Automated Tests

```bash
cd agent && npx jest --coverage
```

### Manual Verification (Postman / curl)

**Kịch bản 1 — Pause có thời hạn ngắn (test auto-resume):**

```
1. PATCH /devices/:id/pause
   Body: { "pausedUntil": "<ISO thời điểm 1 phút sau>" }

2. GET /api/v1/agent/status
   Response mong đợi:
   {
     "data": {
       "paused": true,
       "since": "...",
       "until": "2026-07-09T13:10:00.000Z"
     }
   }

3. Chờ Agent poll (30s): log xuất hiện
   "[PauseController] Trạng thái thay đổi → TẠM DỪNG ⏸ [Hết hạn: 2026-07-09T13:10:00.000Z]"

4. Sau 1 phút (pausedUntil qua):
   - Main loop gọi getIsPaused() → trả false → collect bình thường
   - Log xuất hiện 1 lần duy nhất:
     "[PauseController] Hết hạn pause — tự động resume ▶ ..."
```

**Kịch bản 2 — Pause vô thời hạn:**

```
1. PATCH /devices/:id/pause
   Body: {}   ← không có pausedUntil

2. GET /api/v1/agent/status
   Response mong đợi:
   {
     "data": {
       "paused": true,
       "since": "...",
       "until": undefined   ← không có trường until
     }
   }

3. Agent: pausedUntil = null → getIsPaused() luôn trả true
   → không bao giờ tự resume, chờ phụ huynh bấm resume
```

**Kịch bản 3 — Resume thủ công:**

```
1. PATCH /devices/:id/resume

2. Agent poll 30s sau:
   → { paused: false } → isPaused = false, pausedUntil = null
   → hasLoggedAutoResume reset về false
   → Log: "[PauseController] Trạng thái thay đổi → TIẾP TỤC ▶"
```

---

## Hướng dẫn Test Thủ Công (Manual Testing)

> **Yêu cầu trước khi test:**
> - BE đang chạy tại `http://localhost:3000`
> - Đã có tài khoản phụ huynh và thiết bị đã đăng ký
> - Có sẵn `<deviceToken>` (UUID từ lúc tạo thiết bị) và `<deviceId>` (ObjectId)
> - Dùng Postman hoặc bất kỳ HTTP client nào

---

### Bước 0 — Đăng nhập lấy JWT

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "phu_huynh@example.com",
  "password": "mat_khau"
}
```

**Response mong đợi:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> 💡 Lưu `accessToken` → dùng header `Authorization: Bearer <accessToken>` cho mọi request của phụ huynh.

---

### Bước 1 — Lấy danh sách thiết bị (lấy `deviceId`)

```http
GET http://localhost:3000/api/v1/devices
Authorization: Bearer <accessToken>
```

**Response mong đợi:**
```json
{
  "success": true,
  "data": [
    {
      "id": "686e7f3a2b1c4d5e6f7a8b9c",
      "deviceName": "Laptop của Minh",
      "isPaused": false,
      "pausedSince": null,
      "pausedUntil": null,
      "status": "active"
    }
  ]
}
```

> 💡 Lưu lại `id` → dùng làm `<deviceId>` trong các kịch bản bên dưới.

---

### Kịch bản 1 — Pause vô thời hạn

**Mục tiêu:** Kiểm tra Agent dừng thu thập, `until` không xuất hiện trong response.

#### 1a. Phụ huynh gọi PATCH pause

```http
PATCH http://localhost:3000/api/v1/devices/<deviceId>/pause
Authorization: Bearer <accessToken>
Content-Type: application/json

{}
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "<deviceId>",
      "isPaused": true,
      "pausedSince": "2026-07-09T13:20:00.000Z",
      "pausedUntil": null
    },
    "message": "Thiết bị đã được tạm dừng."
  }
}
```

#### 1b. Giả lập Agent poll — GET /agent/status

```http
GET http://localhost:3000/api/v1/agent/status
X-Device-Token: <deviceToken>
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "message": "Lấy trạng thái thành công",
  "data": {
    "paused": true,
    "since": "2026-07-09T13:20:00.000Z",
    "until": null,
    "reason": null
  }
}
```

**✅ Điểm kiểm tra:**
- `paused = true`
- `until = null` — không có hạn chót
- Log Agent (nếu đang chạy): `[PauseController] Trạng thái thay đổi → TẠM DỪNG ⏸`

---

### Kịch bản 2 — Pause có thời hạn (test auto-resume)

**Mục tiêu:** Kiểm tra `until` được trả đúng và Agent tự resume sau khi hết hạn.

#### 2a. Phụ huynh gọi PATCH pause với `pausedUntil`

> Lấy thời điểm hiện tại + 2 phút, định dạng ISO 8601. Ví dụ: `2026-07-09T13:25:00.000Z`

```http
PATCH http://localhost:3000/api/v1/devices/<deviceId>/pause
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "pausedUntil": "2026-07-09T13:25:00.000Z"
}
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "data": {
    "device": {
      "isPaused": true,
      "pausedSince": "2026-07-09T13:23:00.000Z",
      "pausedUntil": "2026-07-09T13:25:00.000Z"
    },
    "message": "Thiết bị đã được tạm dừng đến 2026-07-09T13:25:00.000Z."
  }
}
```

#### 2b. Giả lập Agent poll — GET /agent/status

```http
GET http://localhost:3000/api/v1/agent/status
X-Device-Token: <deviceToken>
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "data": {
    "paused": true,
    "since": "2026-07-09T13:23:00.000Z",
    "until": "2026-07-09T13:25:00.000Z",
    "reason": null
  }
}
```

**✅ Điểm kiểm tra:**
- `until` phải xuất hiện và khớp giá trị đã truyền vào
- Log Agent: `[PauseController] Trạng thái thay đổi → TẠM DỪNG ⏸ [Hết hạn: 2026-07-09T13:25:00.000Z]`

#### 2c. Chờ qua `pausedUntil` — quan sát Agent tự resume

Sau khi đồng hồ vượt qua `2026-07-09T13:25:00.000Z`, main loop (chạy mỗi 5s) sẽ gọi `getIsPaused()` và nhận `false`.

**Log Agent xuất hiện đúng 1 lần duy nhất (không spam):**
```
[PauseController] Hết hạn pause — tự động resume ▶ (isPaused server-side vẫn = true, sẽ đồng bộ ở poll tiếp theo).
```

> ⚠️ **Hành vi bình thường:** DB vẫn còn `isPaused = true` cho đến khi Agent poll lần kế hoặc phụ huynh bấm resume. Đây là đúng theo thiết kế client-side auto-resume.

---

### Kịch bản 3 — Resume thủ công

**Mục tiêu:** Kiểm tra phụ huynh mở lại giám sát, DB được reset hoàn toàn.

#### 3a. Phụ huynh gọi PATCH resume

```http
PATCH http://localhost:3000/api/v1/devices/<deviceId>/resume
Authorization: Bearer <accessToken>
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "data": {
    "device": {
      "isPaused": false,
      "pausedSince": null,
      "pausedUntil": null
    },
    "message": "Thiết bị đã được tiếp tục giám sát."
  }
}
```

#### 3b. Giả lập Agent poll — GET /agent/status

```http
GET http://localhost:3000/api/v1/agent/status
X-Device-Token: <deviceToken>
```

**Response mong đợi (200):**
```json
{
  "success": true,
  "data": {
    "paused": false,
    "since": null,
    "until": null,
    "reason": null
  }
}
```

**✅ Điểm kiểm tra:**
- `paused = false`, `until = null`
- Log Agent (tại poll tiếp theo): `[PauseController] Trạng thái thay đổi → TIẾP TỤC ▶`

---

### Kịch bản 4 — Token sai (lỗi 401)

**Mục tiêu:** Đảm bảo token không hợp lệ bị từ chối.

```http
GET http://localhost:3000/api/v1/agent/status
X-Device-Token: token_khong_ton_tai
```

**Response mong đợi (401):**
```json
{
  "success": false,
  "message": "Device token không hợp lệ"
}
```

---

### Kịch bản 5 — Sai quyền sở hữu (lỗi 404)

**Mục tiêu:** Đảm bảo phụ huynh không thể thao tác trên thiết bị người khác.

```http
PATCH http://localhost:3000/api/v1/devices/<deviceId_cua_nguoi_khac>/pause
Authorization: Bearer <accessToken_cua_minh>
Content-Type: application/json

{}
```

**Response mong đợi (404):**
```json
{
  "success": false,
  "message": "Không tìm thấy thiết bị"
}
```

---

### Bảng tóm tắt kết quả mong đợi

| # | Kịch bản | Endpoint | `isPaused` DB | `until` trong /status | Hành vi Agent |
|---|---|---|---|---|---|
| 1 | Pause vô thời hạn | `PATCH /:id/pause {}` | `true` | `null` | Dừng vô thời hạn ⏸ |
| 2 | Pause có hạn | `PATCH /:id/pause { pausedUntil }` | `true` | ISO string đúng | Tự resume khi hết hạn ▶ |
| 3 | Resume thủ công | `PATCH /:id/resume` | `false` | `null` | Tiếp tục collect ▶ |
| 4 | Token sai | `GET /agent/status` (token sai) | — | — | `401 Unauthorized` |
| 5 | Sai ownership | `PATCH /:id/pause` (id sai) | — | — | `404 Not Found` |
