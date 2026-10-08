import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { statementService } from './statement.service';
import { pdfGeneratorService } from './pdfGenerator.service';
import { AppError } from '../../utils/AppError';

export const statementController = {
  listStatements: asyncHandler(async (_req: Request, res: Response) => {
    const list = await statementService.listStatements();
    res.json({ success: true, data: list });
  }),

  getStatement: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    const statement = await statementService.getStatementByMonth(month);
    res.json({ success: true, data: statement });
  }),

  getPreChecks: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Month must be in YYYY-MM format', 400);
    }
    const prechecks = await statementService.getPreCheckStatus(month);
    res.json({ success: true, data: prechecks });
  }),

  previewStatement: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    const retainedAmount = req.query.retainedAmount
      ? parseInt(req.query.retainedAmount as string, 10)
      : 0;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Month must be in YYYY-MM format', 400);
    }

    const preview = await statementService.previewStatement(month, retainedAmount);
    res.json({ success: true, data: preview });
  }),

  finalizeStatement: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    const { retainedAmount, overridePrechecks, overrideReason } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Month must be in YYYY-MM format', 400);
    }

    const statement = await statementService.finalizeStatement(
      {
        month,
        retainedAmount: retainedAmount ? Number(retainedAmount) : 0,
        overridePrechecks: Boolean(overridePrechecks),
        overrideReason: overrideReason as string | undefined,
      },
      req.user!._id.toString()
    );

    res.status(201).json({ success: true, data: statement });
  }),

  reopenStatement: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    const { reason } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Month must be in YYYY-MM format', 400);
    }
    if (!reason || typeof reason !== 'string') {
      throw new AppError('Reopen reason is required', 400);
    }

    const statement = await statementService.reopenStatement(
      month,
      reason,
      req.user!._id.toString()
    );
    res.json({ success: true, data: statement });
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const month = req.params.month as string;
    const statement = await statementService.getStatementByMonth(month);

    const pdfBuffer = await pdfGeneratorService.generateStatementPdf(statement);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="partner-statement-${statement.statementNo}.pdf"`
    );
    res.send(pdfBuffer);
  }),
};
