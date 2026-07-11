import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/auth.service";
import "./Profile.css";
import axios from "axios";

export function Profile() {
  const { user, updateUser, logout } = useAuth();
  
  // States
  const [name, setName] = useState(user?.name || "");
  const [notifications, setNotifications] = useState({
    email: user?.notifications?.email ?? true,
    browser: user?.notifications?.browser ?? true,
  });
  
  // Password States
  const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setNotifications({
        email: user.notifications?.email ?? true,
        browser: user.notifications?.browser ?? true,
      });
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const response = await authService.updateProfile({ name, notifications });
      if (response.data) updateUser(response.data);
      setMessage({ type: "success", text: "Cập nhật thông tin thành công!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.message || "Cập nhật thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp!" });
      return;
    }
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      await authService.changePassword({ oldPassword, newPassword, confirmNewPassword });
      setMessage({ type: "success", text: "Đổi mật khẩu thành công!" });
      setIsPasswordExpanded(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.message || "Đổi mật khẩu thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const response = await authService.uploadAvatar(file);
      if (response.data) updateUser(response.data);
      setMessage({ type: "success", text: "Đổi ảnh đại diện thành công!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.message || "Upload ảnh thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị?")) {
      await logout();
    }
  };

  if (!user) return null;

  // Use full URL for avatar if it's relative
  const avatarUrl = user.avatarUrl 
    ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `http://localhost:5000${user.avatarUrl}`)
    : null;

  return (
    <div className="profile-page">
      <h1>Thông tin cá nhân</h1>

      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: message.type === 'success' ? '#def7ec' : '#fde8e8', color: message.type === 'success' ? '#03543f' : '#9b1c1c' }}>
          {message.text}
        </div>
      )}

      {/* Basic Info & Avatar */}
      <div className="profile-card">
        <div className="profile-avatar-section">
          <div className="avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="avatar-img" />
            ) : (
              <span className="avatar-placeholder">{user.name.charAt(0).toUpperCase()}</span>
            )}
            <button className="avatar-edit-btn" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              ✏️
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/jpeg, image/png, image/webp"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="profile-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className={`badge ${user.emailVerified ? 'verified' : 'unverified'}`}>
              {user.emailVerified ? "✓ Đã xác thực email" : "⚠️ Chưa xác thực email"}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label>Tên hiển thị</label>
          <input 
            type="text" 
            className="form-input" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={loading || name === user.name}>
          Lưu thông tin
        </button>
      </div>

      {/* Change Password */}
      <div className="profile-card">
        <div className="accordion">
          <div className="accordion-header" onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}>
            <span>Thay đổi mật khẩu</span>
            <span>{isPasswordExpanded ? "▲" : "▼"}</span>
          </div>
          {isPasswordExpanded && (
            <div className="accordion-content">
              <div className="form-group">
                <label>Mật khẩu hiện tại</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu mới</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Xác nhận mật khẩu mới</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={confirmNewPassword} 
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={loading || !oldPassword || !newPassword || !confirmNewPassword}>
                Cập nhật mật khẩu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="profile-card">
        <h3>Cài đặt khác</h3>
        
        <div className="toggle-group">
          <div>
            <strong>Thông báo qua Email</strong>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>Nhận email khi có hoạt động bất thường</p>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={notifications.email}
              onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="toggle-group" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Thông báo Trình duyệt</strong>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>Nhận thông báo ngay trên màn hình</p>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={notifications.browser}
              onChange={(e) => setNotifications({...notifications, browser: e.target.checked})}
            />
            <span className="slider"></span>
          </label>
        </div>

        <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={loading}>
          Lưu cài đặt
        </button>

        <hr style={{ margin: "24px 0", borderTop: "1px solid var(--border-color, #e5e7eb)" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Đăng xuất</strong>
            <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>Đăng xuất tài khoản khỏi tất cả các thiết bị</p>
          </div>
          <button className="btn btn-danger" onClick={handleLogoutAll}>
            Đăng xuất ngay
          </button>
        </div>
      </div>
    </div>
  );
}
