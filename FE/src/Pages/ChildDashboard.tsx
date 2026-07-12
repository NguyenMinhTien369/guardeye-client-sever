import { useParams, useNavigate } from "react-router-dom";
import { useChildDashboard } from "../hooks/useChildDashboard";
import { FiArrowLeft, FiClock, FiActivity, FiAlertCircle, FiMonitor, FiSmartphone, FiHash, FiList, FiPieChart } from "react-icons/fi";
import { useEffect, useState } from "react";
import { childrenService } from "../services/children.service";
import type { Child } from "../types/children.types";
import "./ChildDashboard.css";

function Pagination({ page, totalPages, onPageChange }: { page: number, totalPages: number, onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    
    pages.push(1);
    
    if (page <= 3) {
      pages.push(2, 3, 4);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 2) {
      pages.push('...');
      pages.push(totalPages - 3, totalPages - 2, totalPages - 1);
      pages.push(totalPages);
    } else {
      pages.push('...');
      pages.push(page - 1, page, page + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="dm-pagination" style={{ display: 'flex', justifyContent: 'center', gap: '4px', paddingTop: '1.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
      {pageNumbers.map((p, idx) => (
        <button
          key={`${p}-${idx}`}
          className={`btn btn-sm ${p === page ? '' : 'btn-ghost'}`}
          disabled={p === '...'}
          style={{
            minHeight: '32px',
            height: '32px',
            padding: '0 12px',
            fontSize: '14px',
            cursor: p === '...' ? 'default' : 'pointer',
            ...(p === page ? { backgroundColor: 'var(--accent-primary)', color: 'white' } : {})
          }}
          onClick={() => {
            if (typeof p === 'number') onPageChange(p);
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function ChildDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useChildDashboard(id);
  const [child, setChild] = useState<Child | null>(null);
  const [timelinePage, setTimelinePage] = useState(1);

  useEffect(() => {
    if (id) {
      childrenService.getAll().then(res => {
        const found = res.data?.find(c => c.id === id);
        if (found) setChild(found);
      }).catch(console.error);
    }
  }, [id]);

  if (loading) {
    return <div className="child-dashboard-loading"><div className="loader"></div><p>Đang tải dữ liệu...</p></div>;
  }

  if (error || !data) {
    return (
      <div className="child-dashboard-error">
        <FiAlertCircle className="error-icon" />
        <p>{error || "Không thể tải dữ liệu"}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Quay lại</button>
      </div>
    );
  }

  const getStatusClass = (status: string) => {
    switch(status) {
      case "ACTIVE": return "status-active";
      case "PAUSED": return "status-warning";
      default: return "status-offline";
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case "Mạng xã hội": return "#3B82F6";
      case "Giải trí": return "#F59E0B";
      case "Học tập": return "#10B981";
      case "Trình duyệt": return "#8B5CF6";
      default: return "#6B7280";
    }
  };

  const ITEMS_PER_PAGE = 10;
  const timelineData = data?.activity?.timeline || [];
  const totalTimelinePages = Math.ceil(timelineData.length / ITEMS_PER_PAGE) || 1;
  const currentTimelineData = timelineData.slice((timelinePage - 1) * ITEMS_PER_PAGE, timelinePage * ITEMS_PER_PAGE);

  return (
    <div className="child-dashboard-container fade-in">
      {/* Header */}
      <div className="cd-header">
        <button className="btn-icon back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft />
        </button>
        <div className="cd-header-info">
          {child ? (
            <>
              <div className="cd-avatar" style={{ overflow: "hidden", backgroundColor: child.avatarUrl ? "transparent" : undefined }}>
                {child.avatarUrl ? (
                  <img 
                    src={child.avatarUrl.startsWith("http") ? child.avatarUrl : `http://localhost:5000${child.avatarUrl}`} 
                    alt="Avatar" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                ) : (
                  child.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2>{child.name}</h2>
                <p>{child.age} tuổi • {child.gender === 'male' ? 'Nam' : child.gender === 'female' ? 'Nữ' : 'Khác'}</p>
              </div>
            </>
          ) : (
            <h2>Tổng quan hoạt động</h2>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="cd-stats-grid">
        <div className="cd-stat-card primary-gradient">
          <div className="stat-icon"><FiClock /></div>
          <div className="stat-content">
            <p className="stat-label">Thời gian hôm nay</p>
            <h3 className="stat-value">{data.overview.totalTimeFormatted || "0 phút"}</h3>
            <span className="stat-diff">{data.overview.timeDiffText}</span>
          </div>
        </div>

        <div className="cd-stat-card secondary-gradient">
          <div className="stat-icon"><FiActivity /></div>
          <div className="stat-content">
            <p className="stat-label">Khung giờ hoạt động</p>
            <h3 className="stat-value">
              {data.overview.timeRange}
            </h3>
            <span className="stat-subtext">Hôm nay</span>
          </div>
        </div>

        <div className="cd-stat-card neutral-gradient">
          <div className="stat-icon"><FiMonitor /></div>
          <div className="stat-content">
            <p className="stat-label">Trạng thái thiết bị</p>
            <h3 className="stat-value">
              <span className={`status-dot ${getStatusClass(data.overview.agentStatus)}`}></span>
              <span>{data.overview.agentStatusText}</span>
            </h3>
            <span className="stat-subtext">{data.management.lastSyncText}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="cd-charts-grid">
        
        {/* Category Breakdown */}
        <div className="cd-panel">
          <div className="panel-header">
            <h3><FiPieChart /> Phân bổ thời gian</h3>
          </div>
          <div className="panel-body">
            {data?.activity?.categoryChart && data.activity.categoryChart.length > 0 ? (
              <div className="category-list">
                {data.activity.categoryChart.map((cat, idx) => (
                  <div key={idx} className="category-item">
                    <div className="cat-info">
                      <span className="cat-name" style={{ color: getCategoryColor(cat.category) }}>{cat.category}</span>
                      <span className="cat-pct">{cat.percentage}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill slide-in-left" 
                        style={{ 
                          width: `${cat.percentage}%`, 
                          backgroundColor: getCategoryColor(cat.category),
                          animationDelay: `${idx * 0.1}s`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Chưa có dữ liệu phân bổ</p>
            )}
          </div>
        </div>

        {/* Top Apps */}
        <div className="cd-panel">
          <div className="panel-header">
            <h3><FiList /> Top 10 Ứng dụng</h3>
          </div>
          <div className="panel-body custom-scrollbar">
            {data?.activity?.topApps && data.activity.topApps.length > 0 ? (
              <div className="top-apps-list">
                {data.activity.topApps.map((app, idx) => (
                  <div key={idx} className="app-item slide-in-bottom" style={{ animationDelay: `${idx * 0.05}s`}}>
                    <div className="app-icon-placeholder">
                       {app.isGaming ? <FiAlertCircle className="text-error" /> : <FiHash className="text-muted" />}
                    </div>
                    <div className="app-details">
                      <div className="app-name-row">
                        <span className={`app-name ${app.isGaming ? 'text-error' : ''}`}>{app.name}</span>
                        <span className="app-duration">{app.durationFormatted}</span>
                      </div>
                      <div className="progress-bar-bg small">
                        <div 
                          className={`progress-bar-fill ${app.isGaming ? 'bg-error' : 'bg-primary'}`} 
                          style={{ width: `${app.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Chưa có dữ liệu ứng dụng</p>
            )}
          </div>
        </div>

      </div>

      {/* Timeline */}
      <div className="cd-panel full-width timeline-panel">
        <div className="panel-header">
          <h3>Hoạt động gần đây (Hôm nay)</h3>
        </div>
        <div className="panel-body">
          {timelineData.length > 0 ? (
            <>
              <div className="timeline-container">
                {currentTimelineData.map((ev, idx) => (
                  <div key={idx} className={`timeline-item ${ev.isWarning ? 'warning-item' : ''}`}>
                    <div className="timeline-time">{ev.time}</div>
                    <div className="timeline-marker">
                      <div className={`marker-dot ${ev.isWarning ? 'bg-error pulse-animation' : 'bg-primary'}`}></div>
                      {idx !== currentTimelineData.length - 1 && <div className="marker-line"></div>}
                    </div>
                    <div className="timeline-content">
                      <span className="timeline-cat" style={{ color: getCategoryColor(ev.categoryTag?.replace('[', '')?.replace(']', '') || '') }}>{ev.categoryTag}</span>
                      <span className={`timeline-act ${ev.isWarning ? 'text-error font-medium' : ''}`}>{ev.activity}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination controls */}
              <Pagination page={timelinePage} totalPages={totalTimelinePages} onPageChange={setTimelinePage} />
            </>
          ) : (
            <p className="empty-state">Chưa có hoạt động nào được ghi nhận hôm nay.</p>
          )}
        </div>
      </div>

    </div>
  );
}
