import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { asyncHandler } from '../../utils/asyncHandler';
import { pnlService } from './pnl.service';
import { AppError } from '../../utils/AppError';

export const pnlController = {
  getPnl: asyncHandler(async (req: Request, res: Response) => {
    let { from, to, month } = req.query;

    if (month && typeof month === 'string') {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new AppError('Month must be in YYYY-MM format', 400);
      }
      const dt = DateTime.fromFormat(`${month}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
      from = dt.startOf('month').toFormat('yyyy-MM-dd');
      to = dt.endOf('month').toFormat('yyyy-MM-dd');
    }

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      // Default to current month
      const now = DateTime.now().setZone('Asia/Kolkata');
      from = now.startOf('month').toFormat('yyyy-MM-dd');
      to = now.endOf('month').toFormat('yyyy-MM-dd');
    }

    const report = await pnlService.getPnlReport({ from, to });
    res.json({ success: true, data: report });
  }),

  getTrend: asyncHandler(async (req: Request, res: Response) => {
    const yearStr = (req.query.year as string) || DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy');
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 2020 || year > 2099) {
      throw new AppError('Invalid year', 400);
    }

    const trend = await pnlService.getMonthlyTrend(year);
    res.json({ success: true, data: trend });
  }),

  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    let { from, to, month } = req.query;

    if (month && typeof month === 'string') {
      const dt = DateTime.fromFormat(`${month}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
      from = dt.startOf('month').toFormat('yyyy-MM-dd');
      to = dt.endOf('month').toFormat('yyyy-MM-dd');
    }

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      const now = DateTime.now().setZone('Asia/Kolkata');
      from = now.startOf('month').toFormat('yyyy-MM-dd');
      to = now.endOf('month').toFormat('yyyy-MM-dd');
    }

    const csvData = await pnlService.exportPnlCsv({ from, to });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pnl-${from}-to-${to}.csv"`);
    res.send(csvData);
  }),
};
