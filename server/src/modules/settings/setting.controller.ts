import { Request, Response } from 'express';
import { z } from 'zod';
import { settingService } from './setting.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { Role } from '../auth/permissions';

const patchQrOrderingSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(200).optional(),
});

export const getQrOrderingStatus = asyncHandler(async (_req: Request, res: Response) => {
  const setting = await settingService.getQrOrderingSetting();
  res.status(200).json({
    success: true,
    data: setting,
  });
});

export const updateQrOrderingStatus = asyncHandler(async (req: Request, res: Response) => {
  const validated = patchQrOrderingSchema.parse(req.body);
  const userId = req.user?.id || '';
  const userRole = (req.user?.role || 'cashier') as Role;

  const result = await settingService.updateQrOrderingSetting(
    validated.enabled,
    validated.message,
    userId,
    userRole
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
