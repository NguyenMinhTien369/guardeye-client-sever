import activeWin, { Result as ActiveWinResult } from "active-win";
import { WindowEvent } from "../types/agent.types";
import { exec } from "child_process";
import { promisify } from "util";
import { BROWSER_PROCESSES } from "./ScreenCaptureManager";

const execAsync = promisify(exec);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WindowMonitorOptions {}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * WindowMonitor — lấy thông tin cửa sổ đang được focus.
 *
 * Dùng thư viện `active-win` để lấy thông tin cơ bản.
 * Dùng UI Automation (PowerShell) để lấy URL thực tế từ trình duyệt.
 * Dedup theo URL hoặc Title để đảm bảo trigger chính xác khi chuyển trang.
 */
export class WindowMonitor {
  /** Key dedup của lần collect trước (dạng `url:ABC` hoặc `title:XYZ`) */
  private lastDedupKey: string | null = null;

  constructor(_options: WindowMonitorOptions = {}) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Thu thập thông tin active window.
   * - Trả về null nếu không có cửa sổ nào đang focus.
   * - Trả về null nếu URL (hoặc title) không đổi so với lần trước (dedup).
   * - Tích hợp gọi PowerShell ngầm lấy URL của trình duyệt.
   */
  public async collect(): Promise<WindowEvent | null> {
    try {
      const win = await activeWin();

      if (!win) {
        return null;
      }

      let title = win.title || "Unknown";
      const processName = this.extractProcessName(win);

      let url: string | null = null;

      // Nếu là trình duyệt, thử lấy URL bằng UI Automation
      if (BROWSER_PROCESSES.includes(processName.toLowerCase())) {
        url = await this.getBrowserUrlViaUIA();
      }

      // Tạo dedup key: ưu tiên URL, nếu không có fallback về title
      const currentDedupKey = url ? `url:${url}` : `title:${title}`;

      // Dedup — chỉ emit event khi cửa sổ/URL thực sự thay đổi
      if (currentDedupKey === this.lastDedupKey) {
        return null;
      }
      this.lastDedupKey = currentDedupKey;

      // Chèn URL vào title để Backend và Dashboard dễ theo dõi (không cần đổi DB schema)
      if (url) {
        title = `[${url}] ${title}`;
      }

      const event: WindowEvent = {
        type: "window",
        timestamp: new Date().toISOString(),
        title,
        processName,
      };

      return event;
    } catch (err) {
      console.error(
        `[WindowMonitor] Lỗi khi lấy active window: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Lấy URL thực tế từ trình duyệt đang active trên Windows.
   * Chạy PowerShell ngầm gọi UIAutomationClient để đọc Address Bar.
   */
  private async getBrowserUrlViaUIA(): Promise<string | null> {
    // Base64 encoded UTF-16LE của script PowerShell UIAutomation
    const psScriptBase64 = "QQBkAGQALQBUAHkAcABlACAALQBBAHMAcwBlAG0AYgBsAHkATgBhAG0AZQAgAFUASQBBAHUAdABvAG0AYQB0AGkAbwBuAEMAbABpAGUAbgB0ADsAIAAkAHIAbwBvAHQAIAA9ACAAWwBTAHkAcwB0AGUAbQAuAFcAaQBuAGQAbwB3AHMALgBBAHUAdABvAG0AYQB0AGkAbwBuAC4AQQB1AHQAbwBtAGEAdABpAG8AbgBFAGwAZQBtAGUAbgB0AF0AOgA6AFIAbwBvAHQARQBsAGUAbQBlAG4AdAA7ACAAJAB3AGkAbgAzADIAIAA9ACAAQQBkAGQALQBUAHkAcABlACAALQBNAGUAbQBiAGUAcgBEAGUAZgBpAG4AaQB0AGkAbwBuACAAIgBbAEQAbABsAEkAbQBwAG8AcgB0ACgAYAAiAHUAcwBlAHIAMwAyAC4AZABsAGwAYAAiACkAXQAgAHAAdQBiAGwAaQBjACAAcwB0AGEAdABpAGMAIABlAHgAdABlAHIAbgAgAEkAbgB0AFAAdAByACAARwBlAHQARgBvAHIAZQBnAHIAbwB1AG4AZABXAGkAbgBkAG8AdwAoACkAOwAiACAALQBOAGEAbQBlACAAIgBXAGkAbgAzADIAIgAgAC0ATgBhAG0AZQBzAHAAYQBjAGUAIAAiAFcAaQBuADMAMgBBAFAASQAiACAALQBQAGEAcwBzAFQAaAByAHUAOwAgACQAaAB3AG4AZAAgAD0AIAAkAHcAaQBuADMAMgA6ADoARwBlAHQARgBvAHIAZQBnAHIAbwB1AG4AZABXAGkAbgBkAG8AdwAoACkAOwAgAGkAZgAgACgAJABoAHcAbgBkACAALQBlAHEAIABbAEkAbgB0AFAAdAByAF0AOgA6AFoAZQByAG8AKQAgAHsAIABlAHgAaQB0ACAAfQA7ACAAJABhAGMAdABpAHYAZQBXAGkAbgBkAG8AdwAgAD0AIABbAFMAeQBzAHQAZQBtAC4AVwBpAG4AZABvAHcAcwAuAEEAdQB0AG8AbQBhAHQAaQBvAG4ALgBBAHUAdABvAG0AYQB0AGkAbwBuAEUAbABlAG0AZQBuAHQAXQA6ADoARgByAG8AbQBIAGEAbgBkAGwAZQAoACQAaAB3AG4AZAApADsAIABpAGYAIAAoACQAbgB1AGwAbAAgAC0AZQBxACAAJABhAGMAdABpAHYAZQBXAGkAbgBkAG8AdwApACAAewAgAGUAeABpAHQAIAB9ADsAIAAkAGMAbwBuAGQAaQB0AGkAbwBuACAAPQAgAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABTAHkAcwB0AGUAbQAuAFcAaQBuAGQAbwB3AHMALgBBAHUAdABvAG0AYQB0AGkAbwBuAC4AUAByAG8AcABlAHIAdAB5AEMAbwBuAGQAaQB0AGkAbwBuACgAWwBTAHkAcwB0AGUAbQAuAFcAaQBuAGQAbwB3AHMALgBBAHUAdABvAG0AYQB0AGkAbwBuAC4AQQB1AHQAbwBtAGEAdABpAG8AbgBFAGwAZQBtAGUAbgB0AF0AOgA6AEMAbwBuAHQAcgBvAGwAVAB5AHAAZQBQAHIAbwBwAGUAcgB0AHkALAAgAFsAUwB5AHMAdABlAG0ALgBXAGkAbgBkAG8AdwBzAC4AQQB1AHQAbwBtAGEAdABpAG8AbgAuAEMAbwBuAHQAcgBvAGwAVAB5AHAAZQBdADoAOgBFAGQAaQB0ACkAOwAgACQAZQBkAGkAdAAgAD0AIAAkAGEAYwB0AGkAdgBlAFcAaQBuAGQAbwB3AC4ARgBpAG4AZABGAGkAcgBzAHQAKABbAFMAeQBzAHQAZQBtAC4AVwBpAG4AZABvAHcAcwAuAEEAdQB0AG8AbQBhAHQAaQBvAG4ALgBUAHIAZQBlAFMAYwBvAHAAZQBdADoAOgBEAGUAcwBjAGUAbgBkAGEAbgB0AHMALAAgACQAYwBvAG4AZABpAHQAaQBvAG4AKQA7ACAAaQBmACAAKAAkAGUAZABpAHQAKQAgAHsAIAAkAHYAYQBsAFAAYQB0AHQAZQByAG4AIAA9ACAAJABlAGQAaQB0AC4ARwBlAHQAQwB1AHIAcgBlAG4AdABQAGEAdAB0AGUAcgBuACgAWwBTAHkAcwB0AGUAbQAuAFcAaQBuAGQAbwB3AHMALgBBAHUAdABvAG0AYQB0AGkAbwBuAC4AVgBhAGwAdQBlAFAAYQB0AHQAZQByAG4AXQA6ADoAUABhAHQAdABlAHIAbgApADsAIABpAGYAIAAoACQAdgBhAGwAUABhAHQAdABlAHIAbgApACAAewAgAFcAcgBpAHQAZQAtAE8AdQB0AHAAdQB0ACAAJAB2AGEAbABQAGEAdAB0AGUAcgBuAC4AQwB1AHIAcgBlAG4AdAAuAFYAYQBsAHUAZQAgAH0AIAB9AA==";
    
    try {
      const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${psScriptBase64}`, {
        timeout: 2000 // Timeout 2s để tránh treo agent nếu API bị kẹt
      });
      const url = stdout.trim();
      return url.length > 0 ? url : null;
    } catch (err) {
      // Bỏ qua lỗi ngầm nếu UIA không lấy được URL hoặc timeout
      return null;
    }
  }

  /**
   * Lấy tên process từ kết quả active-win.
   * active-win trả về owner.name (display name) và owner.path.
   * Ưu tiên lấy basename của path để nhất quán hơn.
   */
  private extractProcessName(win: ActiveWinResult): string {
    try {
      if (win.owner?.path) {
        // "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" → "chrome.exe"
        const parts = win.owner.path.replace(/\\/g, "/").split("/");
        return parts[parts.length - 1] ?? win.owner.name ?? "unknown";
      }
      return win.owner?.name ?? "unknown";
    } catch {
      return "unknown";
    }
  }
}
