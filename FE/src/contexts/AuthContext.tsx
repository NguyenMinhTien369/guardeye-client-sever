import { createContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { TOKEN_KEYS } from "../constants/api";
import { authService } from "../services/auth.service";
import type {
  AuthContextType,
  User,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "../types/auth.types";
import axios from "axios";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize — check stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(TOKEN_KEYS.USER);
    const accessToken = localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);

    if (storedUser && accessToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        clearStoredAuth();
      }
    }
    setIsLoading(false);
  }, []);

  const clearStoredAuth = () => {
    localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.USER);
    setUser(null);
  };

  const login = useCallback(async (data: LoginRequest): Promise<void> => {
    const response = await authService.login(data);
    const { user: userData, accessToken, refreshToken } = response.data!;

    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(TOKEN_KEYS.USER, JSON.stringify(userData));

    setUser(userData);
  }, []);

  const register = useCallback(
    async (data: RegisterRequest): Promise<string> => {
      const response = await authService.register(data);
      return response.data?.message || response.message;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      // Even if API call fails, clear local state
      if (axios.isAxiosError(error)) {
        console.warn("Logout API error:", error.response?.data?.message);
      }
    } finally {
      clearStoredAuth();
    }
  }, []);

  const forgotPassword = useCallback(
    async (email: string): Promise<string> => {
      const response = await authService.forgotPassword({ email });
      return response.message;
    },
    []
  );

  const resetPassword = useCallback(
    async (data: ResetPasswordRequest): Promise<string> => {
      const response = await authService.resetPassword(data);
      return response.message;
    },
    []
  );

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(TOKEN_KEYS.USER, JSON.stringify(updatedUser));
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
