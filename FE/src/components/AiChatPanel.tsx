import { useState, useRef, useEffect, KeyboardEvent } from "react";
import type { UrlAnalysisResult, ChatMessage } from "../services/ai.service";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiChatPanelProps {
  isOpen: boolean;
  activeUrl: string | null;
  activeTitle: string | null;
  analysis: UrlAnalysisResult | null;
  messages: ChatMessage[];
  isAnalyzing: boolean;
  isChatting: boolean;
  error: string | null;
  onClose: () => void;
  onSendMessage: (msg: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SafetyBadge({ level }: { level: UrlAnalysisResult["safetyLevel"] }) {
  const config = {
    Safe:    { label: "An toàn",    className: "ai-safety-safe"    },
    Warning: { label: "Cảnh báo",   className: "ai-safety-warning" },
    Danger:  { label: "Nguy hiểm", className: "ai-safety-danger"  },
  };
  const { label, className } = config[level] ?? config.Warning;
  return <span className={`ai-safety-badge ${className}`}>{label}</span>;
}

function TypingDots() {
  return (
    <div className="ai-typing-dots">
      <span /><span /><span />
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: UrlAnalysisResult }) {
  return (
    <div className="ai-analysis-card">
      <div className="ai-analysis-header">
        <div className="ai-platform-info">
          <span className="ai-platform-name">{analysis.platformName}</span>
          <SafetyBadge level={analysis.safetyLevel} />
        </div>
      </div>

      <p className="ai-description">{analysis.description}</p>

      {analysis.mainActivities.length > 0 && (
        <div className="ai-activities">
          <span className="ai-activities-label">Hoạt động chính:</span>
          <div className="ai-activities-list">
            {analysis.mainActivities.map((act, i) => (
              <span key={i} className="ai-activity-chip">{act}</span>
            ))}
          </div>
        </div>
      )}

      <div className="ai-advice">
        <span className="ai-advice-icon">💡</span>
        <p>{analysis.parentAdvice}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiChatPanel({
  isOpen,
  activeUrl,
  activeTitle,
  analysis,
  messages,
  isAnalyzing,
  isChatting,
  error,
  onClose,
  onSendMessage,
}: AiChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAnalyzing]);

  // Focus input khi panel mở
  useEffect(() => {
    if (isOpen && !isAnalyzing) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, isAnalyzing]);

  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || isChatting) return;
    setInputValue("");
    await onSendMessage(msg);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Rút ngắn URL để hiển thị
  const displayUrl = activeUrl
    ? activeUrl.replace(/^https?:\/\//, "").split("?")[0].slice(0, 60)
    : "";

  return (
    <div className={`ai-chat-panel ${isOpen ? "open" : ""}`} role="complementary" aria-label="AI Analysis Panel">
      {/* ── Header ── */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <div className="ai-panel-title-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span>AI Phân tích</span>
        </div>
        <button
          className="ai-panel-close"
          onClick={onClose}
          id="btn-close-ai-panel"
          title="Đóng panel"
        >
          ✕
        </button>
      </div>

      {/* ── URL chip ── */}
      {activeTitle && (
        <div className="ai-url-section">
          <div className="ai-url-chip" title={activeUrl || ""}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="ai-url-text">{displayUrl}</span>
          </div>
          {activeTitle && (
            <p className="ai-url-title">{activeTitle.split(" - ")[0]}</p>
          )}
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="ai-panel-body">
        {/* Analysis section */}
        <div className="ai-analysis-section">
          {isAnalyzing ? (
            <div className="ai-analyzing-state">
              <div className="ai-analyzing-spinner">
                <div className="ai-spinner-ring" />
              </div>
              <p className="ai-analyzing-text">AI đang phân tích trang web...</p>
            </div>
          ) : error ? (
            <div className="ai-error-state">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          ) : analysis ? (
            <AnalysisCard analysis={analysis} />
          ) : null}
        </div>

        {/* Chat messages */}
        {(messages.length > 0 || analysis) && !isAnalyzing && (
          <div className="ai-chat-section">
            <div className="ai-chat-divider">
              <span>Hỏi thêm về trang này</span>
            </div>

            <div className="ai-messages-list">
              {/* Lời chào mở đầu nếu chưa có messages */}
              {messages.length === 0 && analysis && (
                <div className="ai-message ai">
                  <div className="ai-message-avatar">AI</div>
                  <div className="ai-message-bubble">
                    Tôi đã phân tích trang <strong>{analysis.platformName}</strong>. Bạn muốn biết thêm điều gì về trang này?
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`ai-message ${msg.role}`}>
                  <div className="ai-message-avatar">
                    {msg.role === "ai" ? "AI" : "You"}
                  </div>
                  <div className="ai-message-bubble">
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isChatting && (
                <div className="ai-message ai">
                  <div className="ai-message-avatar">AI</div>
                  <div className="ai-message-bubble">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      {!isAnalyzing && !error && (
        <div className="ai-input-area">
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder="Hỏi AI về trang này... (Enter để gửi)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isChatting || !analysis}
            id="ai-chat-input"
          />
          <button
            className="ai-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isChatting || !analysis}
            id="btn-ai-send"
            title="Gửi (Enter)"
          >
            {isChatting ? (
              <span className="btn-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
