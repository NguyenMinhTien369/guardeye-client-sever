import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  FiGrid,
  FiLogOut,
  FiUser,
  FiChevronRight,
  FiUsers,
  FiMonitor,
} from "react-icons/fi";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { PageSkeleton } from "./PageSkeleton";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const isFirstMount = useRef(true);

  // Trigger skeleton loader on route change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 600); // Artificial delay to show skeleton
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Đã đăng xuất thành công");
    } catch (error) {
      console.error("Logout error", error);
      toast.error("Đăng xuất thất bại");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: FiGrid },
    { name: "Quản lý trẻ", path: "/children", icon: FiUsers },
    { name: "Thiết bị", path: "/devices", icon: FiMonitor },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-title">
            <img src="/favicon.svg" alt="GuardEye Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} /> 
            GuardEye
          </div>

        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            let isActive = location.pathname.startsWith(item.path);
            
            // Nếu đang ở trang báo cáo của trẻ (/children/:id/dashboard), 
            // thì highlight tab Dashboard thay vì Quản lý trẻ
            if (location.pathname.match(/^\/children\/[^/]+\/dashboard/)) {
              if (item.path === "/dashboard") isActive = true;
              if (item.path === "/children") isActive = false;
            }

            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <Icon className="nav-icon" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <Link to="/profile" className="sidebar-user-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="user-avatar-wrapper">
                <div className="user-avatar" style={{ overflow: 'hidden' }}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `http://localhost:5000${user.avatarUrl}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <FiUser />
                  )}
                </div>
                <div className="user-avatar-badge"></div>
              </div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
              </div>
              <FiChevronRight className="user-arrow" />
            </Link>
          )}

          <div className="sidebar-divider"></div>

          <button
            className="sidebar-logout-btn"
            onClick={() => setShowLogoutModal(true)}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="btn-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'var(--text-secondary)' }}></span>
            ) : (
              <FiLogOut className="btn-icon" />
            )}
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`main-content ${location.pathname.includes('/monitor') ? 'no-padding' : ''}`}>
        <div style={{ display: isNavigating ? 'none' : 'block', height: '100%' }}>
          <Outlet />
        </div>
        {isNavigating && <PageSkeleton />}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Xác nhận đăng xuất</h3>
            <p className="modal-text">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p>
            <div className="modal-actions">
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowLogoutModal(false)} 
                disabled={isLoggingOut}
                style={{ padding: '0.6rem 1rem' }}
              >
                Hủy
              </button>
              <button 
                className="btn btn-danger" 
                onClick={confirmLogout} 
                disabled={isLoggingOut}
                style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isLoggingOut ? <span className="btn-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span> : "Đăng xuất"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
