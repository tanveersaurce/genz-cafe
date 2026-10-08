import { apiClient } from '@/lib/apiClient';

export interface Approver {
  id: string;
  name: string;
}

export interface RequestApprovalInput {
  approverId: string;
  pin: string;
  action: 'discount.apply' | 'order.item_cancel_after_kot' | 'bill.void' | 'cash.out_large';
  entityId: string;
  params?: unknown;
}

export interface ApprovalResponse {
  approvalToken: string;
  expiresAt: string;
}

export const approvalService = {
  async getApprovers(): Promise<Approver[]> {
    const res = await apiClient.get<{ success: boolean; data: Approver[] }>('/approvals/approvers');
    return res.data;
  },

  async requestApproval(input: RequestApprovalInput): Promise<ApprovalResponse> {
    const res = await apiClient.post<{ success: boolean; data: ApprovalResponse }>('/approvals', input);
    return res.data;
  },

  async setApprovalPin(input: { currentPassword: string; pin: string }): Promise<void> {
    await apiClient.post('/auth/approval-pin', input);
  },
};
