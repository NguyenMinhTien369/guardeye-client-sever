## Những việc còn lại

> Đóng vai Senior Back-end Developer chuyên Node.js, Express, MongoDB, TypeScript.
>
> Tôi đang xây dựng Auth Module. Dưới đây là toàn bộ code hiện tại của các file liên quan. Nhiệm vụ của bạn là hoàn thành **4 công việc còn thiếu** theo đúng thứ tự, giữ nguyên các pattern nhất quán đã có trong codebase.
>
> ---
>
> **Các file hiện tại:** _(paste nội dung các file sau)_
>
> - `auth.dto.ts` \*// src/dtos/auth.dto.ts

// -----------------------------------------------------------------------------
// AUTH DTO - Định nghĩa cấu trúc dữ liệu cho các luồng xác thực
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

export interface RegisterRequestDto {
name: string;
email: string;
password: string;
confirmPassword: string;
notificationEmail?: string;
}

export interface LoginRequestDto {
email: string;
password: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// Thông tin User an toàn để trả về client — không chứa password hay token nhạy cảm
export interface UserResponseDto {
id: string;
name: string;
email: string;
notificationEmail: string | null;
notifications: {
email: boolean;
browser: boolean;
};
isActive: boolean;
emailVerified: boolean;
lastLoginAt: Date | null;
createdAt: Date;
updatedAt: Date;
}

export interface RegisterResponseDto {
user: UserResponseDto;
message: string;
}

export interface LoginResponseDto {
user: UserResponseDto;
accessToken: string;
refreshToken: string;
}

- > - `auth.validation.ts` \_(// src/modules/auth/auth.validation.ts

import { z } from "zod";

// -----------------------------------------------------------------------------
// AUTH VALIDATION - Dùng Zod để định nghĩa schema và validate request body
// Tách riêng khỏi DTO để DTO chỉ lo về type, file này lo về runtime validation
// -----------------------------------------------------------------------------

// Regex kiểm tra độ phức tạp mật khẩu: ít nhất 1 chữ hoa, 1 số, 1 ký tự đặc biệt
const PASSWORD*STRENGTH_REGEX = /^(?=.*[A-Z])(?=._\d)(?=._[!@#$%^&_])/;

// -----------------------------------------------------------------------------
// 1. SCHEMAS
// -----------------------------------------------------------------------------

export const registerSchema = z
.object({
name: z
.string({ required_error: "Tên là bắt buộc" })
.trim()
.min(2, "Tên phải có ít nhất 2 ký tự")
.max(50, "Tên không được vượt quá 50 ký tự"),

    email: z
      .string({ required_error: "Email là bắt buộc" })
      .trim()
      .toLowerCase()
      .email("Định dạng email không hợp lệ"),

    password: z
      .string({ required_error: "Mật khẩu là bắt buộc" })
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(
        PASSWORD_STRENGTH_REGEX,
        "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt (!@#$%^&*)",
      ),

    confirmPassword: z.string({
      required_error: "Vui lòng xác nhận mật khẩu",
    }),

    notificationEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Định dạng email thông báo không hợp lệ")
      .optional(),

})
// Kiểm tra password === confirmPassword ở refine để có thể gán lỗi đúng field
.refine((data) => data.password === data.confirmPassword, {
message: "Mật khẩu xác nhận không khớp",
path: ["confirmPassword"],
});

export const loginSchema = z.object({
email: z
.string({ required_error: "Email là bắt buộc" })
.trim()
.toLowerCase()
.email("Định dạng email không hợp lệ"),

password: z.string({ required_error: "Mật khẩu là bắt buộc" }),
});

export const forgotPasswordSchema = z.object({
email: z
.string({ required_error: "Email là bắt buộc" })
.trim()
.toLowerCase()
.email("Định dạng email không hợp lệ"),
});

export const resetPasswordSchema = z
.object({
token: z.string({ required_error: "Token là bắt buộc" }).min(1),

    newPassword: z
      .string({ required_error: "Mật khẩu mới là bắt buộc" })
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(
        PASSWORD_STRENGTH_REGEX,
        "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt (!@#$%^&*)",
      ),

    confirmNewPassword: z.string({
      required_error: "Vui lòng xác nhận mật khẩu mới",
    }),

})
.refine((data) => data.newPassword === data.confirmNewPassword, {
message: "Mật khẩu xác nhận không khớp",
path: ["confirmNewPassword"],
});

export const verifyEmailSchema = z.object({
token: z.string({ required_error: "Token là bắt buộc" }).min(1),
});

// -----------------------------------------------------------------------------
// 2. INFER TYPES TỪ SCHEMA
// Dùng z.infer để tự động đồng bộ type với schema, không cần khai báo lại tay
// -----------------------------------------------------------------------------

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// -----------------------------------------------------------------------------
// 3. MIDDLEWARE FACTORY
// Tạo middleware validate request body theo schema được truyền vào.
// Dùng factory pattern để tái sử dụng cho mọi schema mà không lặp code.
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/\*\*

- Parse lỗi Zod thành object { field: message } phẳng và dễ đọc cho client.
  \*/
  function formatZodErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce(
  (acc, err) => {
  // err.path là mảng, lấy phần tử cuối làm key (tên field)
  const field = err.path.join(".");
  // Chỉ lấy lỗi đầu tiên của mỗi field, tránh spam nhiều lỗi cùng lúc
  if (!acc[field]) acc[field] = err.message;
  return acc;
  },
  {} as Record<string, string>,
  );
  }

export function validate(schema: ZodSchema) {
return (req: Request, res: Response, next: NextFunction): void => {
const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: formatZodErrors(result.error),
      });
      return;
    }

    // Ghi đè req.body bằng data đã được Zod parse và transform
    // (trim, toLowerCase, coerce đã được áp dụng)
    req.body = result.data;
    next();

};
}
)\_

