import { useState } from "react";
import { FiCopy, FiCheck, FiAlertTriangle, FiShield, FiX } from "react-icons/fi";
import type { CreateDeviceResponseData } from "../types/devices.types";

interface DeviceTokenModalProps {
  isOpen: boolean;
  data: CreateDeviceResponseData | null;
  onClose: () => void;
}

export function DeviceTokenModal({ isOpen, data, onClose }: DeviceTokenModalProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUsers, setCopiedUsers] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(data.deviceToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    } catch {
      // Fallback nếu clipboard API không khả dụng
      const el = document.createElement("textarea");
      el.value = data.deviceToken;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleCopyUsers = async () => {
    const usersStr = data.monitoredUsers.join(", ");
    try {
      await navigator.clipboard.writeText(usersStr);
      setCopiedUsers(true);
      setTimeout(() => setCopiedUsers(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = usersStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedUsers(true);
      setTimeout(() => setCopiedUsers(false), 2500);
    }
  };

  const handleConfirmClose = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay token-modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content token-modal">
        {/* Header */}
        <div className="token-modal-header">
          <div className="token-success-icon">
            <FiShield />
          </div>
          <h3 className="token-modal-title">Thiết bị đã được tạo thành công!</h3>
          <p className="token-modal-subtitle">
            Tên thiết bị: <strong>{data.device.deviceName}</strong>
          </p>
        </div>

        {/* ⚠️ Critical Warning */}
        <div className="token-warning-box">
          <FiAlertTriangle className="token-warning-icon" />
          <div>
            <strong>Quan trọng — Chỉ hiển thị một lần duy nhất!</strong>
            <p>
              Mã <strong>Device Token</strong> bên dưới sẽ <u>không thể xem lại</u> sau khi bạn đóng trang này.
              Hãy sao chép và cấu hình vào ứng dụng Agent ngay bây giờ.
            </p>
          </div>
        </div>

        {/* Device Token */}
        <div className="token-section">
          <label className="token-label">Device Token (dán vào agent/config.json)</label>
          <div className="token-display-row">
            <code className="token-code">{data.deviceToken}</code>
            <button
              id="copy-device-token-btn"
              className={`btn token-copy-btn ${copiedToken ? "copied" : ""}`}
              onClick={handleCopyToken}
              title="Sao chép token"
            >
              {copiedToken ? <FiCheck /> : <FiCopy />}
              {copiedToken ? "Đã copy!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Monitored Users */}
        {data.monitoredUsers.length > 0 && (
          <div className="token-section">
            <label className="token-label">Windows Users được giám sát</label>
            <div className="token-display-row">
              <div className="token-users-list">
                {data.monitoredUsers.map((u) => (
                  <span key={u} className="user-tag">{u}</span>
                ))}
              </div>
              <button
                id="copy-monitored-users-btn"
                className={`btn token-copy-btn ${copiedUsers ? "copied" : ""}`}
                onClick={handleCopyUsers}
                title="Sao chép danh sách users"
              >
                {copiedUsers ? <FiCheck /> : <FiCopy />}
                {copiedUsers ? "Đã copy!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="token-instructions">
          <h4>Hướng dẫn cài đặt Agent:</h4>
          <ol>
            <li>Tải ứng dụng <strong>GuardEye Agent</strong> về máy cần giám sát.</li>
            <li>Mở file <code>config.json</code> trong thư mục Agent.</li>
            <li>Dán <strong>Device Token</strong> vào trường <code>"deviceToken"</code>.</li>
            <li>Khởi động Agent — trạng thái sẽ chuyển sang <span className="status-active-inline">Active</span> sau vài giây.</li>
          </ol>
        </div>

        {/* Confirm & Close */}
        <div className="token-modal-footer">
          {!confirmed ? (
            <button
              id="acknowledge-token-btn"
              className="btn btn-primary"
              onClick={handleConfirmClose}
              style={{ width: "100%" }}
            >
              <FiCheck style={{ marginRight: 6 }} />
              Tôi đã sao chép Token — Xác nhận
            </button>
          ) : (
            <div className="token-confirm-row">
              <p className="token-confirm-warning">
                <FiAlertTriangle />
                Bạn chắc chắn muốn đóng? Token sẽ không thể xem lại!
              </p>
              <div className="token-confirm-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setConfirmed(false)}
                >
                  Quay lại
                </button>
                <button
                  id="final-close-token-modal"
                  className="btn btn-danger"
                  onClick={onClose}
                >
                  <FiX style={{ marginRight: 4 }} />
                  Tôi hiểu, đóng lại
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
