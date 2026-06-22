# Xóa HistoryReader & IncognitoDetector — Báo cáo thay đổi

> **Ngày thực hiện:** 21/06/2026  
> **Người thực hiện:** Antigravity AI  
> **Dự án:** GuardEye Agent

---

## 🎯 Mục tiêu

Xóa hoàn toàn module thu thập lịch sử trình duyệt (`HistoryReader`) và module phát hiện chế độ ẩn danh (`IncognitoDetector`) khỏi codebase của Agent.

---

## 🗑️ Files đã XÓA

| File | Đường dẫn | Lý do |
|---|---|---|
| `HistoryReader.ts` | `agent/src/collectors/HistoryReader.ts` | Xóa theo yêu cầu |
| `IncognitoDetector.ts` | `agent/src/collectors/IncognitoDetector.ts` | Xóa theo yêu cầu |

---

## ✏️ Files đã CHỈNH SỬA

### 1. `agent/src/index.ts`

| Thay đổi | Chi tiết |
|---|---|
| Xóa import | `import { HistoryReader }` và `import { IncognitoDetector }` |
| Xóa khởi tạo | `const incognitoDetector = new IncognitoDetector()` |
| Xóa khởi tạo | `const historyReader = new HistoryReader()` |
| Sửa WindowMonitor | `new WindowMonitor({ incognitoDetector })` → `new WindowMonitor()` |
| Xóa khỏi `startMainLoop()` | Tham số `historyReader` |
| Xóa khỏi `MainLoopDependencies` | Field `historyReader: HistoryReader` |
| Xóa khỏi `TickDependencies` | Field `historyReader: HistoryReader` |
| Xóa khỏi `startMainLoop` destructuring | `historyReader,` |
| Xóa khỏi `runTick` destructuring | `historyReader,` |
| Đơn giản hóa collector logic | Thay `Promise.allSettled([windowMonitor, historyReader])` bằng `windowMonitor.collect()` trực tiếp |

**Trước:**
```typescript
// Chạy song song — windowMonitor và historyReader độc lập nhau
const [windowEvent, historyEvents] = await Promise.allSettled([
  windowMonitor.collect(),
  historyReader.collect(),
]);
// ... xử lý cả 2 kết quả
```

**Sau:**
```typescript
// Thu thập thông tin cửa sổ đang active
try {
  const windowEvent = await windowMonitor.collect();
  if (windowEvent !== null) {
    dataBuffer.push(windowEvent);
  }
} catch (err) {
  console.error(`[Tick] WindowMonitor lỗi: ${(err as Error).message}`);
}
```

---

### 2. `agent/src/collectors/WindowMonitor.ts`

| Thay đổi | Chi tiết |
|---|---|
| Xóa import | `import { IncognitoDetector }` |
| Xóa interface option | `incognitoDetector?: IncognitoDetector` khỏi `WindowMonitorOptions` |
| Xóa private field | `private readonly incognitoDetector: IncognitoDetector` |
| Đơn giản hóa constructor | Xóa phần khởi tạo `this.incognitoDetector = ...` |
| Xóa usage | `const { isIncognito } = this.incognitoDetector.check(title)` |
| Xóa field | `isIncognito,` khỏi object `WindowEvent` được tạo ra |

---

### 3. `agent/src/types/agent.types.ts`

| Thay đổi | Chi tiết |
|---|---|
| Xóa field trong `WindowEvent` | `isIncognito: boolean` |
| Xóa interface | `HistoryEvent` (toàn bộ) |
| Sửa union type | `AgentEvent = WindowEvent \| HistoryEvent` → `AgentEvent = WindowEvent` |
| Xóa toàn bộ PHẦN 4 — INTERNAL | Bao gồm 3 interface: `IncognitoCheckResult`, `BrowserProfile`, `ChromiumHistoryRow` |

---

## ⚠️ Lưu ý cho Backend

> **`isIncognito`** đã bị xóa khỏi `WindowEvent`. Nếu Backend đang lưu/đọc field này từ DB, cần cập nhật schema và migration tương ứng.

> **`HistoryEvent`** đã bị xóa hoàn toàn. Agent sẽ không gửi event có `type: "history"` nữa. Backend có thể giữ nguyên collection cũ (dữ liệu lịch sử vẫn còn) nhưng sẽ không nhận thêm data mới.

---

## 📁 Cấu trúc collectors sau khi xóa

```
agent/src/collectors/
└── WindowMonitor.ts   ✅ (còn lại, đã được làm sạch)
```

---

## ✅ Tóm tắt

- **2 files đã xóa:** `HistoryReader.ts`, `IncognitoDetector.ts`
- **3 files đã chỉnh sửa:** `index.ts`, `WindowMonitor.ts`, `agent.types.ts`
- **Agent hiện chỉ thu thập:** Window events (cửa sổ đang active)
- **Không còn thu thập:** Lịch sử duyệt web Chrome/Edge, phát hiện chế độ ẩn danh
