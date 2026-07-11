import { FiMonitor, FiTrash2, FiPauseCircle, FiPlayCircle, FiUsers, FiClock, FiWifi, FiWifiOff, FiAlertCircle, FiActivity } from "react-icons/fi";
import type { Device, DeviceStatus } from "../types/devices.types";

interface DeviceCardProps {
  device: Device;
  childName?: string; // Tên trẻ tương ứng với childId (optional, hiển thị thêm)
  onPause: (device: Device) => void;
  onResume: (device: Device) => void;
  onDelete: (device: Device) => void;
  onViewMonitor: (device: Device) => void;
}

// ── Status Badge Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DeviceStatus, { label: string; icon: React.ReactNode; className: string }> = {
  active: {
    label: "Đang hoạt động",
    icon: <FiWifi />,
    className: "device-status-badge status-active",
  },
  inactive: {
    label: "Mất kết nối",
    icon: <FiWifiOff />,
    className: "device-status-badge status-inactive",
  },
  pending: {
    label: "Chờ cài Agent",
    icon: <FiAlertCircle />,
    className: "device-status-badge status-pending",
  },
};

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeviceCard({ device, childName, onPause, onResume, onDelete, onViewMonitor }: DeviceCardProps) {
  const statusConfig = STATUS_CONFIG[device.status];

  return (
    <div className={`device-card ${device.isPaused ? "device-card--paused" : ""}`}>
      {/* Paused overlay banner */}
      {device.isPaused && (
        <div className="device-paused-banner">
          <FiPauseCircle />
          <span>Đang tạm dừng giám sát</span>
          {device.pausedUntil && (
            <span className="paused-until">· đến {formatDateTime(device.pausedUntil)}</span>
          )}
        </div>
      )}

      {/* Card Header */}
      <div className="device-card-header">
        <div className="device-icon-wrapper">
          <FiMonitor className="device-icon" />
        </div>
        <div className="device-header-info">
          <h3 className="device-name">{device.deviceName}</h3>
          {childName && (
            <span className="device-child-name">
              <FiUsers style={{ display: "inline", marginRight: 4 }} />
              {childName}
            </span>
          )}
        </div>
        <div className="device-header-badge">
          <span className={statusConfig.className}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Monitored Users */}
      <div className="device-users-section">
        <span className="device-section-label">
          <FiUsers /> Windows Users được giám sát
        </span>
        <div className="device-users-list">
          {device.monitoredUsers.length > 0 ? (
            device.monitoredUsers.map((user) => (
              <span key={user} className="user-tag">
                {user}
              </span>
            ))
          ) : (
            <span className="device-no-users">Chưa cài đặt users</span>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="device-timestamps">
        <span className="device-ts">
          <FiClock style={{ display: "inline", marginRight: 4 }} />
          Tạo: {formatDateTime(device.createdAt)}
        </span>
        {device.isPaused && device.pausedSince && (
          <span className="device-ts device-ts--paused">
            Dừng từ: {formatDateTime(device.pausedSince)}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="device-actions">
        {device.isPaused ? (
          <button
            id={`resume-device-${device.id}`}
            className="btn btn-success device-action-btn"
            onClick={() => onResume(device)}
            title="Tiếp tục giám sát"
          >
            <FiPlayCircle />
            Tiếp tục
          </button>
        ) : (
          <button
            id={`pause-device-${device.id}`}
            className="btn btn-warning device-action-btn"
            onClick={() => onPause(device)}
            title="Tạm dừng giám sát"
          >
            <FiPauseCircle />
            Tạm dừng
          </button>
        )}

        <button
          id={`delete-device-${device.id}`}
          className="btn btn-ghost device-action-btn device-delete-btn"
          onClick={() => onDelete(device)}
          title="Xóa thiết bị"
        >
          <FiTrash2 />
          Xóa
        </button>

        <button
          id={`monitor-device-${device.id}`}
          className="btn btn-primary device-action-btn"
          onClick={() => onViewMonitor(device)}
          title="Xem nhật ký hoạt động"
        >
          <FiActivity />
          Xem hoạt động
        </button>
      </div>
    </div>
  );
}
