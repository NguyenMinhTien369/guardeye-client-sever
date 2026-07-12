import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiActivity,
  FiCamera,
  FiCalendar,
  FiRefreshCw,
  FiMonitor,
  FiGlobe,
  FiGrid,
  FiList,
  FiChevronDown,
  FiClock,
  FiAlertCircle,
  FiZap,
  FiSearch,
} from "react-icons/fi";
import { useDeviceMonitor } from "../hooks/useDeviceMonitor";
import { useAiPanel, parseTitleToUrl } from "../hooks/useAiPanel";
import { AiChatPanel } from "../components/AiChatPanel";


// ── Helpers ───────────────────────────────────────────────────────────────────

const BROWSER_PROCESSES = ["chrome.exe", "msedge.exe", "firefox.exe", "opera.exe", "brave.exe"];

function isBrowser(processName: string): boolean {
  return BROWSER_PROCESSES.includes(processName.toLowerCase());
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatUIDate(dateKey: string): string {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-");
  return `${d}-${m}-${y}`;
}

function getProcessDisplayName(processName: string): string {
  const map: Record<string, string> = {
    "chrome.exe": "Google Chrome",
    "msedge.exe": "Microsoft Edge",
    "firefox.exe": "Mozilla Firefox",
    "opera.exe": "Opera",
    "brave.exe": "Brave",
    "code.exe": "VS Code",
    "devenv.exe": "Visual Studio",
    "explorer.exe": "File Explorer",
    "notepad.exe": "Notepad",
    "winword.exe": "Microsoft Word",
    "excel.exe": "Microsoft Excel",
    "powerpnt.exe": "PowerPoint",
    "discord.exe": "Discord",
    "slack.exe": "Slack",
    "minecraft.exe": "Minecraft",
    "steam.exe": "Steam",
  };
  return map[processName.toLowerCase()] || processName.replace(".exe", "");
}

function getCategoryTag(processName: string, title: string): string {
  const p = processName.toLowerCase();
  const t = title.toLowerCase();

  if (p.includes("chrome") || p.includes("edge") || p.includes("brave") || p.includes("firefox") || p.includes("opera") || p.includes("cốc cốc") || p.includes("browser")) {
    if (t.includes("youtube") || t.includes("netflix") || t.includes("phim") || t.includes("video") || t.includes("nhạc")) return "Giải trí";
    if (t.includes("facebook") || t.includes("zalo") || t.includes("messenger") || t.includes("instagram") || t.includes("tiktok") || t.includes("twitter")) return "Mạng xã hội";
    if (t.includes("learn") || t.includes("edu") || t.includes("study") || t.includes("học") || t.includes("school") || t.includes("course") || t.includes("tutorial")) return "Học tập";
    if (t.includes("game") || t.includes("play") || t.includes("trò chơi")) return "Trò chơi";
    return "Trình duyệt";
  }

  if (p.includes("discord") || p.includes("slack") || p.includes("zalo") || p.includes("teams")) return "Mạng xã hội";
  if (p.includes("steam") || p.includes("minecraft") || p.includes("lol") || p.includes("game") || p.includes("roblox") || p.includes("valorant")) return "Trò chơi";
  if (p.includes("word") || p.includes("excel") || p.includes("powerpnt") || p.includes("code") || p.includes("devenv") || p.includes("zoom") || p.includes("idea")) return "Học tập";

  return "Khác";
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "Mạng xã hội": return "#3B82F6";
    case "Giải trí": return "#F59E0B";
    case "Học tập": return "#10B981";
    case "Trình duyệt": return "#8B5CF6";
    case "Trò chơi": return "#EF4444";
    default: return "#6B7280";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (d: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div 
      className="dm-date-picker"
      onClick={() => {
        try {
          if (inputRef.current) {
            (inputRef.current as any).showPicker();
          }
        } catch (e) {
          inputRef.current?.focus();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <FiCalendar />
      <input
        ref={inputRef}
        type="date"
        value={value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
        className="dm-date-input"
        style={{ cursor: "pointer" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.preventDefault()}
      />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="dm-empty">
      <div className="dm-empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

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
    <div className="dm-pagination" style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', padding: '8px 24px', background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)' }}>
      {pageNumbers.map((p, idx) => (
        <button
          key={`${p}-${idx}`}
          className={`btn btn-sm ${p === page ? '' : 'btn-ghost'}`}
          disabled={p === '...'}
          style={{
            minHeight: '28px',
            height: '28px',
            padding: '0 10px',
            fontSize: '13px',
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

// ── Main Component ────────────────────────────────────────────────────────────

export function DeviceMonitor() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"activity" | "screenshots">("activity");
  const [screenshotView, setScreenshotView] = useState<"grid" | "list">("grid");
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── AI Panel state ──────────────────────────────────────────────────────────
  const aiPanel = useAiPanel();

  const handleAiClick = (title: string) => {
    const url = parseTitleToUrl(title);
    aiPanel.openPanel(url, title);
  };

  const {
    events,
    screenshots,
    loadingEvents,
    loadingScreenshots,
    error,
    currentDate,
    totalEvents,
    totalScreenshots,
    eventPage,
    eventTotalPages,
    screenshotPage,
    screenshotTotalPages,
    search,
    sort,
    changeDate,
    setSearch,
    setSort,
    setEventPage,
    setScreenshotPage,
    refresh,
  } = useDeviceMonitor(deviceId || "");

  if (!deviceId) {
    return (
      <div className="dm-error">
        <FiAlertCircle size={48} />
        <p>Không tìm thấy thiết bị.</p>
      </div>
    );
  }

  return (
    <div className={`dm-page-container ${aiPanel.isOpen ? "ai-panel-open" : ""}`} style={{ height: '100vh', overflow: 'hidden' }}>
    <div className="dm-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <div className="dm-header">
        <button className="dm-back-btn" onClick={() => navigate("/devices")} id="btn-back-to-devices">
          <FiArrowLeft /> Trở về
        </button>
        <div className="dm-header-title">
          <FiMonitor size={22} />
          <h1>Nhật ký giám sát</h1>
        </div>
        <div className="dm-header-actions">
          <DatePicker value={currentDate} onChange={changeDate} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={refresh}
            title="Làm mới"
            id="btn-refresh-monitor"
          >
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="dm-alert-error">
          <FiAlertCircle />
          {error}
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="dm-stats-bar">
        <div className="dm-stat-item">
          <FiActivity size={16} />
          <span>
            <strong>{totalEvents}</strong> hoạt động ngày {formatUIDate(currentDate)}
          </span>
        </div>
        <div className="dm-stat-item">
          <FiCamera size={16} />
          <span>
            <strong>{totalScreenshots}</strong> ảnh chụp màn hình
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="dm-tabs">
        <button
          id="tab-activity"
          className={`dm-tab ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <FiActivity size={16} /> Nhật ký hoạt động
          {totalEvents > 0 && <span className="dm-tab-badge">{totalEvents}</span>}
        </button>
        <button
          id="tab-screenshots"
          className={`dm-tab ${activeTab === "screenshots" ? "active" : ""}`}
          onClick={() => setActiveTab("screenshots")}
        >
          <FiCamera size={16} /> Ảnh chụp màn hình
          {totalScreenshots > 0 && <span className="dm-tab-badge">{totalScreenshots}</span>}
        </button>
      </div>

      {/* ── Activity Timeline ── */}
      {activeTab === "activity" && (
        <>
          <div className="dm-toolbar" style={{ display: 'flex', gap: '12px', padding: '12px 24px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={16} />
              <input 
                type="text" 
                placeholder="Tìm kiếm URL, tiêu đề..." 
                className="dm-date-input" 
                style={{ width: '100%', paddingLeft: '36px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="dm-date-input" 
              style={{ width: '130px' }}
              value={sort}
              onChange={(e) => setSort(e.target.value as "desc" | "asc")}
            >
              <option value="desc">Mới nhất</option>
              <option value="asc">Cũ nhất</option>
            </select>
          </div>
          <div className="dm-activity-panel" style={{ flex: 1, overflowY: 'auto' }}>
            {loadingEvents && events.length === 0 ? (
            <div className="dm-skeleton-list">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="dm-skeleton-item" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={<FiActivity size={40} />}
              text="Chưa có hoạt động nào được ghi nhận trong ngày này."
            />
          ) : (
              <div className="dm-timeline">
                {events.map((evt, idx) => {
                  const browser = isBrowser(evt.processName);
                  const category = getCategoryTag(evt.processName, evt.title);
                  const getHourLabel = (iso: string) => {
                    const d = new Date(iso);
                    return `${d.getHours()} giờ`;
                  };

                  const prevLabel = idx > 0 ? getHourLabel(events[idx - 1].timestamp) : null;
                  const thisLabel = getHourLabel(evt.timestamp);
                  const showHourDivider = idx === 0 || prevLabel !== thisLabel;

                  return (
                    <div key={evt.id}>
                      {showHourDivider && (
                        <div className="dm-hour-divider">
                          <FiClock size={12} />
                          {thisLabel}
                        </div>
                      )}
                      <div className={`dm-timeline-item ${browser ? "is-browser" : ""} ${aiPanel.activeTitle === evt.title && aiPanel.isOpen ? "ai-active" : ""}`}>
                        <div className="dm-timeline-dot" />
                        <div className="dm-timeline-content">
                          <div className="dm-timeline-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`dm-process-badge ${browser ? "browser" : "app"}`}>
                                {browser ? <FiGlobe size={12} /> : <FiMonitor size={12} />}
                                {getProcessDisplayName(evt.processName)}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '11px', 
                                  fontWeight: 600, 
                                  padding: '2px 8px', 
                                  borderRadius: '12px', 
                                  color: 'white', 
                                  backgroundColor: getCategoryColor(category) 
                                }}
                              >
                                {category}
                              </span>
                            </div>
                            <div className="dm-timeline-right">
                              <span className="dm-timeline-time">
                                {formatTime(evt.timestamp)}
                              </span>
                              <button
                                className={`ai-analyze-btn ${
                                  aiPanel.activeTitle === evt.title && aiPanel.isOpen ? "active" : ""
                                }`}
                                onClick={(e) => { e.stopPropagation(); handleAiClick(evt.title); }}
                                title="Phân tích với AI"
                                id={`btn-ai-analyze-${evt.id}`}
                              >
                                <FiZap size={12} />
                              </button>
                            </div>
                          </div>
                          <p className="dm-timeline-title">{evt.title}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {!loadingEvents && events.length > 0 && (
            <Pagination page={eventPage} totalPages={eventTotalPages} onPageChange={setEventPage} />
          )}
        </>
      )}

      {/* ── Screenshots Gallery ── */}
      {activeTab === "screenshots" && (
        <>
        <div className="dm-screenshots-panel" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="dm-gallery-toolbar">
            <button
              className={`dm-view-btn ${screenshotView === "grid" ? "active" : ""}`}
              onClick={() => setScreenshotView("grid")}
              title="Grid view"
              id="btn-view-grid"
            >
              <FiGrid size={16} />
            </button>
            <button
              className={`dm-view-btn ${screenshotView === "list" ? "active" : ""}`}
              onClick={() => setScreenshotView("list")}
              title="List view"
              id="btn-view-list"
            >
              <FiList size={16} />
            </button>
          </div>

          {loadingScreenshots && screenshots.length === 0 ? (
            <div className={`dm-gallery-skeleton ${screenshotView}`}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="dm-gallery-skeleton-item" />
              ))}
            </div>
          ) : screenshots.length === 0 ? (
            <EmptyState
              icon={<FiCamera size={40} />}
              text="Chưa có ảnh chụp màn hình nào trong ngày này."
            />
          ) : (
              <div className={`dm-gallery ${screenshotView}`}>
                {screenshots.map((s) => (
                  <div
                    key={s.id}
                    className="dm-gallery-item"
                    onClick={() => setLightbox(s.imageUrl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setLightbox(s.imageUrl)}
                  >
                    <div className="dm-gallery-thumb">
                      <img src={s.imageUrl} alt={s.triggerTitle} loading="lazy" />
                    </div>
                    <div className="dm-gallery-meta">
                      <p className="dm-gallery-trigger" title={s.triggerTitle}>
                        {s.triggerTitle}
                      </p>
                      <span className="dm-gallery-time">
                        <FiClock size={11} /> {formatDateTime(s.capturedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        {!loadingScreenshots && screenshots.length > 0 && (
          <Pagination page={screenshotPage} totalPages={screenshotTotalPages} onPageChange={setScreenshotPage} />
        )}
        </>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="dm-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={lightbox} alt="Screenshot phóng to" onClick={(e) => e.stopPropagation()} />
          <button
            className="dm-lightbox-close"
            onClick={() => setLightbox(null)}
            id="btn-close-lightbox"
          >
            ✕
          </button>
        </div>
      )}
    </div>

    {/* ── AI Chat Panel (bên phải) ── */}
    <AiChatPanel
      isOpen={aiPanel.isOpen}
      activeUrl={aiPanel.activeUrl}
      activeTitle={aiPanel.activeTitle}
      analysis={aiPanel.analysis}
      messages={aiPanel.messages}
      isAnalyzing={aiPanel.isAnalyzing}
      isChatting={aiPanel.isChatting}
      error={aiPanel.error}
      onClose={aiPanel.closePanel}
      onSendMessage={aiPanel.sendMessage}
    />
  </div>
  );
}
