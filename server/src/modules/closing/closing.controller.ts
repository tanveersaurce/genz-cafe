import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { asyncHandler } from '../../utils/asyncHandler';
import { closingService } from './closing.service';
import { submitClosingSchema, reopenClosingSchema } from './closing.validation';

export const closingController = {
  getPreview: asyncHandler(async (req: Request, res: Response) => {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const targetDate = req.query.date ? String(req.query.date) : nowIst.toFormat('yyyy-MM-dd');
    const userRole = req.user!.role;

    const preview = await closingService.getPreview(targetDate, userRole);

    res.json({
      success: true,
      data: preview,
    });
  }),

  submitClosing: asyncHandler(async (req: Request, res: Response) => {
    const validated = submitClosingSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();
    const userRole = req.user!.role;

    const closing = await closingService.submitClosing(validated, userId, userRole);

    res.status(201).json({
      success: true,
      message: `Daily register closed for ${closing.localDate}`,
      data: { closing },
    });
  }),

  reopenClosing: asyncHandler(async (req: Request, res: Response) => {
    const validated = reopenClosingSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const closing = await closingService.reopenClosing(
      req.params.date as string,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: `Register reopened for ${closing.localDate}`,
      data: { closing },
    });
  }),

  listClosings: asyncHandler(async (req: Request, res: Response) => {
    const { from, to, page, limit } = req.query;
    const result = await closingService.listClosings({
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  getClosingByDate: asyncHandler(async (req: Request, res: Response) => {
    const closing = await closingService.getClosingByDate(req.params.date as string);

    res.json({
      success: true,
      data: { closing },
    });
  }),
};
