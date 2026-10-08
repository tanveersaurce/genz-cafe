import { apiClient } from '@/lib/apiClient';

export interface CashMovement {
  _id: string;
  localDate: string;
  type: 'in' | 'out';
  amount: number; // in integer paise
  category: 'float_in' | 'purchase' | 'staff_advance' | 'owner_withdrawal' | 'other';
  reason: string;
  note?: string;
  recordedBy: {
    _id: string;
    name: string;
    username: string;
  };
  recordedAt: string;
  status: 'recorded' | 'reversed';
  reversedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  reversedAt?: string;
  reverseReason?: string;
}

export interface CreateCashMovementInput {
  type: 'in' | 'out';
  amount: number;
  category: 'float_in' | 'purchase' | 'staff_advance' | 'owner_withdrawal' | 'other';
  reason: string;
  note?: string;
  approvalToken?: string;
}

export const cashService = {
  async getMovements(date?: string): Promise<CashMovement[]> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiClient.get<{ success: boolean; data: { movements: CashMovement[] } }>(
      `/cash-movements${qs}`
    );
    return res.data.movements;
  },

  async createMovement(input: CreateCashMovementInput): Promise<CashMovement> {
    const res = await apiClient.post<{ success: boolean; data: { movement: CashMovement } }>(
      '/cash-movements',
      input
    );
    return res.data.movement;
  },

  async reverseMovement(id: string, reason: string): Promise<CashMovement> {
    const res = await apiClient.post<{ success: boolean; data: { movement: CashMovement } }>(
      `/cash-movements/${id}/reverse`,
      { reason }
    );
    return res.data.movement;
  },
};
