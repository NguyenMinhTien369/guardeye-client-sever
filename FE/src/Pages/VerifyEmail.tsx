import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle, FiMail, FiLoader } from "react-icons/fi";
import axios from "axios";
import { authService } from "../services/auth.service";
import type { ApiError } from "../types/auth.types";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "success" | "error" | "invalid">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Ref để ngăn strict mode gọi API 2 lần
  const effectRan = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    if (effectRan.current) return;
    effectRan.current = true;

    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus("success");
        // Sau 3 giây tự động về trang login
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } catch (error) {
        setStatus("error");
        if (axios.isAxiosError(error)) {
          const data = error.response?.data as ApiError | undefined;
          setErrorMessage(data?.message || "Liên kết không hợp lệ hoặc đã hết hạn.");
        } else {
          setErrorMessage((error as Error).message || "Đã xảy ra lỗi.");
        }
      }
    };

    verify();
  }, [token, navigate]);

  if (status === "invalid") {
    return (
      <>
        <div className="auth-form-header">
          <div className="mobile-logo"><FiAlertCircle size={32} color="#EF4444" /></div>
          <h1>Xác thực thất bại</h1>
          <p>Không tìm thấy mã xác thực. Vui lòng kiểm tra lại liên kết trong email.</p>
        </div>
        <div className="form-footer">
          <Link to="/register">Quay lại trang đăng ký</Link>
        </div>
      </>
    );
  }

  if (status === "loading") {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <FiLoader className="btn-spinner" style={{ width: "40px", height: "40px", color: "var(--accent-primary)" }} />
        <h2 style={{ marginTop: "20px" }}>Đang xác thực email...</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "10px" }}>Vui lòng đợi trong giây lát</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <>
        <div className="auth-form-header">
          <div className="mobile-logo">
            <FiCheckCircle size={40} color="#10B981" />
          </div>
          <h1>Xác thực thành công!</h1>
          <p>Tài khoản của bạn đã được xác thực.</p>
        </div>
        <div className="alert alert-success">
          <FiCheckCircle className="alert-icon" />
          <span>Email đã xác thực thành công! Hệ thống sẽ tự động chuyển đến trang đăng nhập.</span>
        </div>
        <div className="form-footer" style={{ marginTop: '1.5rem' }}>
          <Link to="/login" className="btn btn-primary" style={{ display: 'block', width: '100%', textDecoration: 'none' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </>
    );
  }

  // status === "error"
  return (
    <>
      <div className="auth-form-header">
        <div className="mobile-logo">
          <FiAlertCircle size={40} color="#EF4444" />
        </div>
        <h1>Xác thực không thành công</h1>
        <p>Không thể xác thực email của bạn.</p>
      </div>
      
      <div className="alert alert-error">
        <FiAlertCircle className="alert-icon" />
        <span>{errorMessage}</span>
      </div>

      <div className="form-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Liên kết có thể đã hết hạn hoặc đã được sử dụng. Vui lòng đăng nhập lại để nhận liên kết mới (nếu tài khoản chưa kích hoạt).
        </p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'block', width: '100%', textDecoration: 'none', marginBottom: '10px' }}>
          Đi đến Đăng nhập
        </Link>
      </div>
    </>
  );
}
