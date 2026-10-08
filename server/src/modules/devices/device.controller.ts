import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { deviceService } from './device.service';
import { deviceSettings } from '../../config/deviceSettings';
import { env } from '../../config/env';

const registerDeviceSchema = z.object({
  name: z.string().min(2, 'Device name must be at least 2 characters').max(50),
  password: z.string().min(1, 'Partner password is required to authorize device'),
});

export const deviceController = {
  registerDevice: asyncHandler(async (req: Request, res: Response) => {
    const parsed = registerDeviceSchema.parse(req.body);

    const { device, rawToken } = await deviceService.registerDevice({
      name: parsed.name,
      partnerId: req.user!._id.toString(),
      partnerPassword: parsed.password,
      userAgent: req.get('user-agent'),
    });

    res.cookie(deviceSettings.cookieName, rawToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: deviceSettings.cookieMaxAgeDays * 24 * 60 * 60 * 1000,
      path: '/api/auth/pin',
    });

    res.status(201).json({
      success: true,
      data: {
        id: device._id,
        name: device.name,
        registeredAt: device.registeredAt,
      },
      message: 'Terminal registered successfully as a trusted device',
    });
  }),

  listDevices: asyncHandler(async (_req: Request, res: Response) => {
    const devices = await deviceService.listDevices();
    res.status(200).json({
      success: true,
      data: devices,
    });
  }),

  revokeDevice: asyncHandler(async (req: Request, res: Response) => {
    const device = await deviceService.revokeDevice(req.params.id as string, req.user!._id.toString());
    res.status(200).json({
      success: true,
      data: device,
      message: 'Terminal authorization revoked and associated sessions terminated',
    });
  }),
};
