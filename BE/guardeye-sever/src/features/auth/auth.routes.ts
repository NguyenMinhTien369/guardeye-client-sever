// src/modules/auth/auth.routes.ts

import { Router } from "express";
import * as authController from "./auth.controller";
import { validate } from "./auth.validation";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  refreshTokenSchema,
} from "./auth.validation";
import { authenticate } from "../../shared/middlewares/auth.middleware";

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

// POST /auth/refresh-token
// Cấp lại cặp token mới từ refresh token còn hiệu lực
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken,
);

// POST /auth/logout
// Yêu cầu đăng nhập (authenticate) để biết user cần thu hồi token
router.post("/logout", authenticate, authController.logout);

export default router;

