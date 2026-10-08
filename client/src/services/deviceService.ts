import { apiClient } from '@/lib/apiClient';

export interface TrustedDevice {
  _id: string;
  name: string;
  registeredBy: {
    _id: string;
    name: string;
  };
  registeredAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export const deviceService = {
  async listDevices(): Promise<TrustedDevice[]> {
    const res = await apiClient.get<{ success: boolean; data: TrustedDevice[] }>('/devices');
    return res.data;
  },

  async registerDevice(input: { name: string; password: string }): Promise<TrustedDevice> {
    const res = await apiClient.post<{ success: boolean; data: TrustedDevice }>('/devices', input);
    return res.data;
  },

  async revokeDevice(id: string): Promise<void> {
    await apiClient.post(`/devices/${id}/revoke`);
  },
};
