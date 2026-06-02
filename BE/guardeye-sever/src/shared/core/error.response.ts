// ─── Class nền tảng ───
export class ErrorResponse extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    // Đảm bảo instanceof hoạt động đúng khi dùng với TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── 400 Bad Request — dữ liệu gửi lên không hợp lệ ───
export class BadRequestError extends ErrorResponse {
  constructor(
    message = "Dữ liệu đầu vào không hợp lệ",
    errorCode = "BAD_REQUEST",
  ) {
    super(message, 400, errorCode);
  }
}

// ─── 401 Unauthorized — chưa đăng nhập / token không hợp lệ ───
export class AuthFailureError extends ErrorResponse {
  constructor(
    message = "Vui lòng đăng nhập để tiếp tục",
    errorCode = "UNAUTHORIZED",
  ) {
    super(message, 401, errorCode);
  }
}

// ─── 403 Forbidden — đã đăng nhập nhưng không có quyền ───
export class ForbiddenError extends ErrorResponse {
  constructor(
    message = "Bạn không có quyền thực hiện hành động này",
    errorCode = "FORBIDDEN",
  ) {
    super(message, 403, errorCode);
  }
}

// ─── 404 Not Found — không tìm thấy tài nguyên ───
export class NotFoundError extends ErrorResponse {
  constructor(message = "Không tìm thấy dữ liệu", errorCode = "NOT_FOUND") {
    super(message, 404, errorCode);
  }
}

// ─── 409 Conflict — trùng lặp dữ liệu (email đã tồn tại...) ───
export class ConflictError extends ErrorResponse {
  constructor(
    message = "Dữ liệu đã tồn tại trong hệ thống",
    errorCode = "CONFLICT",
  ) {
    super(message, 409, errorCode);
  }
}

// ─── 422 Unprocessable Entity — pass validation nhưng logic sai ───
export class UnprocessableError extends ErrorResponse {
  constructor(
    message = "Không thể xử lý yêu cầu này",
    errorCode = "UNPROCESSABLE_ENTITY",
  ) {
    super(message, 422, errorCode);
  }
}
