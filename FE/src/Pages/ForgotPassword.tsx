import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiMail, FiAlertCircle, FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

export function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [apiError, setApiError] = useState("");

  const validate = (): boolean => {
    if (!email.trim()) { setEmailError("Email không được để trống"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Email không hợp lệ"); return false; }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;

    setIsLoading(true);

    // Chuyển trang ngay, không chờ API response
    navigate("/verify-otp", { state: { email: email.trim() } });

    // Gửi OTP trong nền
    forgotPassword(email.trim()).catch(() => {
      // Lỗi sẽ được hiển thị ở trang verify-otp nếu cần
    });

    setIsLoading(false);
  };

  return (
    <>
      <div className="auth-form-header">
        <div className="mobile-logo">
          <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1>Quên mật khẩu</h1>
        <p>Nhập email đã đăng ký. Chúng tôi sẽ gửi mã OTP 6 số về hộp thư của bạn.</p>
      </div>

      {apiError && (
        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <div className="input-wrapper">
            <FiMail className="input-icon" />
            <input
              id="email"
              type="email"
              className={`form-input${emailError ? " error" : ""}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
              autoComplete="email"
              autoFocus
            />
          </div>
          {emailError && (
            <div className="form-error"><FiAlertCircle /><span>{emailError}</span></div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? <span className="btn-spinner" /> : "Gửi mã OTP"}
        </button>
      </form>

      <div className="form-footer">
        <Link to="/login"><FiArrowLeft /> Quay lại đăng nhập</Link>
      </div>
    </>
  );
}
