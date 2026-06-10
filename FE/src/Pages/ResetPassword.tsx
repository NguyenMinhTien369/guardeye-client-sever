import { useState, useMemo, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiShield, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import type { ApiError } from "../types/auth.types";

type PasswordStrength = "weak" | "medium" | "strong" | "";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "";
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (hasMinLength && hasUppercase && hasDigit && hasSpecialChar) return "strong";
  if (hasMinLength && hasUppercase && hasDigit) return "medium";
  if (hasMinLength) return "weak";
  return "";
}

function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "Yếu";
    case "medium":
      return "Trung bình";
    case "strong":
      return "Mạnh";
    default:
      return "";
  }
}

function getActiveSegments(strength: PasswordStrength): number {
  switch (strength) {
    case "weak":
      return 1;
    case "medium":
      return 2;
    case "strong":
      return 4;
    default:
      return 0;
  }
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { resetPassword } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!newPassword) {
      errors.newPassword = "Vui lòng nhập mật khẩu mới";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Mật khẩu phải có ít nhất 8 ký tự";
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = "Mật khẩu phải chứa ít nhất 1 chữ hoa";
    } else if (!/\d/.test(newPassword)) {
      errors.newPassword = "Mật khẩu phải chứa ít nhất 1 chữ số";
    } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      errors.newPassword = "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt";
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = "Vui lòng xác nhận mật khẩu";
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = "Mật khẩu xác nhận không khớp";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!validate() || !token) return;

    setIsSubmitting(true);
    try {
      const message = await resetPassword({ token, newPassword, confirmNewPassword });
      setSuccessMessage(message);
      setNewPassword("");
      setConfirmNewPassword("");
      setFieldErrors({});
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const apiError = err.response?.data as ApiError | undefined;
        if (apiError?.errors) {
          setFieldErrors(apiError.errors);
        } else {
          setError(apiError?.message || "Đã xảy ra lỗi, vui lòng thử lại");
        }
      } else {
        setError("Đã xảy ra lỗi, vui lòng thử lại");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // No token in URL — show error state
  if (!token) {
    return (
      <>
        <div className="auth-form-header">
          <div className="mobile-logo">
            <FiShield />
          </div>
          <h1>Đặt lại mật khẩu</h1>
          <p>Liên kết không hợp lệ hoặc đã hết hạn.</p>
        </div>

        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>
            Không tìm thấy token đặt lại mật khẩu. Vui lòng yêu cầu liên kết
            đặt lại mật khẩu mới.
          </span>
        </div>

        <div className="form-footer">
          <Link to="/forgot-password">Yêu cầu đặt lại mật khẩu</Link>
        </div>

        <div className="form-footer">
          <Link to="/login">← Quay lại đăng nhập</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth-form-header">
        <div className="mobile-logo">
          <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1>Đặt lại mật khẩu</h1>
        <p>Nhập mật khẩu mới cho tài khoản của bạn</p>
      </div>

      {successMessage && (
        <div className="alert alert-success">
          <FiCheckCircle className="alert-icon" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {successMessage ? (
        <div className="form-footer">
          <Link to="/login">← Quay lại đăng nhập</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* New Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">
              Mật khẩu mới
            </label>
            <div className="input-wrapper">
              <FiLock className="input-icon" />
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                className={`form-input${fieldErrors.newPassword ? " error" : ""}`}
                placeholder="Nhập mật khẩu mới"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                  }
                }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {fieldErrors.newPassword && (
              <div className="form-error">
                <FiAlertCircle />
                {fieldErrors.newPassword}
              </div>
            )}

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="password-strength">
                <div className="strength-bar">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`strength-segment${
                        i < getActiveSegments(passwordStrength)
                          ? ` ${passwordStrength}`
                          : ""
                      }`}
                    />
                  ))}
                </div>
                {passwordStrength && (
                  <span className={`strength-text ${passwordStrength}`}>
                    {getStrengthLabel(passwordStrength)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmNewPassword">
              Xác nhận mật khẩu
            </label>
            <div className="input-wrapper">
              <FiLock className="input-icon" />
              <input
                id="confirmNewPassword"
                type={showConfirmPassword ? "text" : "password"}
                className={`form-input${fieldErrors.confirmNewPassword ? " error" : ""}`}
                placeholder="Nhập lại mật khẩu mới"
                value={confirmNewPassword}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  if (fieldErrors.confirmNewPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmNewPassword: "" }));
                  }
                }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {fieldErrors.confirmNewPassword && (
              <div className="form-error">
                <FiAlertCircle />
                {fieldErrors.confirmNewPassword}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" />
                Đang xử lý...
              </>
            ) : (
              "Đặt lại mật khẩu"
            )}
          </button>

          <div className="form-footer">
            <Link to="/login">← Quay lại đăng nhập</Link>
          </div>
        </form>
      )}
    </>
  );
}
