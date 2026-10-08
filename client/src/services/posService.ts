import { apiClient } from '../lib/apiClient';
import {
  PosTable,
  PosOrder,
  PosBill,
  PosPayment,
  OrderDetailResponse,
} from '../types/pos';

export const posService = {
  // POS Table Map
  async getLiveTables(): Promise<PosTable[]> {
    const res = await apiClient.get<{ success: boolean; data: { tables: PosTable[] } }>(
      '/pos/tables'
    );
    return res.data.tables;
  },

  // Open Order
  async createOrder(data: {
    type: 'dine_in' | 'takeaway';
    tableId?: string;
    reservationId?: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<{
    order: PosOrder;
    matchedReservation?: {
      reservationId: string;
      customerName: string;
      partySize: number;
      startTime: string;
    } | null;
  }> {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        order: PosOrder;
        matchedReservation?: {
          reservationId: string;
          customerName: string;
          partySize: number;
          startTime: string;
        } | null;
      };
    }>('/orders', data);
    return res.data;
  },

  // Get Order Details
  async getOrderById(orderId: string): Promise<OrderDetailResponse> {
    const res = await apiClient.get<{ success: boolean; data: OrderDetailResponse }>(
      `/orders/${orderId}`
    );
    return res.data;
  },

  // List Orders (History)
  async getOrders(params?: {
    date?: string;
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    orders: PosOrder[];
    pagination: { total: number; page: number; pages: number };
  }> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await apiClient.get<{
      success: boolean;
      data: { orders: PosOrder[]; pagination: { total: number; page: number; pages: number } };
    }>(`/orders?${query.toString()}`);
    return res.data;
  },

  // Add Items to Order
  async addItems(
    orderId: string,
    data: {
      idempotencyKey: string;
      items: {
        menuItemId: string;
        variantName?: string;
        qty: number;
        note?: string;
      }[];
    }
  ): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/items`,
      data
    );
    return res.data.order;
  },

  // Update Draft Item
  async updateDraftItem(
    orderId: string,
    lineId: string,
    data: { qty?: number; note?: string }
  ): Promise<PosOrder> {
    const res = await apiClient.patch<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/items/${lineId}`,
      data
    );
    return res.data.order;
  },

  // Cancel Sent Item
  async cancelItem(orderId: string, lineId: string, reason: string): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/items/${lineId}/cancel`,
      { reason }
    );
    return res.data.order;
  },

  // Send KOT
  async sendKot(
    orderId: string
  ): Promise<{ order: PosOrder; kot: { kotId: string; kotNo: string } }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { order: PosOrder; kot: { kotId: string; kotNo: string } };
    }>(`/orders/${orderId}/send-kot`);
    return res.data;
  },

  // Transfer Table
  async transferTable(orderId: string, toTableId: string): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/transfer`,
      { toTableId }
    );
    return res.data.order;
  },

  // Apply Discount
  async applyDiscount(
    orderId: string,
    data: { type: 'flat' | 'percent'; value: number; reason: string }
  ): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/discount`,
      data
    );
    return res.data.order;
  },

  // Cancel Order
  async cancelOrder(orderId: string, reason: string): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/cancel`,
      { reason }
    );
    return res.data.order;
  },

  // Reopen Order
  async reopenOrder(orderId: string, reason: string): Promise<PosOrder> {
    const res = await apiClient.post<{ success: boolean; data: { order: PosOrder } }>(
      `/orders/${orderId}/reopen`,
      { reason }
    );
    return res.data.order;
  },

  // Generate Bill
  async generateBill(orderId: string): Promise<{ bill: PosBill; order: PosOrder }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { bill: PosBill; order: PosOrder };
    }>(`/orders/${orderId}/bill`);
    return res.data;
  },

  // Get Bill Details
  async getBillById(billId: string): Promise<{
    bill: PosBill;
    payments: PosPayment[];
    totalPaidPaise: number;
    balancePaise: number;
  }> {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        bill: PosBill;
        payments: PosPayment[];
        totalPaidPaise: number;
        balancePaise: number;
      };
    }>(`/bills/${billId}`);
    return res.data;
  },

  // Record Payment
  async recordPayment(
    billId: string,
    data: {
      method: 'cash' | 'upi' | 'card' | 'other';
      amount: number;
      reference?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ payment: PosPayment; bill: PosBill; isFullyPaid: boolean }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { payment: PosPayment; bill: PosBill; isFullyPaid: boolean };
    }>(`/bills/${billId}/payments`, data);
    return res.data;
  },

  // Void Bill
  async voidBill(billId: string, reason: string): Promise<{ bill: PosBill; order: PosOrder }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { bill: PosBill; order: PosOrder };
    }>(`/bills/${billId}/void`, { reason });
    return res.data;
  },

  // Reverse Payment
  async reversePayment(
    paymentId: string,
    reason: string
  ): Promise<{ payment: PosPayment; bill: PosBill }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { payment: PosPayment; bill: PosBill };
    }>(`/payments/${paymentId}/reverse`, { reason });
    return res.data;
  },
};
