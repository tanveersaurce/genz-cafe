import { apiClient } from '../lib/apiClient';

export interface PendingCustomerOrder {
  submissionId: string;
  orderId: string;
  tableNumber: number;
  customerName: string;
  customerPhone?: string;
  itemCount: number;
  kotStatus: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  createdAt: string;
}

export const customerOrderService = {
  async getPending(): Promise<PendingCustomerOrder[]> {
    const res = await apiClient.get<{ success: boolean; data: { orders: PendingCustomerOrder[] } }>(
      '/pos/customer-orders/pending'
    );
    return res.data?.orders ?? [];
  },

  async acknowledge(submissionId: string): Promise<boolean> {
    const res = await apiClient.post<{ success: boolean }>(
      `/pos/customer-orders/${encodeURIComponent(submissionId)}/acknowledge`
    );
    return res.success;
  },
};
