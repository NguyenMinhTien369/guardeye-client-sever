// ===== User =====
export interface User {
  id: string;
  name: string;
  email: string;
  notificationEmail: string | null;
  notifications: {
    email: boolean;
    browser: boolean;
  };
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Request DTOs =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  notificationEmail?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ===== Response DTOs =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export interface LoginResponseData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponseData {
  user: User;
  message: string;
}

export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
}

export interface ValidationErrors {
  [field: string]: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  errorCode?: string;
  errors?: ValidationErrors;
}

// ===== Auth Context =====
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (data: ResetPasswordRequest) => Promise<string>;
}
