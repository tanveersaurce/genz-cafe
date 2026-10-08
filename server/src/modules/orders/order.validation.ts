import { z } from 'zod';

export const createOrderSchema = z.object({
  type: z.enum(['dine_in', 'takeaway']),
  tableId: z.string().optional(),
  reservationId: z.string().optional(),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().optional(),
}).refine(
  (data) => {
    if (data.type === 'dine_in' && !data.tableId) {
      return false;
    }
    return true;
  },
  {
    message: 'tableId is required for dine-in orders',
    path: ['tableId'],
  }
);

export const addItemsSchema = z.object({
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, 'menuItemId is required'),
        variantName: z.string().trim().optional(),
        qty: z
          .number()
          .int('Quantity must be an integer')
          .min(1, 'Minimum quantity is 1')
          .max(50, 'Maximum quantity per line is 50'),
        note: z.string().trim().max(100, 'Note cannot exceed 100 characters').optional(),
      })
    )
    .min(1, 'At least one item is required')
    .max(60, 'Cannot exceed 60 items in a single request'),
});

export const updateItemSchema = z.object({
  qty: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Minimum quantity is 1')
    .max(50, 'Maximum quantity per line is 50')
    .optional(),
  note: z.string().trim().max(100, 'Note cannot exceed 100 characters').optional(),
});

export const cancelItemSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters'),
  approvalToken: z.string().optional(),
});

export const transferOrderSchema = z.object({
  toTableId: z.string().min(1, 'toTableId is required'),
});

export const applyDiscountSchema = z.object({
  type: z.enum(['flat', 'percent']),
  value: z.number().min(0, 'Discount value must be non-negative'),
  reason: z.string().trim().min(3, 'Discount reason is mandatory and must be at least 3 characters'),
  approvalToken: z.string().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is mandatory and must be at least 3 characters'),
});

export const reopenOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Reopen reason is mandatory and must be at least 3 characters'),
});

export const recordPaymentSchema = z.object({
  method: z.enum(['cash', 'upi', 'card', 'other']),
  amount: z.number().int('Payment amount must be an integer').min(1, 'Payment amount must be positive'),
  reference: z.string().trim().max(40, 'Reference cannot exceed 40 characters').optional(),
  idempotencyKey: z.string().optional(),
});

export const voidBillSchema = z.object({
  reason: z.string().trim().min(3, 'Void reason is mandatory and must be at least 3 characters'),
  approvalToken: z.string().optional(),
});

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason is mandatory and must be at least 3 characters'),
});
