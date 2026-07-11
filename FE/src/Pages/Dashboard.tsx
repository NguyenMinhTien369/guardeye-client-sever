import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { 
  FiUsers, 
  FiMonitor, 
  FiActivity, 
  FiClock, 
  FiCheckCircle, 
  FiXCircle, 
  FiPauseCircle,
  FiChevronRight
} from "react-icons/fi";
import "./Dashboard.css"; // We will create this file next

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { children, devices, totalChildren, totalDevices, activeDevices, loading, error, refresh } = useDashboardStats();

  if (!user) return null;

  const getDeviceStatusIcon = (device: any) => {
    if (device.isPaused) return <FiPauseCircle className="status-icon text-warning" />;
    if (device.status === "active") return <FiCheckCircle className="status-icon text-success" />;
    return <FiXCircle className="status-icon text-error" />;
  };

  const getDeviceStatusText = (device: any) => {
    if (device.isPaused) return "Đang tạm dừng";
    if (device.status === "active") return "Đang giám sát";
    return "Mất kết nối";
  };

  return (
    <div className="dashboard-container">
      {/* Welcome Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Xin chào, {user.name}! 👋</h1>
          <p>Dưới đây là tổng quan về tình hình giám sát của các thiết bị.</p>
        </div>
        <button className="btn btn-outline" onClick={refresh} disabled={loading}>
          {loading ? "Đang tải..." : "Làm mới dữ liệu"}
        </button>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-icon-wrapper"><FiUsers /></div>
          <div className="stat-info">
            <h3>{loading ? "..." : totalChildren}</h3>
            <p>Trẻ em đang quản lý</p>
          </div>
        </div>

        <div className="stat-card stat-indigo">
          <div className="stat-icon-wrapper"><FiMonitor /></div>
          <div className="stat-info">
            <h3>{loading ? "..." : totalDevices}</h3>
            <p>Tổng số thiết bị</p>
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-icon-wrapper"><FiActivity /></div>
          <div className="stat-info">
            <h3>{loading ? "..." : activeDevices}</h3>
            <p>Thiết bị đang hoạt động</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-main">
        <h2 className="section-title">Tổng quan các trẻ</h2>
        
        {loading ? (
          <div className="skeleton-grid">
            {[1, 2].map((i) => <div key={i} className="skeleton-card" style={{ height: 200 }}></div>)}
          </div>
        ) : children.length === 0 ? (
          <div className="empty-state-card">
            <FiUsers size={48} className="text-muted" />
            <h3>Chưa có hồ sơ trẻ em</h3>
            <p>Hãy thêm hồ sơ của trẻ để bắt đầu quản lý các thiết bị.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/children')}>Thêm trẻ em</button>
          </div>
        ) : (
          <div className="children-grid">
            {children.map((child) => {
              // Get devices for this child
              const childDevices = devices.filter(d => d.childId === child.id);

              return (
                <div key={child.id} className="child-overview-card">
                  <div className="child-card-header">
                    <div className="child-avatar">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="child-meta">
                      <h3>{child.name}</h3>
                      <p>{child.age} tuổi • {child.gender === 'male' ? 'Nam' : child.gender === 'female' ? 'Nữ' : 'Khác'}</p>
                    </div>
                  </div>
                  
                  <div className="child-devices-list">
                    <h4>Thiết bị ({childDevices.length})</h4>
                    {childDevices.length === 0 ? (
                      <p className="no-devices-text">Chưa có thiết bị nào được gán.</p>
                    ) : (
                      <div className="device-items">
                        {childDevices.map(device => (
                          <div key={device.id} className="device-item">
                            <div className="device-item-info">
                              {getDeviceStatusIcon(device)}
                              <div className="device-item-text">
                                <span className="device-name">{device.deviceName}</span>
                                <span className="device-status-text">{getDeviceStatusText(device)}</span>
                              </div>
                            </div>
                            <button 
                              className="btn-icon" 
                              title="Xem nhật ký giám sát"
                              onClick={() => navigate(`/devices/${device.id}/monitor`)}
                            >
                              <FiClock /> <span className="sr-only">Xem log</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="child-card-footer">
                    <button className="btn-link" onClick={() => navigate('/devices')}>
                      Quản lý thiết bị <FiChevronRight />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

