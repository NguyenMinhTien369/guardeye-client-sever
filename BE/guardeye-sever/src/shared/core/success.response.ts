import { Response } from "express";

// ─── Định nghĩa shape JSON trả về khi thành công ───
interface SuccessPayload<T> {
  message: string;
  statusCode?: number;
  data?: T;
  metadata?: Record<string, unknown>; // Dùng cho phân trang: page, limit, total...
}

// ─── Class nền tảng ───
class SuccessResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  metadata?: Record<string, unknown>;

  constructor({
    message,
    statusCode = 200,
    data,
    metadata,
  }: SuccessPayload<T>) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message || "Thành công";
    this.data = data;
    this.metadata = metadata;
  }

  send(res: Response): Response {
    return res.status(this.statusCode).json(this);
  }
}

// ─── 200 OK — dùng cho GET / UPDATE / DELETE ───
export class OKResponse<T> extends SuccessResponse<T> {
  constructor(payload: SuccessPayload<T>) {
    super({ ...payload, statusCode: 200 });
  }
}

// ─── 201 Created — dùng cho POST tạo mới tài nguyên ───
export class CreatedResponse<T> extends SuccessResponse<T> {
  constructor(payload: SuccessPayload<T>) {
    super({
      message: payload.message || "Tạo mới thành công",
      statusCode: 201,
      data: payload.data,
      metadata: payload.metadata,
    });
  }
}
