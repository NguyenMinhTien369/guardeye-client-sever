## Luồng tạo DeviceToken hoàn chỉnh

---

### Tổng quan các bên tham gia

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Phụ huynh  │     │  Dashboard  │     │   Backend   │     │  Máy trẻ   │
│  (Browser)  │     │  (React)    │     │  (Express)  │     │  (Agent)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

### Giai đoạn 1 — Phụ huynh đăng ký tài khoản

```
Phụ huynh          Dashboard            Backend              Database
    │                   │                   │                    │
    │── Điền email ─────>│                   │                    │
    │   password         │                   │                    │
    │   họ tên           │                   │                    │
    │                   │── POST ───────────>│                    │
    │                   │  /api/auth/register│                    │
    │                   │                   │── Hash password ───>│
    │                   │                   │── INSERT users ────>│
    │                   │                   │<── user.id ─────────│
    │                   │                   │                    │
    │                   │<── 201 Created ───│                    │
    │                   │   { accessToken,  │                    │
    │                   │     refreshToken } │                    │
    │<── Vào Dashboard ─│                   │                    │
```

---

### Giai đoạn 2 — Phụ huynh tạo hồ sơ cho con

```
Phụ huynh          Dashboard            Backend              Database
    │                   │                   │                    │
    │── Nhấn ───────────>│                   │                    │
    │  "Thêm hồ sơ con" │                   │                    │
    │                   │                   │                    │
    │── Điền thông tin ─>│                   │                    │
    │   Tên: "Minh"      │                   │                    │
    │   Tuổi: 10         │                   │                    │
    │   Avatar           │                   │                    │
    │                   │── POST ───────────>│                    │
    │                   │  /api/children     │                    │
    │                   │  { name, age,      │                    │
    │                   │    avatar }        │                    │
    │                   │                   │── INSERT children ─>│
    │                   │                   │   parentId = me     │
    │                   │                   │<── child.id ────────│
    │                   │<── 201 Created ───│                    │
    │                   │   { childId,      │                    │
    │                   │     name }        │                    │
    │<── Thấy hồ sơ ────│                   │                    │
    │   "Minh" trên UI  │                   │                    │
```

---

### Giai đoạn 3 — Phụ huynh đăng ký thiết bị (QUAN TRỌNG NHẤT)

```
Phụ huynh          Dashboard            Backend              Database
    │                   │                   │                    │
    │── Chọn hồ sơ ─────>│                   │                    │
    │   "Minh"           │                   │                    │
    │── Nhấn ───────────>│                   │                    │
    │  "Thêm thiết bị"  │                   │                    │
    │                   │                   │                    │
    │── Điền thông tin ─>│                   │                    │
    │   Tên máy:         │                   │                    │
    │   "Laptop phòng   │                   │                    │
    │    con Minh"       │                   │                    │
    │                   │── POST ───────────>│                    │
    │                   │  /api/devices      │                    │
    │                   │  { childId,        │                    │
    │                   │    deviceName }    │                    │
    │                   │                   │                    │
    │                   │                   │── Generate token ───│
    │                   │                   │   crypto.randomUUID │
    │                   │                   │   "a1b2-c3d4-..."   │
    │                   │                   │                    │
    │                   │                   │── INSERT devices ──>│
    │                   │                   │   deviceToken       │
    │                   │                   │   childId           │
    │                   │                   │   deviceName        │
    │                   │                   │   status: "pending" │
    │                   │                   │<── device.id ───────│
    │                   │                   │                    │
    │                   │<── 201 Created ───│                    │
    │                   │   { deviceToken:  │                    │
    │                   │    "a1b2-c3d4",   │                    │
    │                   │    deviceName,    │                    │
    │                   │    deviceId }     │                    │
    │                   │                   │                    │
    │<── Hiển thị ───────│                   │                    │
    │   deviceToken      │                   │                    │
    │   + hướng dẫn     │                   │                    │
    │   cài agent        │                   │                    │
```

---

### Giai đoạn 4 — Dashboard hiển thị hướng dẫn cài đặt

```
┌─────────────────────────────────────────────────────────┐
│  🖥️  Thiết bị: "Laptop phòng con Minh"                  │
│                                                         │
│  Bước 1: Tải file agent                                 │
│  [⬇️  Tải agent.exe]                                    │
│                                                         │
│  Bước 2: Tải file cấu hình                              │
│  [⬇️  Tải config.json]  ← Backend tự generate file này  │
│                                                         │
│  Nội dung config.json:                                  │
│  {                                                      │
│    "deviceToken": "a1b2-c3d4-e5f6",  ← đã điền sẵn    │
│    "serverUrl": "https://api.guardeye.com",             │
│    "monitoredUsers": [""]  ← phụ huynh tự điền         │
│  }                                                      │
│                                                         │
│  Bước 3: Copy 2 file vào cùng thư mục trên máy con     │
│  Bước 4: Chạy lệnh (PowerShell Admin):                  │
│  .\agent.exe install                                    │
│                                                         │
│  Trạng thái: ⏳ Chờ kết nối...                          │
└─────────────────────────────────────────────────────────┘
```

