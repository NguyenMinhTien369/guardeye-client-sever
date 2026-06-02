// src/dtos/auth.dto.ts

// -----------------------------------------------------------------------------
// AUTH DTO - Định nghĩa cấu trúc dữ liệu cho các luồng xác thực
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 1. REQUEST DTOs
// -----------------------------------------------------------------------------

export interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  notificationEmail?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

// -----------------------------------------------------------------------------
// 2. RESPONSE DTOs
// -----------------------------------------------------------------------------

// Thông tin User an toàn để trả về client — không chứa password hay token nhạy cảm
export interface UserResponseDto {
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
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterResponseDto {
  user: UserResponseDto;
  message: string;
}

export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}
