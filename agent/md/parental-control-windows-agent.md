# Dự án: Parental Control — Module Windows Agent

> **Vai trò AI:** Senior Backend & System Engineer (Node.js + TypeScript)

---

## 1. Tổng quan dự án

Windows Agent là một **Windows Service** chạy ngầm trên máy tính của trẻ em. Nhiệm vụ:

- Thu thập tên cửa sổ đang active (title + process name)
- Đọc lịch sử duyệt web từ SQLite của Chrome và Edge
- Phát hiện chế độ ẩn danh (Incognito/InPrivate)
- Buffer data in-memory, đồng bộ lên Backend qua REST API
- Nhận lệnh tạm dừng từ server theo chu kỳ

**Stack:** TypeScript 5, Node.js 18, đóng gói bằng `pkg` thành `.exe`

---

## 2. Cấu trúc thư mục hoàn chỉnh

```
agent/
├── src/
│   ├── index.ts                  ← Entry point, main loop 5s
│   ├── config/
│   │   └── ConfigReader.ts       ← Đọc & validate config.json
│   ├── guards/
│   │   ├── UserGuard.ts          ← Kiểm tra username hệ thống
│   │   └── PauseController.ts    ← Poll API 30s, cache trạng thái
│   ├── collectors/
│   │   ├── WindowMonitor.ts      ← active-win, dedup theo title
│   │   ├── HistoryReader.ts      ← Copy SQLite→TEMP rồi query
│   │   └── IncognitoDetector.ts  ← Detect keyword từ title
│   ├── sync/
│   │   ├── DataBuffer.ts         ← In-memory buffer, snapshot pattern
│   │   └── SyncService.ts        ← POST /api/agent/sync mỗi 5 phút
│   └── service/
│       └── install.ts            ← node-windows: install/uninstall/status
├── tests/
│   └── config/
│       └── ConfigReader.test.ts  ← 30 test cases, mock fs
├── config.json
├── jest.config.js
├── pkg.config.json
├── package.json
└── tsconfig.json
```

---

## 3. Luồng hoạt động (3 giai đoạn)

### Giai đoạn 1 — Bootstrap (chạy 1 lần khi khởi động)

1. `ConfigReader.load()` → nếu lỗi → `process.exit(1)`
2. Khởi tạo theo thứ tự: `DataBuffer` → `Collectors` → `Guards` → `SyncService`
3. `await pauseController.start()` (poll ngay lần đầu)
4. `syncService.start()` (chỉ bắt đầu đếm interval)
5. Đăng ký graceful shutdown (`SIGINT`, `SIGTERM`)
6. Bắt `uncaughtException` + `unhandledRejection` (log, không crash)

### Giai đoạn 2 — Main Loop (`setInterval` mỗi 5s)

1. `isTickRunning` flag → bỏ qua nếu tick trước chưa xong
2. `UserGuard.isAllowed()` → `false` thì skip
3. `PauseController.getIsPaused()` → `true` thì skip
4. `Promise.allSettled([windowMonitor.collect(), historyReader.collect()])`
5. `push`/`pushMany` vào `DataBuffer`

### Giai đoạn 3 — Sync Loop (`setInterval` mỗi 5 phút)

1. Nếu buffer rỗng → skip
2. `snapshot = buffer.snapshot()`
3. `POST /api/agent/sync` với payload
4. HTTP 200 → `buffer.clear()`
5. HTTP 4xx → log error, giữ buffer
6. HTTP 5xx / network error → log warn, giữ buffer, retry lần sau

### Graceful Shutdown

1. `isShuttingDown` flag chống double-shutdown
2. `pauseController.stop()` → `syncService.stop()`
3. `syncService.flushNow()` (flush buffer lần cuối)
4. Log stats → `process.exit(0)`

---

## 4. Đặc tả chi tiết từng file

### `config.json`

| Field | Type | Bắt buộc | Default |
|---|---|---|---|
| `deviceToken` | `string` | ✅ | — |
| `serverUrl` | `string` | ✅ | — |
| `monitoredUsers` | `string[]` | ✅ | — |
| `syncIntervalMs` | `number` | ❌ | `300000` |
| `mainLoopIntervalMs` | `number` | ❌ | `5000` |
| `pausePollIntervalMs` | `number` | ❌ | `30000` |

