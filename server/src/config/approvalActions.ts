import { Permission } from '../modules/auth/permissions';

export const APPROVABLE_ACTIONS = [
  'discount.apply',
  'order.item_cancel_after_kot',
  'bill.void',
  'cash.out_large',
] as const;

export type ApprovableAction = (typeof APPROVABLE_ACTIONS)[number];

export interface ApprovableActionConfig {
  action: ApprovableAction;
  description: string;
  requiredPermission: Permission;
}

export const APPROVAL_ACTION_CONFIGS: Record<ApprovableAction, ApprovableActionConfig> = {
  'discount.apply': {
    action: 'discount.apply',
    description: 'Apply manager discount to order',
    requiredPermission: 'orders:discount',
  },
  'order.item_cancel_after_kot': {
    action: 'order.item_cancel_after_kot',
    description: 'Cancel line item sent to kitchen',
    requiredPermission: 'orders:cancel',
  },
  'bill.void': {
    action: 'bill.void',
    description: 'Void issued tax bill / invoice',
    requiredPermission: 'billing:void',
  },
  'cash.out_large': {
    action: 'cash.out_large',
    description: 'Authorise cash withdrawal above ₹2,000',
    requiredPermission: 'cash:record',
  },
};

export const approvalSettings = {
  tokenTtlSeconds: 120, // 2 minutes one-time token validity
  maxFailedAttempts: 5, // 5 failed attempts locks approver
  lockoutMinutes: 15, // 15 minutes lockout
};
