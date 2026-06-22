import { useState, useMemo, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  FiUser,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import type { ApiError } from "../types/auth.types";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

type PasswordStrength = "none" | "weak" | "medium" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "none";

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasMinLength && hasUppercase && hasDigit && hasSpecial) return "strong";
  if (hasMinLength && hasUppercase && hasDigit) return "medium";
  if (hasMinLength) return "weak";
  return "none";
}

const strengthLabels: Record<PasswordStrength, string> = {
  none: "",
  weak: "Yếu",
  medium: "Trung bình",
  strong: "Mạnh",
};

export function Register() {
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const filledSegments = useMemo(() => {
    switch (passwordStrength) {
      case "weak":
        return 1;
      case "medium":
        return 2;
      case "strong":
        return 4;
      default:
        return 0;
    }
  }, [passwordStrength]);

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Tên không được để trống";
    } else if (name.trim().length < 2) {
      newErrors.name = "Tên phải có ít nhất 2 ký tự";
    }

    if (!email.trim()) {
      newErrors.email = "Email không được để trống";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!password) {
      newErrors.password = "Mật khẩu không được để trống";
    } else if (password.length < 8) {
      newErrors.password = "Mật khẩu phải có ít nhất 8 ký tự";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = "Mật khẩu phải chứa ít nhất 1 chữ hoa";
    } else if (!/\d/.test(password)) {
      newErrors.password = "Mật khẩu phải chứa ít nhất 1 chữ số";
    } else if (!/[^A-Za-z0-9]/.test(password)) {
      newErrors.password = "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Xác nhận mật khẩu không được để trống";
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");
    setSuccessMessage("");

    if (!validate()) return;

    setIsLoading(true);
    try {
      const message = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      setSuccessMessage(message);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiError | undefined;
        setApiError(data?.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
      } else {
        setApiError("Đã xảy ra lỗi. Vui lòng thử lại.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="auth-form-header">
        <div className="mobile-logo">
          <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1>Tạo tài khoản</h1>
        <p>Đăng ký để bắt đầu sử dụng GuardEye</p>
      </div>

      {apiError && (
        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>{apiError}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <FiCheckCircle className="alert-icon" />
          <span>
            {successMessage} <Link to="/login">Đăng nhập ngay</Link>
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Họ và tên
          </label>
          <div className="input-wrapper">
            <FiUser className="input-icon" />
            <input
              id="name"
              type="text"
              className={`form-input${errors.name ? " error" : ""}`}
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError("name");
              }}
              autoComplete="name"
            />
          </div>
          {errors.name && (
            <div className="form-error">
              <FiAlertCircle />
              <span>{errors.name}</span>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <div className="input-wrapper">
            <FiMail className="input-icon" />
            <input
              id="email"
              type="email"
              className={`form-input${errors.email ? " error" : ""}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <div className="form-error">
              <FiAlertCircle />
              <span>{errors.email}</span>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Mật khẩu
          </label>
          <div className="input-wrapper">
            <FiLock className="input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={`form-input${errors.password ? " error" : ""}`}
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
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
          {errors.password && (
            <div className="form-error">
              <FiAlertCircle />
              <span>{errors.password}</span>
            </div>
          )}

          {/* Password strength indicator */}
          {password && (
            <div className="password-strength">
              <div className="strength-bar">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`strength-segment${
                      i < filledSegments ? ` ${passwordStrength}` : ""
                    }`}
                  />
                ))}
              </div>
              {passwordStrength !== "none" && (
                <span className={`strength-text ${passwordStrength}`}>
                  {strengthLabels[passwordStrength]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Xác nhận mật khẩu
          </label>
          <div className="input-wrapper">
            <FiLock className="input-icon" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className={`form-input${errors.confirmPassword ? " error" : ""}`}
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError("confirmPassword");
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
          {errors.confirmPassword && (
            <div className="form-error">
              <FiAlertCircle />
              <span>{errors.confirmPassword}</span>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? <span className="btn-spinner" /> : "Đăng ký"}
        </button>
      </form>

      <div className="form-footer">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </div>
    </>
  );
}
