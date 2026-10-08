import { z } from 'zod';
import { CASH_MOVEMENT_CATEGORIES, CASH_MOVEMENT_TYPES } from './models/cashMovement.model';

export const createCashMovementSchema = z.object({
  type: z.enum(CASH_MOVEMENT_TYPES as unknown as [string, ...string[]]),
  amount: z
    .number()
    .int('Amount in paise must be an integer')
    .positive('Amount must be greater than zero'),
  category: z.enum(CASH_MOVEMENT_CATEGORIES as unknown as [string, ...string[]]),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
  note: z.string().trim().optional(),
  approvalToken: z.string().optional(),
});

export const reverseCashMovementSchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason is mandatory and must be at least 3 characters'),
});