---

### `ConfigReader.ts`

**Class `ConfigReader`**

```ts
constructor(configPath?: string)
// default: path.resolve(process.cwd(), "config.json")

load(): AgentConfig
// đọc file → parse JSON → validate → merge defaults → cache
// throw ConfigError nếu: file không tồn tại, JSON lỗi, thiếu/sai bất kỳ field bắt buộc nào

get(): AgentConfig
// trả về config đã cache
// throw ConfigError nếu chưa gọi load()
```

**Class `ConfigError extends Error`** — `name = "ConfigError"`

**Validate rules:**
- `deviceToken`: `typeof string`, `trim()` không rỗng
- `serverUrl`: `typeof string`, `startsWith("http")`
- `monitoredUsers`: `Array`, `length > 0`, mọi phần tử là `string`

---

### `UserGuard.ts`

**Class `UserGuard`**

```ts
constructor({ monitoredUsers: string[], caseInsensitive?: boolean })
// caseInsensitive default: true
// normalize monitoredUsers thành Set<string> ngay khi khởi tạo

isAllowed(): boolean
// gọi os.userInfo().username
// cache kết quả theo username (invalidate nếu username thay đổi)
// return false nếu os.userInfo() throw

getCurrentUsername(): string
getMonitoredUsers(): string[]
invalidateCache(): void
```

---

### `PauseController.ts`

**Class `PauseController`**

```ts
constructor({ config: AgentConfig, fetchFn?: typeof fetch })

start(): Promise<void>
// poll ngay lần đầu (không chờ interval)
// setInterval mỗi config.pausePollIntervalMs

stop(): void         // clearInterval
getIsPaused(): boolean  // đọc cache, KHÔNG gọi HTTP
getLastSuccessfulPoll(): Date | null
getConsecutiveFailures(): number
```

**API call:**
- `GET {serverUrl}/api/agent/status?deviceToken={token}`
- Header: `X-Device-Token: {token}`
- Timeout: 8 giây (`AbortController`)
- Response: `{ paused: boolean, since?: string, reason?: string }`

**Fail-safe:** lỗi API → giữ nguyên trạng thái cũ (không tự pause/resume)

**Log:** chỉ log khi trạng thái **thay đổi** hoặc `consecutiveFailures % 5 === 0`

---

### `IncognitoDetector.ts`

**Class `IncognitoDetector`**

```ts
constructor(extraKeywords?: string[])

check(windowTitle: string): { isIncognito: boolean, matchedKeyword: string | null }
// so sánh lowercase
```

**Keywords mặc định:**
`"incognito"`, `"private browsing"`, `"inprivate"`, `"private"`, `"private window"`, `"private — safari"`

---

### `WindowMonitor.ts`

**Class `WindowMonitor`**

```ts
constructor({ incognitoDetector?: IncognitoDetector })

collect(): Promise<WindowEvent | null>
// dùng active-win lấy cửa sổ đang focus
// return null nếu: không có cửa sổ, title không đổi (dedup)
// processName: lấy basename của owner.path, fallback owner.name
// KHÔNG throw ra ngoài — lỗi được catch, return null
```

**Interface `WindowEvent`:**

```ts
{
  type: "window"
  timestamp: string  // ISO 8601
  title: string
  processName: string
  isIncognito: boolean
}
```

---

### `HistoryReader.ts`

**Class `HistoryReader`**

```ts
constructor()

collect(): Promise<HistoryEvent[]>
// dò tìm profiles Chrome + Edge
// với mỗi profile: copy → query → cleanup
// return [] nếu lỗi toàn bộ
```

