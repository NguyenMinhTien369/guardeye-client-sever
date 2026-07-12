import { AgentConfig, PauseStatusResponse } from "../types/agent.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PauseControllerOptions {
  config: AgentConfig;
  /** Inject fetch function — dễ mock trong test (mặc định: global fetch). */
  fetchFn?: typeof fetch;
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * PauseController — poll API mỗi 30s để lấy trạng thái tạm dừng.
 *
 * Thiết kế:
 *  - Trạng thái được cache in-memory → main loop (5s) đọc cache,
 *    không gọi HTTP mỗi 5s (tránh spam API).
 *  - Fail-safe: nếu API lỗi → giữ nguyên trạng thái cũ (không tự động
 *    resume hay pause khi mất mạng).
 *  - start() / stop() để lifecycle rõ ràng, dễ quản lý từ index.ts.
 */
export class PauseController {
  private readonly config: AgentConfig;
  private readonly fetchFn: typeof fetch;

  /** Trạng thái hiện tại được cache. Mặc định: không tạm dừng. */
  private isPaused: boolean = false;

  /**
   * Thời điểm auto-resume được cache từ server.
   * null = pause vô thời hạn (chỉ resume khi phụ huynh bấm thủ công).
   */
  private pausedUntil: Date | null = null;

  /** Đã log auto-resume chưa — tránh spam log mỗi 5s khi main loop gọi getIsPaused(). */
  private hasLoggedAutoResume: boolean = false;

  /** Thời điểm poll thành công cuối cùng. */
  private lastSuccessfulPoll: Date | null = null;

  /** Số lần poll thất bại liên tiếp — dùng để cảnh báo khi offline lâu. */
  private consecutiveFailures: number = 0;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** Ngưỡng cảnh báo khi offline liên tiếp nhiều lần. */
  private static readonly FAILURE_WARN_THRESHOLD = 5;

