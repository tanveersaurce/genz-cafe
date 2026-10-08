import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Role, Permission } from './permissions';
import { apiClient, setAccessToken, setOnAuthFailure } from './apiClient';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  phone?: string;
  mustChangePassword: boolean;
  permissions: readonly Permission[];
}

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: AuthUser;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  loginWithPin?: (userId: string, pin: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignored on logout failure
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // Silent refresh on initial page load / mount
  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null);
      setAccessToken(null);
    });

    const initializeAuth = async () => {
      try {
        const res = await apiClient.post<AuthResponse>('/auth/refresh');
        if (res.success && res.data) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch {
        // Unauthenticated session on boot (not logged in or session expired)
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<AuthUser> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { username, password });
    if (!res.success || !res.data) {
      throw new Error('Invalid login response');
    }

    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginWithPin = async (userId: string, pin: string): Promise<AuthUser> => {
    const res = await apiClient.post<AuthResponse>('/auth/pin/login', { userId, pin });
    if (!res.success || !res.data) {
      throw new Error('Invalid PIN login response');
    }

    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  };

  const refreshUser = async (): Promise<void> => {
    const res = await apiClient.get<{ success: boolean; data: { user: AuthUser } }>('/auth/me');
    if (res.success && res.data) {
      setUser(res.data.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        loginWithPin,
        logout,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