---

### Giai đoạn 5 — Agent kết nối lần đầu

```
Máy trẻ (Agent)      Backend              Database         Dashboard
    │                   │                    │                 │
    │── Khởi động ──────│                    │                 │
    │   Đọc config.json │                    │                 │
    │   deviceToken:    │                    │                 │
    │   "a1b2-c3d4"     │                    │                 │
    │                   │                    │                 │
    │── GET ────────────>│                    │                 │
    │  /api/agent/status │                    │                 │
    │  ?deviceToken=     │                    │                 │
    │   a1b2-c3d4        │                    │                 │
    │                   │── SELECT devices ──>│                 │
    │                   │   WHERE token=...  │                 │
    │                   │<── device found ───│                 │
    │                   │                    │                 │
    │                   │── UPDATE devices ──>│                 │
    │                   │   status: "active" │                 │
    │                   │   lastSeenAt: now  │                 │
    │                   │   firstConnectedAt │                 │
    │                   │<── OK ─────────────│                 │
    │                   │                    │                 │
    │<── 200 OK ────────│                    │                 │
    │   { paused: false }│                    │                 │
    │                   │                    │                 │
    │   [Bắt đầu        │                    │── Realtime ─────>│
    │    thu thập data] │                    │   notify        │
    │                   │                    │                 │
    │                   │                    │         ┌───────────────┐
    │                   │                    │         │ Trạng thái:   │
    │                   │                    │         │ ✅ Đã kết nối │
    │                   │                    │         │ Lần cuối: now │
    │                   │                    │         └───────────────┘
```

---

### Giai đoạn 6 — Agent gửi data định kỳ

```
Máy trẻ (Agent)         Backend                Database
    │                      │                       │
    │   [Mỗi 5 phút]       │                       │
    │── POST ──────────────>│                       │
    │  /api/agent/sync      │                       │
    │  {                    │                       │
    │   deviceToken:        │                       │
    │    "a1b2-c3d4",       │── Validate token ────>│
    │   events: [           │<── device found ──────│
    │    { type:"window",   │                       │
    │      title:"YouTube", │── Bulk INSERT ────────>│
    │      processName:     │   window_events        │
    │      "chrome.exe",    │   history_events       │
    │      isIncognito:     │<── savedCount: 25 ─────│
    │       false },        │                       │
    │    { type:"history",  │── Kiểm tra rules ─────>│
    │      url:"youtube.com"│   (vi phạm không?)     │
    │      browser:"chrome" │<── có vi phạm ─────────│
    │    }                  │                       │
    │   ],                  │── Gửi email alert ────>│
    │   sentAt: "...",      │   (SendGrid/SMTP)      │
    │   eventCount: 25      │                       │
    │  }                    │                       │
    │<── 200 OK ────────────│                       │
    │   { success: true,    │                       │
    │     savedCount: 25 }  │                       │
    │                       │                       │
    │   [Buffer cleared ✓]  │                       │
```

---

### Database Schema cho luồng này

```sql
-- Tài khoản phụ huynh
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Hồ sơ từng đứa con
CREATE TABLE children (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  UUID NOT NULL REFERENCES users(id),
  name       VARCHAR(255) NOT NULL,
  age        INTEGER,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Thiết bị được monitor
CREATE TABLE devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            UUID NOT NULL REFERENCES children(id),
  device_token        UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  device_name         VARCHAR(255) NOT NULL,

  -- Trạng thái kết nối
  status              VARCHAR(20) DEFAULT 'pending',
  -- pending   = chưa cài agent
  -- active    = agent đang chạy
  -- inactive  = agent không ping về

  first_connected_at  TIMESTAMP,
  last_seen_at        TIMESTAMP,

  -- Trạng thái pause
  is_paused           BOOLEAN DEFAULT FALSE,
  paused_since        TIMESTAMP,
  pause_reason        VARCHAR(500),
  paused_until        TIMESTAMP,  -- hết giờ này tự resume

  created_at          TIMESTAMP DEFAULT NOW()
);
```

---

### Tóm tắt toàn bộ luồng

```
PHỤ HUYNH                    BACKEND                    MÁY TRẺ
─────────────────────────────────────────────────────────────────
1. Đăng ký tài khoản    → Tạo user trong DB
2. Tạo hồ sơ con        → Tạo children trong DB
3. Đăng ký thiết bị     → Tạo deviceToken (UUID)
                           Lưu vào bảng devices
4. Tải config.json      → Backend generate sẵn
   (đã có deviceToken)
5. Cài agent.exe        →                         → Agent khởi động
   lên máy con                                       Đọc config.json
6.                      ← Agent gọi /status       ← Xác nhận token
                           status: "active"
7.                      ← Agent gửi /sync         ← Thu thập data
                           Lưu vào DB                mỗi 5 phút
                           Kiểm tra rules
                           Gửi email nếu vi phạm
```
