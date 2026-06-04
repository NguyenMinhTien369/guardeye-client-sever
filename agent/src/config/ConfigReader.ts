import * as fs from "fs";
import * as path from "path";

// ─── Kiểu dữ liệu cấu hình ────────────────────────────────────────────────────

export interface AgentConfig {
  deviceToken: string;
  serverUrl: string;
  monitoredUsers: string[];
  syncIntervalMs: number;
  mainLoopIntervalMs: number;
  pausePollIntervalMs: number;
}

// ─── Giá trị mặc định (fallback) ──────────────────────────────────────────────

const DEFAULTS: Pick<
  AgentConfig,
  "syncIntervalMs" | "mainLoopIntervalMs" | "pausePollIntervalMs"
> = {
  syncIntervalMs: 300_000,     // 5 phút
  mainLoopIntervalMs: 5_000,   // 5 giây
  pausePollIntervalMs: 30_000, // 30 giây
};

// ─── Các trường bắt buộc phải có ──────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof AgentConfig)[] = [
  "deviceToken",
  "serverUrl",
  "monitoredUsers",
];

// ─── Class ────────────────────────────────────────────────────────────────────

export class ConfigReader {
  private readonly configPath: string;
  private config: AgentConfig | null = null;

  constructor(configPath?: string) {
    // Mặc định tìm config.json cùng cấp với thư mục gốc dự án
    this.configPath = configPath ?? path.resolve(process.cwd(), "config.json");
  }

  /**
   * Đọc & validate config.json.
   * Throws ConfigError nếu file thiếu, lỗi JSON, hoặc thiếu trường bắt buộc.
   */
  public load(): AgentConfig {
    const raw = this.readFile();
    const parsed = this.parseJson(raw);
    this.validate(parsed);

    // Merge với defaults cho các trường optional
    this.config = {
      ...DEFAULTS,
      ...parsed,
    } as AgentConfig;

    return this.config;
  }

  /** Trả về config đã load (cần gọi load() trước). */
  public get(): AgentConfig {
    if (!this.config) {
      throw new ConfigError("Config chưa được load. Hãy gọi load() trước.");
    }
    return this.config;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private readFile(): string {
    if (!fs.existsSync(this.configPath)) {
      throw new ConfigError(
        `Không tìm thấy file config tại: ${this.configPath}`
      );
    }

    try {
      return fs.readFileSync(this.configPath, "utf-8");
    } catch (err) {
      throw new ConfigError(
        `Không thể đọc file config: ${(err as Error).message}`
      );
    }
  }

  private parseJson(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new ConfigError("config.json phải là một JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (err) {
      if (err instanceof ConfigError) throw err;
      throw new ConfigError(
        `config.json bị lỗi cú pháp JSON: ${(err as Error).message}`
      );
    }
  }

  private validate(parsed: Record<string, unknown>): void {
    // Kiểm tra các trường bắt buộc
    for (const field of REQUIRED_FIELDS) {
      if (parsed[field] === undefined || parsed[field] === null) {
        throw new ConfigError(`Thiếu trường bắt buộc trong config: "${field}"`);
      }
    }

    // Kiểm tra kiểu dữ liệu
    if (typeof parsed["deviceToken"] !== "string" || !parsed["deviceToken"].trim()) {
      throw new ConfigError('"deviceToken" phải là chuỗi không rỗng.');
    }

    if (typeof parsed["serverUrl"] !== "string" || !parsed["serverUrl"].startsWith("http")) {
      throw new ConfigError('"serverUrl" phải là URL hợp lệ (http/https).');
    }

    if (
      !Array.isArray(parsed["monitoredUsers"]) ||
      parsed["monitoredUsers"].length === 0 ||
      !(parsed["monitoredUsers"] as unknown[]).every((u) => typeof u === "string")
    ) {
      throw new ConfigError(
        '"monitoredUsers" phải là mảng string không rỗng.'
      );
    }
  }
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}