  constructor(options: PauseControllerOptions) {
    this.config = options.config;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Khởi động vòng lặp poll.
   * - Poll ngay lập tức lần đầu (không chờ đủ 30s).
   * - Sau đó lặp theo pausePollIntervalMs từ config.
   */
  public async start(): Promise<void> {
    if (this.intervalHandle !== null) {
      console.warn("[PauseController] Đã start rồi, bỏ qua.");
      return;
    }

    // Poll ngay lần đầu để có trạng thái trước khi main loop bắt đầu
    await this.poll();

    this.intervalHandle = setInterval(async () => {
      await this.poll();
    }, this.config.pausePollIntervalMs);

    console.log(
      `[PauseController] Đã khởi động, poll mỗi ${this.config.pausePollIntervalMs / 1000}s.`,
    );
  }

  /**
   * Dừng vòng lặp poll — gọi khi agent shutdown.
   */
  public stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("[PauseController] Đã dừng poll.");
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Main loop gọi method này mỗi 5s — đọc cache, không block.
   * Trả về true nếu agent đang bị tạm dừng.
   */
  public getIsPaused(): boolean {
    // Auto-resume client-side: server bảo pause nhưng pausedUntil đã qua → bỏ qua
    if (this.isPaused && this.pausedUntil !== null) {
      if (new Date() >= this.pausedUntil) {
        if (!this.hasLoggedAutoResume) {
          this.hasLoggedAutoResume = true;
          console.log(
            "[PauseController] Hết hạn pause — tự động resume ▶" +
            " (isPaused server-side vẫn = true, sẽ đồng bộ ở poll tiếp theo).",
          );
        }
        return false;
      }
    }
    // Reset flag khi server xác nhận đã resume (hoặc đang running bình thường)
    if (!this.isPaused) {
      this.hasLoggedAutoResume = false;
    }
    return this.isPaused;
  }

  /** Thông tin debug — thời điểm poll thành công gần nhất. */
  public getLastSuccessfulPoll(): Date | null {
    return this.lastSuccessfulPoll;
  }

  /** Số lần poll thất bại liên tiếp — dùng để health check. */
  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  // ─── Private: Core poll logic ────────────────────────────────────────────────

  /**
   * Gọi API lấy trạng thái pause.
   *
   * Không throw ra ngoài — mọi lỗi đều được xử lý nội bộ để
   * đảm bảo agent không bao giờ crash vì mạng.
   */
  private async poll(): Promise<void> {
    const url = this.buildStatusUrl();

    try {
      const response = await this.fetchWithTimeout(url, 8_000);

      if (!response.ok) {
        this.handlePollFailure(
          new Error(`HTTP ${response.status} ${response.statusText}`),
        );
        return;
      }

      const data = await this.parseResponse(response);
      this.applyStatus(data);
    } catch (err) {
      this.handlePollFailure(err as Error);
    }
  }

  // ─── Private: Helpers ────────────────────────────────────────────────────────

  private buildStatusUrl(): string {
    // Xóa trailing slash để tránh double-slash
    const base = this.config.serverUrl.replace(/\/$/, "");
    return `${base}/api/v1/agent/status?deviceToken=${encodeURIComponent(
      this.config.deviceToken,
    )}`;
  }

  /**
   * Wrapper fetch với timeout thủ công.
   * Node.js fetch không có timeout built-in trước v18.
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Device-Token": this.config.deviceToken,
        },
      });
      return response;
    } finally {
      // Luôn clear timer dù thành công hay thất bại
      clearTimeout(timer);
    }
  }

  /**
   * Parse JSON response, throw nếu schema không hợp lệ.
   */
  private async parseResponse(
    response: Response,
  ): Promise<PauseStatusResponse> {
    let json: any;

    try {
      json = await response.json();
    } catch {
      throw new Error("Response không phải JSON hợp lệ.");
    }

    // Backend bọc response trong object 'data'
    const data = json?.data;
    
    // Validate schema tối thiểu
    if (
      typeof data !== "object" ||
      data === null ||
      typeof data.paused !== "boolean"
    ) {
      throw new Error(
        `Response schema không hợp lệ: thiếu field "paused" (boolean).`,
      );
    }

    return data as PauseStatusResponse;
  }

  /**
   * Áp dụng trạng thái mới từ server vào cache.
   */
  private applyStatus(data: PauseStatusResponse): void {
    const previousState = this.isPaused;
    this.isPaused = data.paused;
    this.pausedUntil = data.until ? new Date(data.until) : null;
    this.lastSuccessfulPoll = new Date();
    this.consecutiveFailures = 0;

    // Chỉ log khi trạng thái thay đổi — tránh spam log mỗi 30s
    if (previousState !== this.isPaused) {
      const stateLabel = this.isPaused ? "TẠM DỪNG ⏸" : "TIẾP TỤC ▶";
      const reason = data.reason ? ` (Lý do: ${data.reason})` : "";
      const until = this.pausedUntil
        ? ` [Hết hạn: ${this.pausedUntil.toISOString()}]`
        : "";
      console.log(
        `[PauseController] Trạng thái thay đổi → ${stateLabel}${reason}${until}`,
      );
    }
  }

  /**
   * Xử lý lỗi poll — giữ nguyên trạng thái cũ (fail-safe).
   */
  private handlePollFailure(err: Error): void {
    this.consecutiveFailures++;

    // Chỉ log ở lần thất bại đầu và mỗi khi đạt ngưỡng cảnh báo
    const shouldLog =
      this.consecutiveFailures === 1 ||
      this.consecutiveFailures % PauseController.FAILURE_WARN_THRESHOLD === 0;

    if (shouldLog) {
      console.warn(
        `[PauseController] Poll thất bại lần ${this.consecutiveFailures}: ` +
          `${err.message} — Giữ trạng thái cũ: ${this.isPaused ? "paused" : "running"}`,
      );
    }
  }
}
