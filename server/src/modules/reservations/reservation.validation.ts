import { z } from 'zod';
import {
  RESERVATION_OCCASIONS,
  RESERVATION_SOURCES,
} from './models/reservation.model';

export const publicAvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  guests: z.coerce.number().int().min(1).max(20),
});

export const publicCreateReservationSchema = z.object({
  customerName: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  phone: z.string().trim().min(10, 'Valid phone number required'),
  guests: z.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be formatted as HH:mm'),
  occasion: z.enum(RESERVATION_OCCASIONS).optional(),
  specialRequest: z.string().trim().max(300).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  idempotencyKey: z.string().trim().optional(),
  // Honeypot field: bots fill this hidden field; humans leave it empty
  honeypot: z.string().optional(),
});

export const publicLookupSchema = z.object({
  code: z.string().trim().min(3),
  phone: z.string().trim().min(10),
});

export const publicCancelSchema = z.object({
  code: z.string().trim().min(3),
  phone: z.string().trim().min(10),
  reason: z.string().trim().max(300).optional(),
});

export const staffCreateReservationSchema = z.object({
  customerName: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(10),
  guests: z.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  source: z.enum(RESERVATION_SOURCES).default('phone'),
  tableIds: z.array(z.string()).optional(),
  occasion: z.enum(RESERVATION_OCCASIONS).optional(),
  specialRequest: z.string().trim().max(300).optional(),
  internalNotes: z.string().trim().max(500).optional(),
  isStaffOverride: z.boolean().default(false),
});

export const staffUpdateReservationSchema = z.object({
  customerName: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().min(10).optional(),
  guests: z.number().int().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  occasion: z.enum(RESERVATION_OCCASIONS).optional().nullable(),
  specialRequest: z.string().trim().max(300).optional().nullable(),
  internalNotes: z.string().trim().max(500).optional().nullable(),
});

export const staffStatusTransitionSchema = z.object({
  status: z.enum(['seated', 'completed', 'cancelled', 'no_show']),
  reason: z.string().trim().max(300).optional(),
});

export const staffAssignTablesSchema = z.object({
  tableIds: z.array(z.string()).min(1, 'At least one table must be selected'),
});

export const staffConfirmReservationSchema = z.object({
  tableIds: z.array(z.string()).optional(),
});

export const createBlockSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().trim().min(3).max(200),
});
