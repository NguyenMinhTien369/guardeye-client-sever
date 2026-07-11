export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export const AUTH_ENDPOINTS = {
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  LOGOUT: "/auth/logout",
  REFRESH_TOKEN: "/auth/refresh-token",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  VERIFY_EMAIL: "/auth/verify-email",
} as const;

export const TOKEN_KEYS = {
  ACCESS_TOKEN: "guardeye_access_token",
  REFRESH_TOKEN: "guardeye_refresh_token",
  USER: "guardeye_user",
} as const;

export const CHILDREN_ENDPOINTS = {
  BASE: "/children",
  BY_ID: (id: string) => `/children/${id}`,
} as const;

export const DEVICES_ENDPOINTS = {
  BASE: "/devices",
  BY_CHILD: (childId: string) => `/children/${childId}/devices`,
  PAUSE: (id: string) => `/devices/${id}/pause`,
  RESUME: (id: string) => `/devices/${id}/resume`,
  BY_ID: (id: string) => `/devices/${id}`,
} as const;

export const DASHBOARD_ENDPOINTS = {
  ACTIVITY:    (deviceId: string) => `/dashboard/device/${deviceId}/activity`,
  SCREENSHOTS: (deviceId: string) => `/screenshots/device/${deviceId}`,
} as const;

export const AI_ENDPOINTS = {
  ANALYZE_URL: "/ai/analyze-url",
  CHAT:        "/ai/chat",
} as const;
