// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import authRepository from "../../features/auth/auth.repository";
import { IUser } from "../../features/auth/auth.model";
import { ENV } from "../config/env";

// -----------------------------------------------------------------------------
// AUTHENTICATE MIDDLEWARE
// Xác thực JWT access token từ Authorization header.
// Nếu hợp lệ → gắn user vào req.user và cho đi tiếp.
// Nếu không hợp lệ → trả 401 ngay, không cho đi tiếp.
// -----------------------------------------------------------------------------

// Mở rộng Express Request type để thêm trường user
// Đặt ở đây thay vì global.d.ts để giữ context gần với middleware
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Payload được encode vào access token
interface AccessTokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

// Payload được encode vào refresh token
interface RefreshTokenPayload {
  userId: string;
  tokenId: string; // ID duy nhất để invalidate từng refresh token riêng lẻ
  iat: number;
  exp: number;
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

const JWT_ACCESS_SECRET = ENV.JWT_ACCESS_SECRET!;
const JWT_REFRESH_SECRET = ENV.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRES = ENV.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES = ENV.JWT_REFRESH_EXPIRES || "7d";

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets chưa được cấu hình trong environment variables");
}

/**
 * Tạo access token ngắn hạn (mặc định 15 phút).
 * Chỉ encode userId — không đưa thông tin nhạy cảm vào token.
 */
export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  } as jwt.SignOptions);
}

/**
 * Tạo refresh token dài hạn (mặc định 7 ngày).
 * tokenId là uuid/nanoid để phân biệt từng refresh token,
 * phục vụ việc revoke một thiết bị cụ thể mà không ảnh hưởng thiết bị khác.
 */
export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ userId, tokenId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  } as jwt.SignOptions);
}

/**
 * Verify access token — trả về payload hoặc throw lỗi nếu invalid/expired.
 */
function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Verify refresh token — trả về payload hoặc throw lỗi nếu invalid/expired.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/**
 * Trích xuất Bearer token từ Authorization header.
 * Format chuẩn: "Authorization: Bearer <token>"
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  return token?.trim() || null;
}

// -----------------------------------------------------------------------------
// MIDDLEWARE: authenticate
// Dùng cho các route yêu cầu đăng nhập.
// -----------------------------------------------------------------------------

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Lấy token từ header
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Không tìm thấy token xác thực",
      });
      return;
    }

    // 2. Verify chữ ký và thời hạn token
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      // Phân biệt token hết hạn vs token giả mạo để client xử lý đúng
      const isExpired = err instanceof jwt.TokenExpiredError;
      res.status(401).json({
        success: false,
        message: isExpired ? "Token đã hết hạn" : "Token không hợp lệ",
        // Báo cho client biết cần dùng refresh token để lấy access token mới
        code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      });
      return;
    }

    // 3. Lấy thông tin user từ DB để đảm bảo user vẫn còn active
    // Không chỉ tin vào payload trong token vì user có thể đã bị deactivate
    // sau khi token được cấp nhưng chưa hết hạn
    const user = await authRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa",
        code: "USER_INACTIVE",
      });
      return;
    }

    // 4. Gắn user vào request để các handler phía sau dùng
    req.user = user;
    next();
  } catch (error) {
    // Lỗi bất ngờ (DB timeout, v.v.) — không leak chi tiết ra client
    console.error("[Authenticate] Lỗi không xác định:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xác thực. Vui lòng thử lại sau.",
    });
  }
}

// -----------------------------------------------------------------------------
// MIDDLEWARE: optionalAuthenticate
// Dùng cho các route không bắt buộc đăng nhập nhưng muốn biết user là ai
// nếu họ có gửi token (VD: trang public nhưng có nội dung cá nhân hoá).
// -----------------------------------------------------------------------------

export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);

  // Không có token → bỏ qua, tiếp tục như anonymous user
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await authRepository.findById(payload.userId);
    if (user?.isActive) req.user = user;
  } catch {
    // Token lỗi → bỏ qua hoàn toàn, không chặn request
  }

  next();
}

// -----------------------------------------------------------------------------
// MIDDLEWARE: requireEmailVerified
// Dùng kết hợp SAU authenticate cho các route yêu cầu email đã xác thực.
// VD: router.post("/post", authenticate, requireEmailVerified, postController.create)
// -----------------------------------------------------------------------------

export function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Middleware này luôn chạy sau authenticate nên req.user chắc chắn có
  if (!req.user?.emailVerified) {
    res.status(403).json({
      success: false,
      message: "Vui lòng xác thực email trước khi thực hiện thao tác này",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }
  next();
}