**Profile discovery:**
- Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data\{Profile}\History`
- Edge: `%LOCALAPPDATA%\Microsoft\Edge\User Data\{Profile}\History`
- Profile dirs: `"Default"`, `"Profile 1"`, `"Profile 2"`...

**Copy sang TEMP (bắt buộc, tránh "database is locked"):**
- Tên file: `parental-agent-history-{md5(historyPath)[0:8]}.db`
- Đường dẫn: `os.tmpdir()` + tên file
- Xóa file cũ trước khi copy
- Luôn xóa trong `finally` block
- Đăng ký cleanup khi `process exit`/`SIGINT`/`SIGTERM`

**SQLite query** (`better-sqlite3`, `readonly: true`):

```sql
SELECT url, title, last_visit_time
FROM urls
WHERE last_visit_time > ?
ORDER BY last_visit_time DESC
LIMIT 50
```

**Timestamp conversion:**
- Chromium: microseconds từ `1601-01-01`
- Delta: `11_644_473_600_000` ms
- `JS Date = new Date(chromiumTs / 1000 - DELTA)`
- Lần đầu chưa có `lastReadTime`: chỉ lấy 1 giờ gần nhất

**Interface `HistoryEvent`:**

```ts
{
  type: "history"
  timestamp: string  // ISO 8601, thời điểm collect
  url: string
  title: string
  browser: "chrome" | "edge" | "unknown"
  visitTime: string  // ISO 8601, thời điểm browser ghi nhận
}
```

---

### `DataBuffer.ts`

**Class `DataBuffer`**

```ts
constructor(maxSize: number = 10000)

push(event: AgentEvent): void
// khi đầy: evict oldest (FIFO, dùng shift())

pushMany(events: AgentEvent[]): void
snapshot(): AgentEvent[]  // bản sao, không expose mảng gốc
clear(): void             // chỉ gọi sau sync thành công
get size(): number
get isEmpty(): boolean
```

`type AgentEvent = WindowEvent | HistoryEvent`

---

### `SyncService.ts`

**Class `SyncService`**

```ts
constructor({ config: AgentConfig, buffer: DataBuffer, fetchFn? })

start(): void
// setInterval mỗi config.syncIntervalMs
// KHÔNG sync ngay khi start

stop(): void       // clearInterval
flushNow(): Promise<void>  // sync ngay lập tức, dùng khi shutdown

