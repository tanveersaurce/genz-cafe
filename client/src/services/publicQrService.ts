import { apiClient } from '../lib/apiClient';

export interface QrContextResponse {
  tableNumber: number;
  orderingEnabled: boolean;
  reason?: 'paused' | 'closed' | 'cutoff' | 'billed' | 'invalid_token';
  pauseMessage?: string;
}

export interface CustomerOrderLineItem {
  menuItemId: string;
  variantName?: string;
  qty: number;
  note?: string;
}

export interface SubmitCustomerOrderPayload {
  table: number;
  token: string;
  customerName: string;
  customerPhone?: string;
  lines: CustomerOrderLineItem[];
  idempotencyKey: string;
  honeypot?: string;
}

export interface SubmitCustomerOrderResponse {
  submissionId: string;
  statusToken: string;
  kotNo: string;
  items: Array<{
    nameSnapshot: string;
    variantName?: string;
    qty: number;
    note?: string;
  }>;
  undoUntil: string;
}

export interface CustomerOrderStatusResponse {
  submissionId: string;
  tableNumber: number;
  status: string;
  kotStatus: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  items: Array<{
    nameSnapshot: string;
    variantName?: string;
    qty: number;
    note?: string;
  }>;
  createdAt: string;
  undoUntil: string;
  undoAllowed: boolean;
  serverTime: string;
}

export const publicQrService = {
  async getContext(tableNumber: number, token?: string): Promise<QrContextResponse> {
    const res = await apiClient.get<{ success: boolean; data: QrContextResponse }>(
      `/public/qr/context?table=${tableNumber}${token ? `&t=${encodeURIComponent(token)}` : ''}`
    );
    return res.data;
  },

  async submitOrder(payload: SubmitCustomerOrderPayload): Promise<SubmitCustomerOrderResponse> {
    const res = await apiClient.post<{ success: boolean; data: SubmitCustomerOrderResponse }>(
      '/public/qr/orders',
      payload
    );
    return res.data;
  },

  async getStatus(statusToken: string): Promise<CustomerOrderStatusResponse> {
    const res = await apiClient.get<{ success: boolean; data: CustomerOrderStatusResponse }>(
      `/public/qr/status/${encodeURIComponent(statusToken)}`
    );
    return res.data;
  },

  async cancelOrder(statusToken: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/public/qr/status/${encodeURIComponent(statusToken)}/cancel`
    );
    return res;
  },
};
