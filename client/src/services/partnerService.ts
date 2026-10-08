import { apiClient } from '@/lib/apiClient';

export interface Partner {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  pan?: string;
  bankDetails?: {
    accountNo?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  };
  isActive: boolean;
  notes?: string;
}

export interface PartnerSummaryItem {
  partner: Partner;
  totalCredits: number;
  totalDebits: number;
  netBalance: number;
}

export interface PartnerShareSchedule {
  _id: string;
  effectiveFrom: string;
  shares: Array<{
    partnerId: { _id: string; name: string; email?: string } | string;
    basisPoints: number;
  }>;
  notes?: string;
}

export interface CapitalEntry {
  _id: string;
  partnerId: { _id: string; name: string };
  type: 'contribution' | 'capital_return';
  amount: number;
  effectiveDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  isReversed: boolean;
}

export interface PartnerWithdrawal {
  _id: string;
  partnerId: { _id: string; name: string };
  amount: number;
  paymentMethod: string;
  effectiveDate: string;
  status: 'recorded' | 'reversed';
  reference?: string;
  notes?: string;
}

export interface LedgerEntry {
  _id: string;
  entryDate: string;
  type: string;
  debit: number;
  credit: number;
  balance?: number;
  description: string;
  referenceType?: string;
  createdAt: string;
}

export interface PartnerLedgerResponse {
  partner: Partner;
  entries: LedgerEntry[];
  summary: {
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
  };
}

export const partnerService = {
  async listPartners(): Promise<Partner[]> {
    const res = await apiClient.get<{ success: boolean; data: Partner[] }>('/partners');
    return res.data;
  },

  async getSummary(): Promise<PartnerSummaryItem[]> {
    const res = await apiClient.get<{ success: boolean; data: PartnerSummaryItem[] }>('/partners/summary');
    return res.data;
  },

  async getPartner(id: string): Promise<Partner> {
    const res = await apiClient.get<{ success: boolean; data: Partner }>(`/partners/${id}`);
    return res.data;
  },

  async createPartner(data: {
    name: string;
    email?: string;
    phone?: string;
    pan?: string;
    bankDetails?: { accountNo?: string; ifsc?: string; bankName?: string; upiId?: string };
    notes?: string;
  }): Promise<Partner> {
    const res = await apiClient.post<{ success: boolean; data: Partner }>('/partners', data);
    return res.data;
  },

  async updatePartner(id: string, data: Partial<Partner>): Promise<Partner> {
    const res = await apiClient.patch<{ success: boolean; data: Partner }>(`/partners/${id}`, data);
    return res.data;
  },

  async getCurrentShares(date?: string): Promise<PartnerShareSchedule | null> {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get<{ success: boolean; data: PartnerShareSchedule | null }>(
      `/partners/shares/current${query}`
    );
    return res.data;
  },

  async listShareSchedules(): Promise<PartnerShareSchedule[]> {
    const res = await apiClient.get<{ success: boolean; data: PartnerShareSchedule[] }>('/partners/shares/history');
    return res.data;
  },

  async createShareSchedule(data: {
    effectiveFrom: string;
    shares: Array<{ partnerId: string; basisPoints: number }>;
    notes?: string;
  }): Promise<PartnerShareSchedule> {
    const res = await apiClient.post<{ success: boolean; data: PartnerShareSchedule }>('/partners/shares', data);
    return res.data;
  },

  async listCapitalEntries(partnerId?: string): Promise<CapitalEntry[]> {
    const query = partnerId ? `?partnerId=${partnerId}` : '';
    const res = await apiClient.get<{ success: boolean; data: CapitalEntry[] }>(`/partners/capital${query}`);
    return res.data;
  },

  async createCapitalEntry(data: {
    partnerId: string;
    type: 'contribution' | 'capital_return';
    amount: number;
    effectiveDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  }): Promise<CapitalEntry> {
    const res = await apiClient.post<{ success: boolean; data: CapitalEntry }>('/partners/capital', data);
    return res.data;
  },

  async reverseCapitalEntry(id: string, reason: string): Promise<CapitalEntry> {
    const res = await apiClient.post<{ success: boolean; data: CapitalEntry }>(
      `/partners/capital/${id}/reverse`,
      { reason }
    );
    return res.data;
  },

  async listWithdrawals(partnerId?: string): Promise<PartnerWithdrawal[]> {
    const query = partnerId ? `?partnerId=${partnerId}` : '';
    const res = await apiClient.get<{ success: boolean; data: PartnerWithdrawal[] }>(
      `/partners/withdrawals${query}`
    );
    return res.data;
  },

  async createWithdrawal(data: {
    partnerId: string;
    amount: number;
    paymentMethod: string;
    effectiveDate: string;
    reference?: string;
    notes?: string;
  }): Promise<{ withdrawal: PartnerWithdrawal; warning?: string }> {
    const res = await apiClient.post<{ success: boolean; data: PartnerWithdrawal; warning?: string }>(
      '/partners/withdrawals',
      data
    );
    return { withdrawal: res.data, warning: res.warning };
  },

  async reverseWithdrawal(id: string, reason: string): Promise<PartnerWithdrawal> {
    const res = await apiClient.post<{ success: boolean; data: PartnerWithdrawal }>(
      `/partners/withdrawals/${id}/reverse`,
      { reason }
    );
    return res.data;
  },

  async getPartnerLedger(partnerId: string, from?: string, to?: string): Promise<PartnerLedgerResponse> {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const res = await apiClient.get<{ success: boolean; data: PartnerLedgerResponse }>(
      `/partners/${partnerId}/ledger?${query.toString()}`
    );
    return res.data;
  },
};
