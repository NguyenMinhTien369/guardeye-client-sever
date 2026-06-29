import { useAuth } from "../hooks/useAuth";
import { FiUser, FiMail, FiCalendar, FiCheckCircle, FiXCircle } from "react-icons/fi";

export function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  };

  return (
    <div>
      <div className="welcome-card" style={{ marginBottom: "2rem" }}>
        <h2>Xin chào, {user.name}!</h2>
        <p>Chào mừng bạn đến với bảng điều khiển GuardEye.</p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          (Nội dung chính đang được phát triển...)
        </p>
      </div>

      <div className="user-info-grid">
        <div className="user-info-item">
          <div className="label">
            <FiUser style={{ display: 'inline', marginRight: '4px' }} />
            Họ và Tên
          </div>
          <div className="value">{user.name}</div>
        </div>

        <div className="user-info-item">
          <div className="label">
            <FiMail style={{ display: 'inline', marginRight: '4px' }} />
            Email
          </div>
          <div className="value">{user.email}</div>
        </div>

        <div className="user-info-item">
          <div className="label">Trạng thái xác thực Email</div>
          <div className="value">
            {user.emailVerified ? (
              <span className="status-badge active">
                <FiCheckCircle /> Đã xác thực
              </span>
            ) : (
              <span className="status-badge inactive">
                <FiXCircle /> Chưa xác thực
              </span>
            )}
          </div>
        </div>

        <div className="user-info-item">
          <div className="label">
            <FiCalendar style={{ display: 'inline', marginRight: '4px' }} />
            Ngày tham gia
          </div>
          <div className="value">{formatDate(user.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}
