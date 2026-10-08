import { apiClient } from '@/lib/apiClient';

export interface PnlReport {
  range: { from: string; to: string };
  revenue: {
    grossSales: number;
    discounts: number;
    netRevenue: number;
    gstCollected: number;
    roundOff: number;
    totalBilled: number;
  };
  directCosts: {
    total: number;
    cogsPurchases: number;
  };
  grossProfit: number;
  grossMarginBasisPoints: number;
  operatingExpenses: {
    total: number;
    byType: Record<string, number>;
    byCategory: Array<{ name: string; type: string; amount: number }>;
  };
  operatingProfit: number;
  nonOperatingExpenses: {
    total: number;
    byCategory: Array<{ name: string; amount: number }>;
  };
  netProfit: number;
  unpaidSupplierCredit: number;
}

export interface MonthlyTrendItem {
  month: string;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  marginBps: number;
}

export const financeService = {
  async getPnl(params?: { from?: string; to?: string; month?: string }): Promise<PnlReport> {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);

    const res = await apiClient.get<{ success: boolean; data: PnlReport }>(
      `/finance/pnl?${query.toString()}`
    );
    return res.data;
  },

  async getTrend(year?: number): Promise<MonthlyTrendItem[]> {
    const query = year ? `?year=${year}` : '';
    const res = await apiClient.get<{ success: boolean; data: MonthlyTrendItem[] }>(
      `/finance/pnl/trend${query}`
    );
    return res.data;
  },

  getExportUrl(params?: { from?: string; to?: string; month?: string }): string {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return `/api/finance/pnl/export?${query.toString()}`;
  },
};
