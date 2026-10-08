import { apiClient } from '@/lib/apiClient';

export interface StatementAllocation {
  partnerId: string;
  partnerNameSnapshot: string;
  basisPoints: number;
  amount: number;
}

export interface StatementPreCheckResponse {
  isFinalized: boolean;
  canFinalize: boolean;
  issues: string[];
  unclosedDates: string[];
  openOrdersCount: number;
  unpaidBillsCount: number;
}

export interface MonthlyStatement {
  _id: string;
  month: string;
  status: 'draft' | 'finalized' | 'reopened';
  version: number;
  statementNo: string;
  totals: {
    grossSales: number;
    discounts: number;
    netRevenue: number;
    totalTax: number;
    directCosts: number;
    operatingExpenses: number;
    netProfit: number;
  };
  retainedAmount: number;
  distributableAmount: number;
  allocations: StatementAllocation[];
  checksum: string;
  finalizedAt?: string;
  finalizedBy?: { _id: string; name: string };
  createdAt: string;
}

export interface StatementPreview {
  month: string;
  pnl: unknown;
  schedule: unknown;
  retainedAmount: number;
  distributableAmount: number;
  allocations: StatementAllocation[];
}

export const statementService = {
  async listStatements(): Promise<MonthlyStatement[]> {
    const res = await apiClient.get<{ success: boolean; data: MonthlyStatement[] }>('/statements');
    return res.data;
  },

  async getStatement(month: string): Promise<MonthlyStatement> {
    const res = await apiClient.get<{ success: boolean; data: MonthlyStatement }>(`/statements/${month}`);
    return res.data;
  },

  async getPreChecks(month: string): Promise<StatementPreCheckResponse> {
    const res = await apiClient.get<{ success: boolean; data: StatementPreCheckResponse }>(
      `/statements/${month}/prechecks`
    );
    return res.data;
  },

  async previewStatement(month: string, retainedAmount = 0): Promise<StatementPreview> {
    const res = await apiClient.get<{ success: boolean; data: StatementPreview }>(
      `/statements/${month}/preview?retainedAmount=${retainedAmount}`
    );
    return res.data;
  },

  async finalizeStatement(data: {
    month: string;
    retainedAmount?: number;
    overridePrechecks?: boolean;
    overrideReason?: string;
  }): Promise<MonthlyStatement> {
    const res = await apiClient.post<{ success: boolean; data: MonthlyStatement }>(
      `/statements/${data.month}/finalize`,
      data
    );
    return res.data;
  },

  async reopenStatement(month: string, reason: string): Promise<MonthlyStatement> {
    const res = await apiClient.post<{ success: boolean; data: MonthlyStatement }>(
      `/statements/${month}/reopen`,
      { reason }
    );
    return res.data;
  },

  getPdfUrl(month: string): string {
    return `/api/statements/${month}/pdf`;
  },
};
