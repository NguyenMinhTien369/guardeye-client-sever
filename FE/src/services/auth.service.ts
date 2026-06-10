import api from "./api";
import { AUTH_ENDPOINTS } from "../constants/api";
import type {
  ApiResponse,
  LoginRequest,
  LoginResponseData,
  RegisterRequest,
  RegisterResponseData,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  RefreshTokenResponseData,
} from "../types/auth.types";

export const authService = {
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
    const response = await api.post<ApiResponse<LoginResponseData>>(
      AUTH_ENDPOINTS.LOGIN,
      data
    );
    return response.data;
  },

  async register(
    data: RegisterRequest
  ): Promise<ApiResponse<RegisterResponseData>> {
    const response = await api.post<ApiResponse<RegisterResponseData>>(
      AUTH_ENDPOINTS.REGISTER,
      data
    );
    return response.data;
  },

  async logout(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(AUTH_ENDPOINTS.LOGOUT);
    return response.data;
  },

  async refreshToken(
    data: RefreshTokenRequest
  ): Promise<ApiResponse<RefreshTokenResponseData>> {
    const response = await api.post<ApiResponse<RefreshTokenResponseData>>(
      AUTH_ENDPOINTS.REFRESH_TOKEN,
      data
    );
    return response.data;
  },

  async forgotPassword(
    data: ForgotPasswordRequest
  ): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(
      AUTH_ENDPOINTS.FORGOT_PASSWORD,
      data
    );
    return response.data;
  },

  async resetPassword(
    data: ResetPasswordRequest
  ): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(
      AUTH_ENDPOINTS.RESET_PASSWORD,
      data
    );
    return response.data;
  },
};
