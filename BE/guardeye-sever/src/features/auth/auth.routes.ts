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