getStats(): {
  totalSynced: number
  successCount: number
  failureCount: number
  lastSyncAt: Date | null
  lastFailureReason: string | null
}
```

**API call:**
- `POST {serverUrl}/api/agent/sync`
- Headers: `X-Device-Token: {token}`, `Content-Type: application/json`
- Timeout: 15 giây (`AbortController`)
- Payload: `{ deviceToken, events, sentAt, eventCount }`

**Response handling:**

| Status | Hành động |
|---|---|
| `200 OK` | `buffer.clear()`, cập nhật stats |
| `4xx` | Log error (cần can thiệp thủ công), giữ buffer |
| `5xx` | Log warn (tự retry), giữ buffer |
| Timeout | Log warn, giữ buffer |

---

### `install.ts`

Dùng `node-windows` để quản lý Windows Service.

**Service config:**

```ts
{
  name: "ParentalControlAgent",
  description: "Parental Control Agent...",
  script: "path đến dist/index.js",
  maxRestarts: 3,
  wait: 2,
  grow: 0.5,
  logpath: "thư mục logs/ cạnh script",
  logOnAs: "LocalSystem",
  env: { NODE_ENV: "production" }
}
```

**CLI** (chạy với quyền Administrator):

```bash
node install.js install    # cài + start service
node install.js uninstall  # stop + gỡ service
node install.js status     # execSync("sc query ParentalControlAgent")
```

---

## 5. Cấu hình build

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

### `pkg.config.json`

```json
{
  "assets": ["config.json"],
  "scripts": ["dist/**/*.js"],
  "targets": ["node18-win-x64"],
  "outputPath": "release/"
}
```

### `package.json` — Dependencies

**dependencies:**

```json
{
  "active-win": "^8.2.1",
  "better-sqlite3": "^9.4.3",
  "node-windows": "^1.0.0-beta.8"
}
```

**devDependencies:**

```json
{
  "typescript": "^5.3.3",
  "ts-node": "^10.9.2",
  "pkg": "^5.8.1",
  "jest": "^29.7.0",
  "ts-jest": "^29.1.4",
  "@types/jest": "^29.5.12",
  "@types/node": "^20.11.0",
  "@types/better-sqlite3": "^7.6.8",
  "@types/node-windows": "^0.1.4"
}
```

**scripts:**

```json
{
  "dev":               "ts-node src/index.ts",
  "build":             "tsc --project tsconfig.json",
  "build:exe":         "npm run build && pkg ... --target node18-win-x64",
  "service:install":   "node dist/service/install.js install",
  "service:uninstall": "node dist/service/install.js uninstall",
  "service:status":    "node dist/service/install.js status",
  "test":              "jest",
  "test:coverage":     "jest --coverage",
  "typecheck":         "tsc --noEmit"
}
```

---

## 6. Unit Test

### `jest.config.js`

```js
{
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["tests/"],
  isolatedModules: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 }
  }
}
```

### `ConfigReader.test.ts` — 9 nhóm, ~30 test cases

**Mock strategy:**
- `jest.mock("fs")` ở top-level
- `jest.mocked(fs)` để lấy typed mock
- Helper `makeConfigJson(overrides?)` tạo partial config
- Helper `mockValidFile(content?)` setup `existsSync` + `readFileSync`

**Nhóm 1: Happy path — `load()` thành công**
- Trả về config đúng
- Merge defaults cho fields optional
- Ghi đè defaults khi có giá trị riêng
- `existsSync` gọi đúng 1 lần với đúng path
- `readFileSync` gọi đúng 1 lần với encoding `utf-8`
- `load()` nhiều lần không bị cache cứng

**Nhóm 2: `get()` trước và sau `load()`**
- Throw `ConfigError` nếu chưa `load()`
- Trả về đúng config sau `load()`
- Nhiều lần `get()` trả về cùng reference

**Nhóm 3: File không tồn tại**
- Throw `ConfigError` chứa path trong message
- Throw `ConfigError` chứa `"Không tìm thấy"`
- `error.name === "ConfigError"`
- `readFileSync` không được gọi

**Nhóm 4: Permission denied**
- Throw `ConfigError` (không phải `Error` gốc)
- Wrap message gốc vào `ConfigError`

**Nhóm 5: JSON syntax error**
- Broken JSON, file rỗng, plain text, array root

**Nhóm 6: Sai `deviceToken`**
- `undefined`, empty string, `null`, number, whitespace

**Nhóm 7: Sai `serverUrl`**
- Missing, `ftp://`, chấp nhận `http://`, chấp nhận `https://`

**Nhóm 8: Sai `monitoredUsers`**
- Empty array, string, mixed types, nhiều user hợp lệ

**Nhóm 9: Default config path**
- Constructor không arg → `cwd()/config.json`

---

## 7. Nguyên tắc code toàn dự án

- **100% TypeScript**, Class-based OOP
- **Dependency Injection:** `fetchFn`, `incognitoDetector` inject qua constructor
- **Collectors và SyncService:** KHÔNG throw ra ngoài
- **Agent KHÔNG BAO GIỜ crash** — mọi lỗi đều catch và log
- **Log prefix:** `[ClassName]` để dễ grep
- **Không spam log** mỗi 5s — chỉ log khi có thay đổi đáng chú ý
- **Snapshot pattern** trong `DataBuffer` — không expose mảng gốc
- **`isTickRunning` flag** trong main loop — chống overlap tick
- **`isShuttingDown` flag** — chống double-shutdown
- **`AbortController`** cho mọi HTTP call (timeout rõ ràng)
- **Fail-safe mọi nơi:** lỗi một module không kéo sập module khác

---

## 8. Lệnh cài đặt (chạy theo thứ tự)

```powershell
# Bước 1 — Build tools (PowerShell Admin, chỉ làm 1 lần)
npm install --global windows-build-tools

# Bước 2 — Production dependencies
npm install active-win better-sqlite3 node-windows

# Bước 3 — Dev dependencies
npm install -D typescript ts-node pkg jest ts-jest `
  @types/jest @types/node @types/better-sqlite3 @types/node-windows

# Bước 4 — Build & deploy
npm run typecheck        # kiểm tra TypeScript
npm run build            # biên dịch ra dist/
npm run build:exe        # đóng gói release/agent.exe
npm run service:install  # cài Windows Service (Admin)
```
