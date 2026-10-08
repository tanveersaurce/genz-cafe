import { apiClient } from '@/lib/apiClient';
import {
  Order,
  TableOccupancy,
  CreateOrderInput,
  AddOrderItemsInput,
  SettleOrderInput,
  OrderStatus,
  OrderItemStatus,
} from '@/types/orders';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const orderService = {
  async getActiveTablesOccupancy(): Promise<TableOccupancy[]> {
    const res = await apiClient.get<ApiResponse<{ tables: TableOccupancy[] }>>('/orders/active-tables');
    return res.data.tables;
  },

  async getOrders(params?: {
    status?: OrderStatus;
    type?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[]; pagination: { total: number; page: number; pages: number } }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<{ orders: Order[]; pagination: { total: number; page: number; pages: number } }>>(`/orders${qs}`);
    return res.data;
  },

  async getOrderById(orderId: string): Promise<Order> {
    const res = await apiClient.get<ApiResponse<{ order: Order }>>(`/orders/${orderId}`);
    return res.data.order;
  },

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const res = await apiClient.post<ApiResponse<{ order: Order }>>('/orders', input);
    return res.data.order;
  },

  async addItemsToOrder(orderId: string, input: AddOrderItemsInput): Promise<Order> {
    const res = await apiClient.post<ApiResponse<{ order: Order }>>(`/orders/${orderId}/items`, input);
    return res.data.order;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<Order> {
    const res = await apiClient.patch<ApiResponse<{ order: Order }>>(`/orders/${orderId}/status`, {
      status,
      reason,
    });
    return res.data.order;
  },

  async updateItemStatus(orderId: string, itemId: string, status: OrderItemStatus): Promise<Order> {
    const res = await apiClient.patch<ApiResponse<{ order: Order }>>(`/orders/${orderId}/items/${itemId}/status`, {
      status,
    });
    return res.data.order;
  },

  async settleOrder(orderId: string, input: SettleOrderInput): Promise<Order> {
    const res = await apiClient.post<ApiResponse<{ order: Order }>>(`/orders/${orderId}/settle`, input);
    return res.data.order;
  },

  async cancelOrder(orderId: string, reason: string): Promise<Order> {
    const res = await apiClient.post<ApiResponse<{ order: Order }>>(`/orders/${orderId}/cancel`, {
      reason,
    });
    return res.data.order;
  },
};
