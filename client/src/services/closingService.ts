import { apiClient } from '@/lib/apiClient';
import { CashMovement } from './cashService';

export interface ClosingPreviewData {
  localDate: string;
  isBlindCount: boolean;
  isAlreadyClosed: boolean;
  openingCash: number;
  cashIn: number;
  cashOut: number;
  movements: CashMovement[];
  openOrders: Array<{ id: string; orderNo: string; tableNumber?: number; type: string }>;
  unpaidBills: Array<{ id: string; invoiceNo: string; grandTotal: number }>;
  supportedDenominations: number[];
  differenceTolerancePaise: number;
  expected?: {
    openingCash: number;
    cashSales: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
  };
  salesSummary?: {
    grossSales: number;
    discounts: number;
    netSales: number;
    totalTax: number;
    roundOff: number;
    billsCount: number;
    dineInOrdersCount: number;
    takeawayOrdersCount: number;
    voidBillsCount: number;
    cancelledItemsCount: number;
  };
}

export interface SubmitClosingInput {
  localDate: string;
  openingCash?: number;
  openingCashReason?: string;
  countedCash: number;
  denominations?: Record<string, number>;
  cashRetained: number;
  cashHandedOver: number;
  reportedUpi?: number;
  reportedCard?: number;
  note?: string;
  overrideOpenOrders?: boolean;
  overrideReason?: string;
}

export interface DailyClosingRecord {
  _id: string;
  localDate: string;
  status: 'closed' | 'reopened';
  openingCash: number;
  countedCash: number;
  cashRetained: number;
  cashHandedOver: number;
  expected: {
    openingCash: number;
    cashSales: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
  };
  difference: number;
  reportedUpi?: number;
  reportedCard?: number;
  salesSummary: {
    grossSales: number;
    discounts: number;
    netSales: number;
    totalTax: number;
    roundOff: number;
    billsCount: number;
    dineInOrdersCount: number;
    takeawayOrdersCount: number;
    voidBillsCount: number;
    cancelledItemsCount: number;
  };
  denominations?: Record<string, number>;
  note?: string;
  closedBy: {
    _id: string;
    name: string;
    username: string;
  };
  closedAt: string;
  reopenHistory: Array<{
    by: {
      _id: string;
      name: string;
      username: string;
    };
    at: string;
    reason: string;
    previousSnapshot: {
      countedCash: number;
      expectedCash: number;
      difference: number;
      cashRetained: number;
      cashHandedOver: number;
      closedAt: string;
    };
  }>;
}

export const closingService = {
  async getPreview(date?: string): Promise<ClosingPreviewData> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiClient.get<{ success: boolean; data: ClosingPreviewData }>(
      `/closing/preview${qs}`
    );
    return res.data;
  },

  async submitClosing(input: SubmitClosingInput): Promise<DailyClosingRecord> {
    const res = await apiClient.post<{ success: boolean; data: { closing: DailyClosingRecord } }>(
      '/closing',
      input
    );
    return res.data.closing;
  },

  async listClosings(params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ closings: DailyClosingRecord[]; pagination: { total: number; page: number; pages: number } }> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<{
      success: boolean;
      data: { closings: DailyClosingRecord[]; pagination: { total: number; page: number; pages: number } };
    }>(`/closing${qs}`);
    return res.data;
  },

  async getClosingByDate(localDate: string): Promise<DailyClosingRecord> {
    const res = await apiClient.get<{ success: boolean; data: { closing: DailyClosingRecord } }>(
      `/closing/${localDate}`
    );
    return res.data.closing;
  },

  async reopenClosing(localDate: string, reason: string): Promise<DailyClosingRecord> {
    const res = await apiClient.post<{ success: boolean; data: { closing: DailyClosingRecord } }>(
      `/closing/${localDate}/reopen`,
      { reason }
    );
    return res.data.closing;
  },
};
