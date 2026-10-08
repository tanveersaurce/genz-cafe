import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createPartnerSchema = z.object({
  name: z.string().min(2, 'Partner name must be at least 2 characters'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  userId: z.string().regex(objectIdRegex).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
  bankDetails: z
    .object({
      accountNo: z.string().optional(),
      ifsc: z.string().optional(),
      bankName: z.string().optional(),
      upiId: z.string().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
});

export const updatePartnerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  userId: z.string().regex(objectIdRegex).optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
  bankDetails: z
    .object({
      accountNo: z.string().optional(),
      ifsc: z.string().optional(),
      bankName: z.string().optional(),
      upiId: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const createShareScheduleSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-01$/, 'Effective from must be the 1st of the month (YYYY-MM-01)'),
  shares: z
    .array(
      z.object({
        partnerId: z.string().regex(objectIdRegex),
        basisPoints: z.number().int().min(0).max(10000),
      })
    )
    .min(1, 'At least one partner share required')
    .refine(
      (shares) => shares.reduce((acc, s) => acc + s.basisPoints, 0) === 10000,
      {
        message: 'Sum of share basis points must be exactly 10,000 (100.00%)',
      }
    ),
  notes: z.string().max(500).optional(),
});

export const createCapitalEntrySchema = z.object({
  partnerId: z.string().regex(objectIdRegex),
  type: z.enum(['contribution', 'capital_return']),
  amount: z.number().int().positive('Amount must be positive integer paise'),
  effectiveDate: z.string().regex(dateRegex),
  paymentMethod: z.enum(['bank_transfer', 'upi', 'cash_drawer', 'cheque', 'other']),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const reverseCapitalEntrySchema = z.object({
  reason: z.string().min(3, 'Reversal reason is required'),
});

export const createWithdrawalSchema = z.object({
  partnerId: z.string().regex(objectIdRegex),
  amount: z.number().int().positive('Amount must be positive integer paise'),
  paymentMethod: z.enum(['bank_transfer', 'upi', 'cash_drawer']),
  effectiveDate: z.string().regex(dateRegex),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const reverseWithdrawalSchema = z.object({
  reason: z.string().min(3, 'Reversal reason is required'),
});
