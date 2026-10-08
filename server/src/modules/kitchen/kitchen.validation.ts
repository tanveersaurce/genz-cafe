import { z } from 'zod';

export const updateKotStatusSchema = z.object({
  to: z.enum(['preparing', 'ready']),
  expectedFrom: z.enum(['new', 'preparing', 'ready']),
});

export type UpdateKotStatusInput = z.infer<typeof updateKotStatusSchema>;
