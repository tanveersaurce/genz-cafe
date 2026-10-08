import { apiClient, setAccessToken } from '@/lib/apiClient';
import { AuthUser } from '@/lib/authContext';

export interface PinUser {
  id: string;
  name: string;
  username: string;
  role: string;
  avatarUrl?: string;
}

export const pinAuthService = {
  async getPinUsers(): Promise<PinUser[]> {
    const res = await apiClient.get<{ success: boolean; data: { users: PinUser[] } }>('/auth/pin/users');
    return res.data.users;
  },

  async loginWithPin(input: { userId: string; pin: string }): Promise<{ user: AuthUser; accessToken: string }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { user: AuthUser; accessToken: string };
    }>('/auth/pin/login', input);

    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  async setLoginPin(input: { currentPassword: string; pin: string }): Promise<void> {
    await apiClient.post('/auth/login-pin', input);
  },
};
