import { useState, useRef, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiShield } from "react-icons/fi";
import axios from "axios";
import { authService } from "../services/auth.service";
import type { ApiError } from "../types/auth.types";

export function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string = (location.state as any)?.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Nếu không có email (truy cập trực tiếp URL), redirect về forgot-password
  if (!email) {
    return (
      <>
        <div className="auth-form-header">
          <div className="mobile-logo"><FiShield size={32} /></div>
          <h1>Xác thực OTP</h1>
          <p>Phiên làm việc không hợp lệ. Vui lòng bắt đầu lại.</p>
        </div>
        <div className="form-footer">
          <Link to="/forgot-password"><FiArrowLeft /> Quay lại quên mật khẩu</Link>
        </div>
      </>
    );
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    // Auto-focus ô tiếp theo
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs[index - 1].current?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs[5].current?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setOtpError("Vui lòng nhập đủ 6 chữ số OTP.");
      return;
    }

    setIsVerifying(true);
    setOtpError("");
    try {
      await authService.verifyOtp(email, otpCode);
      // OTP đúng → chuyển sang trang đổi mật khẩu
      navigate("/reset-password", { state: { email, otp: otpCode } });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiError | undefined;
        setOtpError(data?.message || "Mã OTP chưa chính xác. Vui lòng kiểm tra lại.");
      } else {
        setOtpError("Mã OTP chưa chính xác. Vui lòng kiểm tra lại.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <div className="auth-form-header">
        <div className="mobile-logo">
          <FiShield size={32} color="var(--accent-primary, #3B82F6)" />
        </div>
        <h1>Nhập mã OTP</h1>
        <p>
          Chúng tôi đã gửi mã OTP gồm 6 chữ số tới:<br />
          <strong>{email}</strong>
        </p>
      </div>

      {otpError && (
        <div className="alert alert-error">
          <FiAlertCircle className="alert-icon" />
          <span>{otpError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* 6 OTP boxes */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '2rem 0' }}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={otpRefs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              id={`otp-box-${i}`}
              style={{
                width: '52px',
                height: '62px',
                textAlign: 'center',
                fontSize: '1.6rem',
                fontWeight: 700,
                border: otpError
                  ? '2px solid #EF4444'
                  : '2px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                background: 'var(--surface-color, #fff)',
                color: 'var(--text-color, #1e293b)',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                cursor: 'text',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary, #3B82F6)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = otpError ? '#EF4444' : 'var(--border-color, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          ))}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isVerifying}>
          {isVerifying ? <><span className="btn-spinner" /> Đang xác thực...</> : "Xác nhận OTP"}
        </button>
      </form>

      <div className="form-footer" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <Link to="/forgot-password"><FiArrowLeft /> Gửi lại mã OTP</Link>
      </div>
    </>
  );
}