> - `auth.controller.ts` \_(// src/modules/auth/auth.controller.ts

import { Request, Response } from "express";
import authService from "./auth.service";
import { RegisterRequestDto, LoginRequestDto } from "./auth.dto";

// -----------------------------------------------------------------------------
// AUTH CONTROLLER
// Chỉ xử lý tầng HTTP: nhận request, gọi Service, trả response.
// Không chứa business logic — đó là việc của Service.
// -----------------------------------------------------------------------------

// Helper chuẩn hoá response thành công
const sendSuccess = (
res: Response,
data: unknown,
statusCode = 200,
): Response => {
return res.status(statusCode).json({ success: true, data });
};

// Helper chuẩn hoá response lỗi
const sendError = (
res: Response,
message: string,
statusCode = 400,
): Response => {
return res.status(statusCode).json({ success: false, message });
};

// -----------------------------------------------------------------------------
// CONTROLLER METHODS
// -----------------------------------------------------------------------------

/\*\*

- POST /auth/register
  \*/
  export const register = async (
  req: Request<{}, {}, RegisterRequestDto>,
  res: Response,
  ): Promise<void> => {
  try {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
  } catch (error) {
  const message = error instanceof Error ? error.message : "Đăng ký thất bại";

      // Email trùng là lỗi client (400), không phải server error (500)
      const statusCode = message.includes("đã được sử dụng") ? 409 : 400;
      sendError(res, message, statusCode);

  }
  };

/\*\*

- POST /auth/login
  \*/
  export const login = async (
  req: Request<{}, {}, LoginRequestDto>,
  res: Response,
  ): Promise<void> => {
  try {
  const result = await authService.login(req.body);
  sendSuccess(res, result);
  } catch (error) {
  const message =
  error instanceof Error ? error.message : "Đăng nhập thất bại";

      // Sai credentials → 401, tài khoản bị khoá → 403
      const statusCode = message.includes("vô hiệu hóa") ? 403 : 401;
      sendError(res, message, statusCode);

  }
  };

/\*\*

- POST /auth/verify-email
  \*/
  export const verifyEmail = async (
  req: Request,
  res: Response,
  ): Promise<void> => {
  try {
  // Token lấy từ query string: /auth/verify-email?token=xxx
  const { token } = req.body;
  await authService.verifyEmail(token);
  sendSuccess(res, { message: "Xác thực email thành công" });
  } catch (error) {
  const message =
  error instanceof Error ? error.message : "Xác thực email thất bại";
  sendError(res, message, 400);
  }
  };

/\*\*

- POST /auth/forgot-password
  \*/
  export const forgotPassword = async (
  req: Request,
  res: Response,
  ): Promise<void> => {
  try {
  await authService.forgotPassword(req.body.email);

      // Luôn trả về response giống nhau dù email có tồn tại hay không
      // để tránh email enumeration attack (đã xử lý ở Service layer)
      sendSuccess(res, {
        message:
          "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
      });

  } catch (error) {
  sendError(res, "Có lỗi xảy ra. Vui lòng thử lại sau.", 500);
  }
  };

/\*\*

- POST /auth/reset-password
  \*/
  export const resetPassword = async (
  req: Request,
  res: Response,
  ): Promise<void> => {
  try {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  sendSuccess(res, { message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
  const message =
  error instanceof Error ? error.message : "Đặt lại mật khẩu thất bại";
  sendError(res, message, 400);
  }
  };
  )\_
  > - `auth.routes.ts` \_(// src/modules/auth/auth.routes.ts

import { Router } from "express";
import \* as authController from "./auth.controller";
import { validate } from "./auth.validation";
import {
registerSchema,
loginSchema,
forgotPasswordSchema,
resetPasswordSchema,
verifyEmailSchema,
} from "./auth.validation";

// -----------------------------------------------------------------------------
// AUTH ROUTES
// Chỉ khai báo route và gắn middleware — không chứa logic nào khác.
// Thứ tự middleware trong mỗi route: validate → controller
// -----------------------------------------------------------------------------

const router = Router();

// POST /auth/register
router.post("/register", validate(registerSchema), authController.register);

// POST /auth/login
router.post("/login", validate(loginSchema), authController.login);

// POST /auth/verify-email
// Token được gửi kèm trong body (có thể đổi sang query param tuỳ thiết kế)
router.post(
"/verify-email",
validate(verifyEmailSchema),
authController.verifyEmail,
);

// POST /auth/forgot-password
router.post(
"/forgot-password",
validate(forgotPasswordSchema),
authController.forgotPassword,
);

// POST /auth/reset-password
router.post(
"/reset-password",
validate(resetPasswordSchema),
authController.resetPassword,
);

export default router;
)\_

> - `auth.service.ts` \_("// src/modules/auth/auth.service.ts

import crypto from "crypto";
import authRepository from "./auth.repository";
import jwtService from "../../shared/utils/jwt.util";
import {
RegisterRequestDto,
LoginRequestDto,
UserResponseDto,
RegisterResponseDto,
LoginResponseDto,
} from "./auth.dto";
import { IUser } from "./auth.model";

// -----------------------------------------------------------------------------
// AUTH SERVICE
// Chứa toàn bộ business logic của luồng xác thực.
// Không tương tác trực tiếp với DB — đó là việc của Repository.
// Không xử lý HTTP request/response — đó là việc của Controller.
// -----------------------------------------------------------------------------

const PASSWORD*RESET_EXPIRES_MS = 15 * 60 \_ 1000;

class AuthService {
// ---------------------------------------------------------------------------
// PRIVATE HELPERS
// ---------------------------------------------------------------------------

/\*\*

- Map IUser document sang UserResponseDto thuần túy.
- Tập trung logic transform ở một chỗ, tránh lặp code ở nhiều nơi.
  \*/
  private toUserResponse(user: IUser): UserResponseDto {
  return {
  id: user.\_id.toString(),
  name: user.name,
  email: user.email,
  notificationEmail: user.notificationEmail,
  notifications: user.notifications,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  };
  }

/\*\*

- Tạo token ngẫu nhiên dạng hex dùng cho email verify và reset password.
- crypto.randomBytes là cryptographically secure — an toàn hơn Math.random().
  \*/
  private generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
  }

// ---------------------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------------------

async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
// 1. Kiểm tra email đã tồn tại chưa
const existingUser = await authRepository.findByEmail(dto.email);
if (existingUser) {
throw new Error("Email này đã được sử dụng");
}

    // 2. Tách confirmPassword ra — không lưu vào DB
    const { confirmPassword, ...userData } = dto;

    // 3. Tạo user mới (password sẽ được hash bởi pre-save hook trong Model)
    const newUser = await authRepository.createUser(userData);

    // 4. Tạo và lưu email verify token
    const verifyToken = this.generateSecureToken();
    await authRepository.setEmailVerifyToken(
      newUser._id.toString(),
      verifyToken,
    );

    // 5. TODO: Gửi email xác thực kèm verifyToken
    // await emailService.sendVerificationEmail(newUser.email, verifyToken);

    return {
      user: this.toUserResponse(newUser),
      message:
        "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.",
    };

}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
// 1. Tìm user kèm password (select: false nên phải dùng method riêng)
const user = await authRepository.findByEmailWithPassword(dto.email);

    // 2. Trả về cùng một thông báo lỗi dù sai email hay sai password
    //    để tránh attacker dò được email nào đã tồn tại trong hệ thống
    const INVALID_CREDENTIALS_MSG = "Email hoặc mật khẩu không chính xác";

    if (!user) {
      throw new Error(INVALID_CREDENTIALS_MSG);
    }

    // 3. Kiểm tra tài khoản có đang hoạt động không
    if (!user.isActive) {
      throw new Error("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.");
    }

    // 4. So sánh mật khẩu qua instance method của Model
    const isPasswordValid = await user.comparePassword(dto.password);
    if (!isPasswordValid) {
      throw new Error(INVALID_CREDENTIALS_MSG);
    }

    // 5. Cập nhật lastLoginAt bất đồng bộ — không cần await vì không ảnh hưởng response
    authRepository.updateLastLogin(user._id.toString()).catch((err) => {
      console.error("[AuthService] Không thể cập nhật lastLoginAt:", err);
    });

    // 6. Cấp cặp token: access token (15 phút) + refresh token (7 ngày)
    //    issueTokenPair đồng thời lưu tokenId vào DB, vô hiệu hóa session cũ nếu có
    const { accessToken, refreshToken } = await jwtService.issueTokenPair(
      user._id.toString(),
    );

    return {
      user: this.toUserResponse(user),
      accessToken,
      refreshToken,
    };

}

// ---------------------------------------------------------------------------
// REFRESH TOKEN
// ---------------------------------------------------------------------------

/\*\*

- Cấp lại cặp token mới từ refresh token còn hiệu lực.
- Áp dụng token rotation — mỗi lần refresh là một cặp token hoàn toàn mới.
-
- @throws Error nếu refresh token hết hạn, không hợp lệ, hoặc đã bị revoke
  \*/
  async refreshTokens(
  refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
  // Toàn bộ logic verify + rotation nằm trong jwtService
  return jwtService.refreshTokens(refreshToken);
  }

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

/\*\*

- Đăng xuất: thu hồi refresh token của user.
- Access token vẫn còn hiệu lực đến khi hết hạn tự nhiên (15 phút).
- Client có trách nhiệm xóa cả hai token phía local storage / cookie.
  \*/
  async logout(userId: string): Promise<void> {
  await jwtService.revokeRefreshToken(userId);
  }

// ---------------------------------------------------------------------------
// EMAIL VERIFICATION
// ---------------------------------------------------------------------------

async verifyEmail(token: string): Promise<void> {
const user = await authRepository.findByEmailVerifyToken(token);

    if (!user) {
      throw new Error("Token xác thực không hợp lệ hoặc đã hết hạn");
    }

    if (user.emailVerified) {
      throw new Error("Email này đã được xác thực trước đó");
    }

    await authRepository.verifyEmail(user._id.toString());

}

// ---------------------------------------------------------------------------
// FORGOT PASSWORD
// ---------------------------------------------------------------------------

async forgotPassword(email: string): Promise<void> {
const user = await authRepository.findByEmail(email);

    // Không throw lỗi khi không tìm thấy email — tránh email enumeration attack.
    // Client luôn nhận được response thành công giống nhau.
    if (!user) return;

    const resetToken = this.generateSecureToken();
    const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);

    await authRepository.setPasswordResetToken(
      user._id.toString(),
      resetToken,
      expires,
    );

    // TODO: Gửi email reset password kèm resetToken
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

}

