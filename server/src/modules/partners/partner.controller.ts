import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { partnerService } from './partner.service';
import {
  createPartnerSchema,
  updatePartnerSchema,
  createShareScheduleSchema,
  createCapitalEntrySchema,
  reverseCapitalEntrySchema,
  createWithdrawalSchema,
  reverseWithdrawalSchema,
} from './partner.validation';

export const partnerController = {
  // Partners
  listPartners: asyncHandler(async (_req: Request, res: Response) => {
    const partners = await partnerService.listPartners();
    res.json({ success: true, data: partners });
  }),

  getSummary: asyncHandler(async (_req: Request, res: Response) => {
    const summaries = await partnerService.getAllPartnersSummary();
    res.json({ success: true, data: summaries });
  }),

  getPartner: asyncHandler(async (req: Request, res: Response) => {
    const partner = await partnerService.getPartnerById(req.params.id as string);
    res.json({ success: true, data: partner });
  }),

  createPartner: asyncHandler(async (req: Request, res: Response) => {
    const data = createPartnerSchema.parse(req.body);
    const partner = await partnerService.createPartner(data, req.user!._id.toString());
    res.status(201).json({ success: true, data: partner });
  }),

  updatePartner: asyncHandler(async (req: Request, res: Response) => {
    const data = updatePartnerSchema.parse(req.body);
    const partner = await partnerService.updatePartner(
      req.params.id as string,
      data,
      req.user!._id.toString()
    );
    res.json({ success: true, data: partner });
  }),

  // Share Schedules
  getCurrentShares: asyncHandler(async (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    const schedule = await partnerService.getLatestShareSchedule(date);
    res.json({ success: true, data: schedule });
  }),

  listShareSchedules: asyncHandler(async (_req: Request, res: Response) => {
    const schedules = await partnerService.listShareSchedules();
    res.json({ success: true, data: schedules });
  }),

  createShareSchedule: asyncHandler(async (req: Request, res: Response) => {
    const data = createShareScheduleSchema.parse(req.body);
    const schedule = await partnerService.createShareSchedule(data, req.user!._id.toString());
    res.status(201).json({ success: true, data: schedule });
  }),

  // Capital Entries
  listCapitalEntries: asyncHandler(async (req: Request, res: Response) => {
    const partnerId = req.query.partnerId as string | undefined;
    const entries = await partnerService.listCapitalEntries(partnerId);
    res.json({ success: true, data: entries });
  }),

  createCapitalEntry: asyncHandler(async (req: Request, res: Response) => {
    const data = createCapitalEntrySchema.parse(req.body);
    const entry = await partnerService.createCapitalEntry(data, req.user!._id.toString());
    res.status(201).json({ success: true, data: entry });
  }),

  reverseCapitalEntry: asyncHandler(async (req: Request, res: Response) => {
    const { reason } = reverseCapitalEntrySchema.parse(req.body);
    const entry = await partnerService.reverseCapitalEntry(
      req.params.id as string,
      reason,
      req.user!._id.toString()
    );
    res.json({ success: true, data: entry });
  }),

  // Withdrawals
  listWithdrawals: asyncHandler(async (req: Request, res: Response) => {
    const partnerId = req.query.partnerId as string | undefined;
    const withdrawals = await partnerService.listWithdrawals(partnerId);
    res.json({ success: true, data: withdrawals });
  }),

  createWithdrawal: asyncHandler(async (req: Request, res: Response) => {
    const data = createWithdrawalSchema.parse(req.body);
    const result = await partnerService.createWithdrawal(data, req.user!._id.toString());
    res.status(201).json({ success: true, data: result.withdrawal, warning: result.warning });
  }),

  reverseWithdrawal: asyncHandler(async (req: Request, res: Response) => {
    const { reason } = reverseWithdrawalSchema.parse(req.body);
    const withdrawal = await partnerService.reverseWithdrawal(
      req.params.id as string,
      reason,
      req.user!._id.toString()
    );
    res.json({ success: true, data: withdrawal });
  }),

  // Ledger
  getPartnerLedger: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query;
    const ledger = await partnerService.getPartnerLedger(
      req.params.id as string,
      from as string | undefined,
      to as string | undefined
    );
    res.json({ success: true, data: ledger });
  }),
};
