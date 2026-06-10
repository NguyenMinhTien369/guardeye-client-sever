import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  FiMail,
  FiAlertCircle,
  FiCheckCircle,
  FiArrowLeft,
} from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import type { ApiError } from "../types/auth.types";

export function ForgotPassword() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError("Email không được để trống");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Email không hợp lệ");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");
    setSuccessMessage("");

    if (!validate()) return;

    setIsLoading(true);
    try {
      const message = await forgotPassword(email.trim());
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
        <h1>Quên mật khẩu</h1>
        <p>
          Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu
          cho bạn.
        </p>
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
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <div className="input-wrapper">
            <FiMail className="input-icon" />
            <input
              id="email"
              type="email"
              className={`form-input${emailError ? " error" : ""}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              autoComplete="email"
            />
          </div>
          {emailError && (
            <div className="form-error">
              <FiAlertCircle />
              <span>{emailError}</span>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? <span className="btn-spinner" /> : "Gửi yêu cầu"}
        </button>
      </form>

      <div className="form-footer">
        <Link to="/login">
          <FiArrowLeft /> Quay lại đăng nhập
        </Link>
      </div>
    </>
  );
}