// ---------------------------------------------------------------------------
// RESET PASSWORD
// ---------------------------------------------------------------------------

async resetPassword(token: string, newPassword: string): Promise<void> {
const user = await authRepository.findByPasswordResetToken(token);

    if (!user) {
      throw new Error("Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }

    // Repository.resetPassword dùng findById + save để trigger pre-save hook hash password
    await authRepository.resetPassword(user._id.toString(), newPassword);

}
}

export default new AuthService();
" — đã có `login`, `refreshTokens`, `logout`)\_

> - `authenticate.ts` \_(// src/middleware/authenticate.ts

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

/\*\*

- Tạo access token ngắn hạn (mặc định 15 phút).
- Chỉ encode userId — không đưa thông tin nhạy cảm vào token.
  \*/
  export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, {
  expiresIn: ACCESS_TOKEN_EXPIRES,
  } as jwt.SignOptions);
  }

/\*\*

- Tạo refresh token dài hạn (mặc định 7 ngày).
- tokenId là uuid/nanoid để phân biệt từng refresh token,
- phục vụ việc revoke một thiết bị cụ thể mà không ảnh hưởng thiết bị khác.
  \*/
  export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ userId, tokenId }, JWT_REFRESH_SECRET, {
  expiresIn: REFRESH_TOKEN_EXPIRES,
  } as jwt.SignOptions);
  }

