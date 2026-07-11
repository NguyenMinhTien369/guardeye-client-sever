import { useState, useCallback, useRef } from "react";
import { aiService } from "../services/ai.service";
import type { UrlAnalysisResult, ChatMessage } from "../services/ai.service";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseAiPanelReturn {
  isOpen: boolean;
  activeUrl: string | null;
  activeTitle: string | null;
  analysis: UrlAnalysisResult | null;
  messages: ChatMessage[];
  isAnalyzing: boolean;
  isChatting: boolean;
  error: string | null;
  openPanel: (url: string, title: string) => void;
  closePanel: () => void;
  sendMessage: (msg: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Từ window title (vd: "YouTube - Google Chrome") cố gắng trích xuất domain
 * để tạo thành URL gửi cho AI.
 *
 * Ưu tiên:
 *   1. Nếu title đã chứa URL thực (https://...) → dùng nguyên
 *   2. Nếu title dạng "Tên trang - Browser" → tìm domain phổ biến trong title
 *   3. Fallback: dùng title làm "search query" và bọc thành URL fake để AI hiểu context
 */
export function parseTitleToUrl(title: string): string {
  // Case 1: Title chứa URL thực
  const urlMatch = title.match(/https?:\/\/[^\s"'<>]+/);
  if (urlMatch) return urlMatch[0];

  // Case 2: Tìm domain pattern trong title (youtube.com, facebook.com, ...)
  const domainMatch = title.match(/([a-zA-Z0-9-]+\.(com|net|org|io|vn|edu|gov|co)(\.[a-z]{2})?)/i);
  if (domainMatch) return `https://${domainMatch[0]}`;

  // Case 3: Fallback — dùng title nguyên để AI vẫn hiểu context
  // Gửi https://context.ai/... với query là title (BE validation cho phép URL)
  const encoded = encodeURIComponent(title.split(" - ")[0].trim());
  return `https://www.google.com/search?q=${encoded}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAiPanel(): UseAiPanelReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UrlAnalysisResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Giữ URL đang phân tích để tránh double-call khi user bấm cùng 1 event
  const analyzingUrlRef = useRef<string | null>(null);

  const openPanel = useCallback(async (url: string, title: string) => {
    // Nếu đã mở cùng URL → không làm gì
    if (isOpen && activeUrl === url) return;

    setIsOpen(true);
    setActiveUrl(url);
    setActiveTitle(title);
    setMessages([]);
    setAnalysis(null);
    setError(null);

    // Tránh gọi API trùng
    if (analyzingUrlRef.current === url) return;
    analyzingUrlRef.current = url;

    setIsAnalyzing(true);
    try {
      const result = await aiService.analyzeUrl(url);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể phân tích URL này");
    } finally {
      setIsAnalyzing(false);
      analyzingUrlRef.current = null;
    }
  }, [isOpen, activeUrl]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Reset state sau animation đóng (300ms)
    setTimeout(() => {
      setActiveUrl(null);
      setActiveTitle(null);
      setAnalysis(null);
      setMessages([]);
      setError(null);
    }, 300);
  }, []);

  const sendMessage = useCallback(async (msg: string) => {
    if (!activeUrl || !msg.trim()) return;

    // Thêm tin nhắn của user ngay lập tức (optimistic UI)
    const userMsg: ChatMessage = { role: "user", content: msg.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsChatting(true);

    try {
      const result = await aiService.chat(activeUrl, msg.trim());
      // Lấy tin nhắn AI mới nhất từ history
      const aiMsg: ChatMessage = { role: "ai", content: result.reply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "ai",
        content: "⚠️ Xảy ra lỗi khi kết nối AI. Vui lòng thử lại.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatting(false);
    }
  }, [activeUrl]);

  return {
    isOpen,
    activeUrl,
    activeTitle,
    analysis,
    messages,
    isAnalyzing,
    isChatting,
    error,
    openPanel,
    closePanel,
    sendMessage,
  };
}
