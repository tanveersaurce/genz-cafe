import { z } from 'zod';

export const submitClosingSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be yyyy-MM-dd'),
  openingCash: z.number().int().min(0).optional(),
  openingCashReason: z.string().trim().optional(),
  countedCash: z.number().int('Counted cash must be an integer paise amount').min(0),
  denominations: z.record(z.string(), z.number().int().min(0)).optional(),
  cashRetained: z.number().int('Cash retained must be an integer paise amount').min(0),
  cashHandedOver: z.number().int('Cash handed over must be an integer paise amount').min(0),
  reportedUpi: z.number().int().min(0).optional(),
  reportedCard: z.number().int().min(0).optional(),
  note: z.string().trim().max(500).optional(),
  overrideOpenOrders: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
});

export const reopenClosingSchema = z.object({
  reason: z.string().trim().min(3, 'Reopen reason is mandatory and must be at least 3 characters'),
});
