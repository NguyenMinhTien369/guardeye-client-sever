import { AgentConfig, AgentEvent, SyncPayload, SyncResponse } from "../types/agent.types";
import { DataBuffer } from "./DataBuffer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncServiceOptions {
  config: AgentConfig;
  buffer: DataBuffer;
  fetchFn?: typeof fetch;
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * SyncService — định kỳ gửi toàn bộ DataBuffer lên server.
 *
 * Nguyên tắc thiết kế:
 *  - Dùng snapshot pattern: chụp buffer → gửi → chỉ clear nếu HTTP 200.
 *  - Không bao giờ clear buffer khi gửi thất bại → tự động retry lần sau.
 *  - Không throw ra ngoài → agent không bao giờ crash vì sync.
 *  - Ghi log tối thiểu: chỉ log khi có thay đổi trạng thái đáng chú ý.
 */
export class SyncService {
  private readonly config: AgentConfig;
  private readonly buffer: DataBuffer;
  private readonly fetchFn: typeof fetch;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** Thống kê runtime — hữu ích để debug qua log. */
  private stats = {
    totalSynced: 0,
    successCount: 0,
    failureCount: 0,
    lastSyncAt: null as Date | null,
    lastFailureReason: null as string | null,
  };

  constructor(options: SyncServiceOptions) {
    this.config = options.config;
    this.buffer = options.buffer;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Khởi động vòng lặp sync định kỳ.
   * Không sync ngay lập tức lúc start — chờ đủ interval lần đầu
   * để buffer có thời gian tích lũy data.
   */
  public start(): void {
    if (this.intervalHandle !== null) {
      console.warn("[SyncService] Đã start rồi, bỏ qua.");
      return;
    }

    this.intervalHandle = setInterval(async () => {
      await this.syncOnce();
    }, this.config.syncIntervalMs);

    console.log(
      `[SyncService] Đã khởi động, sync mỗi ${this.config.syncIntervalMs / 1000}s.`,
    );
  }

  /** Dừng vòng lặp — gọi khi agent shutdown. */
  public stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("[SyncService] Đã dừng.");
    }
  }

  /**
   * Buộc sync ngay lập tức (dùng khi shutdown để không mất data).
   * Có thể gọi thủ công từ bên ngoài.
   */
  public async flushNow(): Promise<void> {
    console.log("[SyncService] Flush thủ công...");
    await this.syncOnce();
  }

  /** Trả về bản sao stats hiện tại (immutable). */
  public getStats(): Readonly<typeof this.stats> {
    return { ...this.stats };
  }

  // ─── Core sync logic ─────────────────────────────────────────────────────────

  /**
   * Thực hiện một lần sync:
   *  1. Kiểm tra buffer có data không.
   *  2. Chụp snapshot.
   *  3. Gửi lên server.
   *  4. Nếu 200 OK → clear buffer + cập nhật stats.
   *  5. Nếu lỗi → giữ buffer, log và chờ lần sau.
   */
  private async syncOnce(): Promise<void> {
    // Không làm gì nếu buffer rỗng
    if (this.buffer.isEmpty) {
      return;
    }

    // Chụp snapshot để gửi — không sửa buffer gốc
    const snapshot = this.buffer.snapshot();
    const payload = this.buildPayload(snapshot);

    try {
      const response = await this.sendWithTimeout(payload, 15_000);
      await this.handleResponse(response, snapshot.length);
    } catch (err) {
      this.handleSyncFailure(err as Error);
    }
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────────

  private buildPayload(events: AgentEvent[]): SyncPayload {
    return {
      deviceToken: this.config.deviceToken,
      events,
      sentAt: new Date().toISOString(),
      eventCount: events.length,
    };
  }

  private buildSyncUrl(): string {
    return `${this.config.serverUrl.replace(/\/$/, "")}/api/agent/sync`;
  }

  /**
   * Gửi POST với timeout.
   * AbortController dùng để cancel fetch khi quá timeout.
   */
  private async sendWithTimeout(
    payload: SyncPayload,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(this.buildSyncUrl(), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": this.config.deviceToken,
        },
        body: JSON.stringify(payload),
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Xử lý response từ server:
   *  - 200: clear buffer, cập nhật stats.
   *  - 4xx: lỗi logic (token sai, schema lỗi) → log chi tiết, KHÔNG retry vô hạn.
   *  - 5xx: lỗi server tạm thời → giữ buffer, retry lần sau.
   */
  private async handleResponse(
    response: Response,
    eventCount: number,
  ): Promise<void> {
    if (response.ok) {
      // Thành công — safe to clear buffer
      const body = await this.parseResponseBody(response);
      this.buffer.clear();

      this.stats.totalSynced += eventCount;
      this.stats.successCount++;
      this.stats.lastSyncAt = new Date();
      this.stats.lastFailureReason = null;

      console.log(
        `[SyncService] ✓ Sync thành công: ${eventCount} events` +
          (body?.savedCount !== undefined
            ? ` (server saved: ${body.savedCount})`
            : ""),
      );
      return;
    }

    // HTTP lỗi — KHÔNG clear buffer
    const errorText = await response.text().catch(() => "(no body)");

    if (response.status >= 400 && response.status < 500) {
      // 4xx: lỗi từ phía client (token hết hạn, payload sai...)
      // Vẫn giữ buffer nhưng log rõ để admin biết cần can thiệp
      const reason = `HTTP ${response.status} (client error): ${errorText.slice(0, 200)}`;
      this.recordFailure(reason);
      console.error(
        `[SyncService] ✗ Lỗi client — cần kiểm tra cấu hình: ${reason}`,
      );
    } else {
      // 5xx: lỗi server tạm thời → retry tự động lần sau
      const reason = `HTTP ${response.status} (server error): ${errorText.slice(0, 200)}`;
      this.recordFailure(reason);
      console.warn(`[SyncService] ✗ Lỗi server, sẽ retry: ${reason}`);
    }
  }

  private async parseResponseBody(
    response: Response,
  ): Promise<SyncResponse | null> {
    try {
      return (await response.json()) as SyncResponse;
    } catch {
      return null;
    }
  }

  private handleSyncFailure(err: Error): void {
    const isTimeout = err.name === "AbortError";
    const reason = isTimeout
      ? "Request timeout (>15s)"
      : `Network error: ${err.message}`;

    this.recordFailure(reason);
    console.warn(
      `[SyncService] ✗ ${reason} — buffer giữ nguyên (${this.buffer.size} events).`,
    );
  }

  private recordFailure(reason: string): void {
    this.stats.failureCount++;
    this.stats.lastFailureReason = reason;
  }
}
