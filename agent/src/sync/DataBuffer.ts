import { AgentEvent } from "../types/agent.types";

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * DataBuffer — bộ đệm in-memory thread-safe (single-thread Node.js).
 *
 * Trách nhiệm:
 *  - Nhận event từ các Collector và lưu tạm vào mảng.
 *  - Cung cấp snapshot để SyncService đọc & gửi lên server.
 *  - Xóa sạch buffer sau khi sync thành công.
 *  - Giới hạn kích thước tối đa để tránh OOM khi offline lâu.
 */
export class DataBuffer {
  private buffer: AgentEvent[] = [];

  /**
   * Giới hạn số event tối đa.
   * Khi đầy, event cũ nhất sẽ bị loại bỏ (FIFO eviction).
   */
  private readonly maxSize: number;

  constructor(maxSize: number = 10_000) {
    this.maxSize = maxSize;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Thêm một event vào buffer. */
  public push(event: AgentEvent): void {
    if (this.buffer.length >= this.maxSize) {
      // Bỏ event cũ nhất để nhường chỗ cho event mới
      this.buffer.shift();
    }
    this.buffer.push(event);
  }

  /** Thêm nhiều event cùng lúc (batch). */
  public pushMany(events: AgentEvent[]): void {
    for (const event of events) {
      this.push(event);
    }
  }

  /**
   * Trả về bản sao (snapshot) của toàn bộ buffer.
   * SyncService dùng snapshot này để gửi — không sửa trực tiếp buffer gốc.
   */
  public snapshot(): AgentEvent[] {
    return [...this.buffer];
  }

  /**
   * Xóa sạch buffer sau khi sync thành công.
   * Không gọi method này khi sync thất bại.
   */
  public clear(): void {
    this.buffer = [];
  }

  /** Số lượng event hiện tại trong buffer. */
  public get size(): number {
    return this.buffer.length;
  }

  /** Kiểm tra buffer có rỗng không. */
  public get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
