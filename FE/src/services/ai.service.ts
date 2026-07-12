import api from "./api";
import { AI_ENDPOINTS } from "../constants/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SafetyLevel = "Safe" | "Warning" | "Danger";

export interface UrlAnalysisResult {
  platformName: string;
  description: string;
  mainActivities: string[];
  safetyLevel: SafetyLevel;
  parentAdvice: string;
  cleanUrl: string;
}

export interface ChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  reply: string;
  history: ChatMessage[];
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const aiService = {
  /**
   * POST /ai/analyze-url
   * Phân tích URL/domain bằng AI — trả về thông tin an toàn cho phụ huynh.
   * Kết quả được cache ở BE, nên lần 2 gọi cùng URL sẽ nhanh hơn.
   */
  async analyzeUrl(url: string): Promise<UrlAnalysisResult> {
    const response = await api.post<ApiResponse<UrlAnalysisResult>>(
      AI_ENDPOINTS.ANALYZE_URL,
      { url }
    );
    return response.data.data;
  },

  /**
   * POST /ai/chat
   * Gửi câu hỏi về một URL cụ thể — AI trả lời dựa trên context của URL.
   * BE lưu lịch sử chat theo parentId + urlHash.
   */
  async chat(url: string, message: string): Promise<ChatResponse> {
    const response = await api.post<ApiResponse<ChatResponse>>(
      AI_ENDPOINTS.CHAT,
      { url, message }
    );
    return response.data.data;
  },
};
