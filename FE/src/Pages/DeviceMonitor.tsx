import { useState } from "react";
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

// ── Sub-components ────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (d: string) => void;
}) {
  return (
    <div className="dm-date-picker">
      <FiCalendar />
      <input
        type="date"
        value={value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
        className="dm-date-input"
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
    changeDate,
    loadMoreEvents,
    loadMoreScreenshots,
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
    <div className={`dm-page-container ${aiPanel.isOpen ? "ai-panel-open" : ""}`}>
    <div className="dm-wrapper">
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
            <strong>{totalEvents}</strong> hoạt động ngày {currentDate}
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
        <div className="dm-activity-panel">
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
            <>
              <div className="dm-timeline">
                {events.map((evt, idx) => {
                  const browser = isBrowser(evt.processName);
                  const prevDate =
                    idx > 0
                      ? new Date(events[idx - 1].timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit" })
                      : null;
                  const thisHour = new Date(evt.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit" });
                  const showHourDivider = idx === 0 || prevDate !== thisHour;

                  return (
                    <div key={evt.id}>
                      {showHourDivider && (
                        <div className="dm-hour-divider">
                          <FiClock size={12} />
                          {thisHour}
                        </div>
                      )}
                      <div className={`dm-timeline-item ${browser ? "is-browser" : ""} ${aiPanel.activeTitle === evt.title && aiPanel.isOpen ? "ai-active" : ""}`}>
                        <div className="dm-timeline-dot" />
                        <div className="dm-timeline-content">
                          <div className="dm-timeline-header">
                            <span className={`dm-process-badge ${browser ? "browser" : "app"}`}>
                              {browser ? <FiGlobe size={12} /> : <FiMonitor size={12} />}
                              {getProcessDisplayName(evt.processName)}
                            </span>
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

              {events.length < totalEvents && (
                <div className="dm-load-more">
                  <button
                    id="btn-load-more-events"
                    className="btn btn-ghost"
                    onClick={loadMoreEvents}
                    disabled={loadingEvents}
                  >
                    {loadingEvents ? (
                      <span className="btn-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    ) : (
                      <>
                        <FiChevronDown size={16} /> Tải thêm ({totalEvents - events.length} còn lại)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Screenshots Gallery ── */}
      {activeTab === "screenshots" && (
        <div className="dm-screenshots-panel">
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
            <>
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

              {screenshots.length < totalScreenshots && (
                <div className="dm-load-more">
                  <button
                    id="btn-load-more-screenshots"
                    className="btn btn-ghost"
                    onClick={loadMoreScreenshots}
                    disabled={loadingScreenshots}
                  >
                    {loadingScreenshots ? (
                      <span className="btn-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    ) : (
                      <>
                        <FiChevronDown size={16} /> Tải thêm ảnh ({totalScreenshots - screenshots.length} còn lại)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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
