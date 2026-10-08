import { z } from 'zod';
import { TABLE_ZONES } from './table.model';

export const createTableSchema = z.object({
  number: z.number().int().min(1).max(99),
  label: z.string().trim().max(50).optional(),
  capacity: z.number().int().min(1).max(20),
  zone: z.enum(TABLE_ZONES).default('indoor'),
  isReservable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().trim().max(300).optional(),
});

export const updateTableSchema = z.object({
  label: z.string().trim().max(50).optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  zone: z.enum(TABLE_ZONES).optional(),
  isReservable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().trim().max(300).optional(),
});

export const toggleTableStatusSchema = z.object({
  isActive: z.boolean(),
});
