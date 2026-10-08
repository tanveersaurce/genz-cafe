import { apiClient } from '../lib/apiClient';

export interface QrOrderingSetting {
  enabled: boolean;
  pauseMessage?: string;
}

export const settingsService = {
  async getQrOrderingStatus(): Promise<QrOrderingSetting> {
    const res = await apiClient.get<{ success: boolean; data: QrOrderingSetting }>(
      '/settings/qr-ordering'
    );
    return res.data;
  },

  async updateQrOrderingStatus(enabled: boolean, message?: string): Promise<QrOrderingSetting> {
    const res = await apiClient.patch<{ success: boolean; data: QrOrderingSetting }>(
      '/settings/qr-ordering',
      { enabled, message }
    );
    return res.data;
  },
};
