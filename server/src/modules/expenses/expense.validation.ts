import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createExpenseSchema = z.object({
  expenseDate: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  categoryId: z.string().regex(objectIdRegex, 'Invalid category ID'),
  vendorId: z.string().regex(objectIdRegex, 'Invalid vendor ID').optional(),
  vendorName: z.string().optional(),
  amount: z.number().int().positive('Amount must be positive integer paise'),
  isPaid: z.boolean().default(true),
  paymentMethod: z
    .enum(['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'])
    .optional(),
  paidByPartnerId: z.string().regex(objectIdRegex, 'Invalid partner ID').optional(),
  reference: z.string().max(100).optional(),
  invoiceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  receiptUrl: z.string().url().optional(),
});

export const updateExpenseSchema = z.object({
  categoryId: z.string().regex(objectIdRegex, 'Invalid category ID').optional(),
  vendorId: z.string().regex(objectIdRegex, 'Invalid vendor ID').optional(),
  vendorName: z.string().optional(),
  amount: z.number().int().positive('Amount must be positive integer paise').optional(),
  invoiceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  receiptUrl: z.string().url().optional(),
});

export const voidExpenseSchema = z.object({
  reason: z.string().min(3, 'Void reason must be at least 3 characters'),
});

export const addPaymentSchema = z.object({
  method: z.enum(['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid']),
  amount: z.number().int().positive('Amount must be positive integer paise'),
  paidByPartnerId: z.string().regex(objectIdRegex, 'Invalid partner ID').optional(),
  reference: z.string().max(100).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum([
    'cogs_purchase',
    'operating',
    'payroll',
    'rent_utilities',
    'marketing',
    'maintenance',
    'other_operating',
    'non_operating',
  ]),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const createVendorSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  category: z.string().regex(objectIdRegex).optional(),
  gstin: z.string().max(15).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  defaultPaymentMethod: z
    .enum(['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'])
    .optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const createRecurringTemplateSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  categoryId: z.string().regex(objectIdRegex, 'Invalid category ID'),
  vendorId: z.string().regex(objectIdRegex, 'Invalid vendor ID').optional(),
  amount: z.number().int().positive('Amount must be positive integer paise'),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  paymentMethod: z
    .enum(['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'])
    .default('bank_transfer'),
  paidByPartnerId: z.string().regex(objectIdRegex, 'Invalid partner ID').optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});
