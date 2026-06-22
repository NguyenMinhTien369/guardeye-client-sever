import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import type { ApiError } from "../types/auth.types";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState("");

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email không được để trống";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!password) {
      newErrors.password = "Mật khẩu không được để trống";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (!validate()) return;

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/dashboard");
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
      <div className="auth-form-header" style={{ textAlign: 'left', width: '100%', marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Welcome Back</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please enter your details to access your dashboard.</p>
      </div>

      {apiError && (
        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Email Address</label>
          <div className="input-wrapper">
            <FiMail className="input-icon" />
            <input
              type="email"
              className={`form-input ${errors.email ? "error" : ""}`}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {errors.email && <div className="form-error"><FiAlertCircle /> {errors.email}</div>}
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label className="form-label" style={{ marginBottom: 0, fontWeight: 600, fontSize: '0.8rem' }}>Password</label>
            <Link to="/forgot-password" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Forgot password?</Link>
          </div>
          <div className="input-wrapper">
            <FiLock className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              className={`form-input ${errors.password ? "error" : ""}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
          {errors.password && <div className="form-error"><FiAlertCircle /> {errors.password}</div>}
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <input type="checkbox" id="keep-signed-in" style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
          <label htmlFor="keep-signed-in" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Keep me signed in for 30 days</label>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ background: 'var(--accent-primary)', width: '100%', padding: '0.85rem', borderRadius: '8px', fontWeight: 600 }}
        >
          {isLoading ? <span className="btn-spinner"></span> : "Sign In"}
        </button>

        <div className="form-footer" style={{ marginTop: '2rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>New to GuardEye? </span>
          <Link to="/register" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Create an account</Link>
        </div>
      </form>
    </>
  );
}