/\*\*

- Verify access token — trả về payload hoặc throw lỗi nếu invalid/expired.
  \*/
  function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
  }

/\*\*

- Verify refresh token — trả về payload hoặc throw lỗi nếu invalid/expired.
  \*/
  export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  }

/\*\*

- Trích xuất Bearer token từ Authorization header.
- Format chuẩn: "Authorization: Bearer <token>"
  \*/
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
code: "EMAIL*NOT_VERIFIED",
});
return;
}
next();
}
)*

> ---
>
> **Công việc cần làm theo thứ tự:**
>
> **1. `auth.dto.ts`**
> Thêm `refreshToken: string` vào `LoginResponseDto`. Giữ nguyên toàn bộ các interface khác.
>
> **2. `auth.validation.ts`**
> Thêm `refreshTokenSchema` validate body `{ refreshToken: string }` — không được rỗng, phải là string. Export thêm inferred type `RefreshTokenInput`. Giữ nguyên các schema cũ.
>
> **3. `auth.controller.ts`**
> Thêm 2 method vào class/object controller hiện tại:
>
> - `refreshToken` — gọi `authService.refreshTokens(dto.refreshToken)`, trả `200` kèm `{ accessToken, refreshToken }`, map lỗi JWT expired/invalid sang `401`
> - `logout` — gọi `authService.logout(req.user._id)`, trả `200` kèm message thành công. Route này sẽ có `authenticate` middleware nên `req.user` chắc chắn tồn tại.
>
> Giữ nguyên pattern `sendSuccess` / `sendError` đang dùng trong controller hiện tại.
>
> **4. `auth.routes.ts`**
> Thêm 2 route mới, giữ đúng thứ tự `validate → controller` như các route hiện tại:
>
> ```
> POST /refresh-token  →  validate(refreshTokenSchema)  →  controller.refreshToken
> POST /logout         →  authenticate  →  controller.logout
> ```
>
> ---
>
> **Yêu cầu chung:**
>
> - Code sạch, dễ đọc, comment ngắn gọn bằng tiếng Việt cho logic quan trọng
> - Không thay đổi logic của các method/route đã có
> - Trả về đủ 4 file hoàn chỉnh (không phải chỉ phần thêm vào)
