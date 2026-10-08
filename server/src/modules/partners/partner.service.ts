import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Partner, IPartner } from './models/partner.model';
import { PartnerShareSchedule, IPartnerShareSchedule } from './models/partnerShareSchedule.model';
import { CapitalEntry, ICapitalEntry, CapitalEntryType, CapitalPaymentMethod } from './models/capitalEntry.model';
import { PartnerWithdrawal, IPartnerWithdrawal, WithdrawalPaymentMethod } from './models/partnerWithdrawal.model';
import { PartnerLedger } from './models/partnerLedger.model';
import { CashMovement } from '../cash/models/cashMovement.model';
import { periodLockService } from '../finance/periodLock.service';
import { closingService } from '../closing/closing.service';
import { DailyClosing } from '../closing/models/dailyClosing.model';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface CreatePartnerParams {
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
  pan?: string;
  bankDetails?: {
    accountNo?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  };
  notes?: string;
}

export interface CreateShareScheduleParams {
  effectiveFrom: string; // YYYY-MM-01
  shares: Array<{
    partnerId: string;
    basisPoints: number;
  }>;
  notes?: string;
}

export interface CreateCapitalEntryParams {
  partnerId: string;
  type: CapitalEntryType;
  amount: number; // paise
  effectiveDate: string;
  paymentMethod: CapitalPaymentMethod;
  reference?: string;
  notes?: string;
}

export interface CreateWithdrawalParams {
  partnerId: string;
  amount: number; // paise
  paymentMethod: WithdrawalPaymentMethod;
  effectiveDate: string;
  reference?: string;
  notes?: string;
}

export const partnerService = {
  // --- Partners CRUD ---
  async listPartners(activeOnly = true): Promise<IPartner[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return Partner.find(filter).sort({ name: 1 }).populate('userId', 'name email role');
  },

  async getPartnerById(partnerId: string): Promise<IPartner> {
    const partner = await Partner.findById(partnerId).populate('userId', 'name email role');
    if (!partner) throw new AppError('Partner not found', 404);
    return partner;
  },

  async createPartner(params: CreatePartnerParams, userId: string): Promise<IPartner> {
    const partner = new Partner({
      ...params,
      userId: params.userId ? new Types.ObjectId(params.userId) : undefined,
    });
    await partner.save();

    await auditService.log({
      actorId: userId,
      action: 'partner.created',
      entityType: 'Partner',
      entityId: partner._id.toString(),
      metadata: { name: partner.name },
    });

    return partner;
  },

  async updatePartner(
    partnerId: string,
    params: Partial<CreatePartnerParams> & { isActive?: boolean },
    userId: string
  ): Promise<IPartner> {
    const partner = await Partner.findById(partnerId);
    if (!partner) throw new AppError('Partner not found', 404);

    if (params.name) partner.name = params.name;
    if (params.email !== undefined) partner.email = params.email;
    if (params.phone !== undefined) partner.phone = params.phone;
    if (params.pan !== undefined) partner.pan = params.pan;
    if (params.bankDetails !== undefined) partner.bankDetails = params.bankDetails;
    if (params.notes !== undefined) partner.notes = params.notes;
    if (params.isActive !== undefined) partner.isActive = params.isActive;
    if (params.userId !== undefined) {
      partner.userId = params.userId ? new Types.ObjectId(params.userId) : undefined;
    }

    await partner.save();

    await auditService.log({
      actorId: userId,
      action: 'partner.updated',
      entityType: 'Partner',
      entityId: partner._id.toString(),
      metadata: { changes: params },
    });

    return partner;
  },

  // --- Share Schedules ---
  async listShareSchedules(): Promise<IPartnerShareSchedule[]> {
    return PartnerShareSchedule.find()
      .sort({ effectiveFrom: -1 })
      .populate('shares.partnerId', 'name email')
      .populate('createdBy', 'name email');
  },

  async getLatestShareSchedule(dateStr?: string): Promise<IPartnerShareSchedule | null> {
    const effectiveTarget = dateStr || DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-01');
    const schedule = await PartnerShareSchedule.findOne({
      effectiveFrom: { $lte: effectiveTarget },
    })
      .sort({ effectiveFrom: -1 })
      .populate('shares.partnerId', 'name email');

    return schedule;
  },

  async createShareSchedule(
    params: CreateShareScheduleParams,
    userId: string
  ): Promise<IPartnerShareSchedule> {
    await periodLockService.assertMonthNotFinalized(params.effectiveFrom);

    const totalBps = params.shares.reduce((sum, s) => sum + s.basisPoints, 0);
    if (totalBps !== 10000) {
      throw new AppError(`Total basis points must sum to exactly 10,000 (currently ${totalBps})`, 400);
    }

    // Verify all partners exist
    for (const s of params.shares) {
      const p = await Partner.findById(s.partnerId);
      if (!p) throw new AppError(`Partner not found: ${s.partnerId}`, 404);
    }

    const schedule = new PartnerShareSchedule({
      effectiveFrom: params.effectiveFrom,
      shares: params.shares.map((s) => ({
        partnerId: new Types.ObjectId(s.partnerId),
        basisPoints: s.basisPoints,
      })),
      notes: params.notes,
      createdBy: new Types.ObjectId(userId),
    });

    await schedule.save();

    await auditService.log({
      actorId: userId,
      action: 'partner.schedule_created',
      entityType: 'PartnerShareSchedule',
      entityId: schedule._id.toString(),
      metadata: {
        effectiveFrom: schedule.effectiveFrom,
        sharesCount: schedule.shares.length,
      },
    });

    return schedule;
  },

  // --- Capital Entries ---
  async createCapitalEntry(
    params: CreateCapitalEntryParams,
    userId: string
  ): Promise<ICapitalEntry> {
    await periodLockService.assertMonthNotFinalized(params.effectiveDate);

    const partner = await Partner.findById(params.partnerId);
    if (!partner) throw new AppError('Partner not found', 404);

    const entry = new CapitalEntry({
      partnerId: partner._id,
      type: params.type,
      amount: params.amount,
      effectiveDate: params.effectiveDate,
      paymentMethod: params.paymentMethod,
      reference: params.reference,
      notes: params.notes,
      recordedBy: new Types.ObjectId(userId),
    });
    await entry.save();

    // Create corresponding ledger entry
    const isContribution = params.type === 'contribution';
    const ledger = new PartnerLedger({
      partnerId: partner._id,
      entryDate: params.effectiveDate,
      type: isContribution ? 'capital_contribution' : 'capital_return',
      credit: isContribution ? params.amount : 0,
      debit: isContribution ? 0 : params.amount,
      description: `Capital ${params.type} via ${params.paymentMethod}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
      referenceId: entry._id,
      referenceType: 'CapitalEntry',
      createdBy: new Types.ObjectId(userId),
    });
    await ledger.save();

    await auditService.log({
      actorId: userId,
      action: 'capital.recorded',
      entityType: 'CapitalEntry',
      entityId: entry._id.toString(),
      metadata: {
        partnerId: partner._id.toString(),
        type: params.type,
        amount: params.amount,
        effectiveDate: params.effectiveDate,
      },
    });

    return entry;
  },

  async reverseCapitalEntry(
    entryId: string,
    reason: string,
    userId: string
  ): Promise<ICapitalEntry> {
    const entry = await CapitalEntry.findById(entryId);
    if (!entry) throw new AppError('Capital entry not found', 404);
    if (entry.isReversed) throw new AppError('Capital entry is already reversed', 400);

    await periodLockService.assertMonthNotFinalized(entry.effectiveDate);

    entry.isReversed = true;
    entry.reversedAt = new Date();
    entry.reversedBy = new Types.ObjectId(userId);
    entry.reversalReason = reason;
    await entry.save();

    // Offset in ledger
    const isContribution = entry.type === 'contribution';
    const ledger = new PartnerLedger({
      partnerId: entry.partnerId,
      entryDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
      type: 'adjustment',
      credit: isContribution ? 0 : entry.amount,
      debit: isContribution ? entry.amount : 0,
      description: `Reversal of capital ${entry.type}: ${reason}`,
      referenceId: entry._id,
      referenceType: 'CapitalEntry',
      createdBy: new Types.ObjectId(userId),
    });
    await ledger.save();

    await auditService.log({
      actorId: userId,
      action: 'capital.reversed',
      entityType: 'CapitalEntry',
      entityId: entry._id.toString(),
      metadata: { reason },
    });

    return entry;
  },

  async listCapitalEntries(partnerId?: string): Promise<ICapitalEntry[]> {
    const filter = partnerId ? { partnerId: new Types.ObjectId(partnerId) } : {};
    return CapitalEntry.find(filter)
      .sort({ effectiveDate: -1, createdAt: -1 })
      .populate('partnerId', 'name email')
      .populate('recordedBy', 'name email');
  },

  // --- Partner Withdrawals ---
  async createWithdrawal(
    params: CreateWithdrawalParams,
    userId: string
  ): Promise<{ withdrawal: IPartnerWithdrawal; warning?: string }> {
    await periodLockService.assertMonthNotFinalized(params.effectiveDate);

    const partner = await Partner.findById(params.partnerId);
    if (!partner) throw new AppError('Partner not found', 404);

    // Check balance for warning
    const ledgerSummary = await this.getPartnerLedgerSummary(params.partnerId);
    let warning: string | undefined;
    if (params.amount > ledgerSummary.netBalance) {
      warning = `Withdrawal of ₹${(params.amount / 100).toFixed(2)} exceeds current ledger balance of ₹${(ledgerSummary.netBalance / 100).toFixed(2)}`;
    }

    let cashMovementId: Types.ObjectId | undefined;
    if (params.paymentMethod === 'cash_drawer') {
      await closingService.assertDayNotClosed(params.effectiveDate);

      const movement = new CashMovement({
        localDate: params.effectiveDate,
        type: 'out',
        amount: params.amount,
        category: 'owner_withdrawal',
        reason: `Partner withdrawal: ${partner.name}`,
        recordedBy: new Types.ObjectId(userId),
        recordedAt: new Date(),
        status: 'recorded',
      });
      await movement.save();
      cashMovementId = movement._id as Types.ObjectId;
    }

    const withdrawal = new PartnerWithdrawal({
      partnerId: partner._id,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      effectiveDate: params.effectiveDate,
      reference: params.reference,
      notes: params.notes,
      cashMovementId,
      recordedBy: new Types.ObjectId(userId),
    });
    await withdrawal.save();

    const ledger = new PartnerLedger({
      partnerId: partner._id,
      entryDate: params.effectiveDate,
      type: 'withdrawal',
      debit: params.amount,
      credit: 0,
      description: `Withdrawal via ${params.paymentMethod}${params.reference ? ` (Ref: ${params.reference})` : ''}`,
      referenceId: withdrawal._id,
      referenceType: 'PartnerWithdrawal',
      createdBy: new Types.ObjectId(userId),
    });
    await ledger.save();

    await auditService.log({
      actorId: userId,
      action: 'partner.withdrawal_recorded',
      entityType: 'PartnerWithdrawal',
      entityId: withdrawal._id.toString(),
      metadata: {
        partnerId: partner._id.toString(),
        amount: params.amount,
        method: params.paymentMethod,
        hasWarning: !!warning,
      },
    });

    return { withdrawal, warning };
  },

  async reverseWithdrawal(
    withdrawalId: string,
    reason: string,
    userId: string
  ): Promise<IPartnerWithdrawal> {
    const withdrawal = await PartnerWithdrawal.findById(withdrawalId);
    if (!withdrawal) throw new AppError('Withdrawal not found', 404);
    if (withdrawal.status === 'reversed') throw new AppError('Withdrawal already reversed', 400);

    await periodLockService.assertMonthNotFinalized(withdrawal.effectiveDate);

    // Cash movement compensation
    if (withdrawal.cashMovementId) {
      const movement = await CashMovement.findById(withdrawal.cashMovementId);
      if (movement && movement.status === 'recorded') {
        const closing = await DailyClosing.findOne({ localDate: movement.localDate, status: 'closed' });
        if (closing) {
          const compensating = new CashMovement({
            localDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
            type: 'in',
            amount: withdrawal.amount,
            category: 'owner_withdrawal',
            reason: `Compensating reversal for partner withdrawal ${withdrawal._id}`,
            recordedBy: new Types.ObjectId(userId),
            recordedAt: new Date(),
            status: 'recorded',
          });
          await compensating.save();
        } else {
          movement.status = 'reversed';
          movement.reversedBy = new Types.ObjectId(userId);
          movement.reversedAt = new Date();
          movement.reverseReason = reason;
          await movement.save();
        }
      }
    }

    withdrawal.status = 'reversed';
    withdrawal.reversedAt = new Date();
    withdrawal.reversedBy = new Types.ObjectId(userId);
    withdrawal.reversalReason = reason;
    await withdrawal.save();

    // Offset ledger
    const ledger = new PartnerLedger({
      partnerId: withdrawal.partnerId,
      entryDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
      type: 'adjustment',
      credit: withdrawal.amount,
      debit: 0,
      description: `Reversal of withdrawal: ${reason}`,
      referenceId: withdrawal._id,
      referenceType: 'PartnerWithdrawal',
      createdBy: new Types.ObjectId(userId),
    });
    await ledger.save();

    await auditService.log({
      actorId: userId,
      action: 'partner.withdrawal_reversed',
      entityType: 'PartnerWithdrawal',
      entityId: withdrawal._id.toString(),
      metadata: { reason },
    });

    return withdrawal;
  },

  async listWithdrawals(partnerId?: string): Promise<IPartnerWithdrawal[]> {
    const filter = partnerId ? { partnerId: new Types.ObjectId(partnerId) } : {};
    return PartnerWithdrawal.find(filter)
      .sort({ effectiveDate: -1, createdAt: -1 })
      .populate('partnerId', 'name email')
      .populate('recordedBy', 'name email');
  },

  // --- Partner Ledger Statements ---
  async getPartnerLedger(partnerId: string, from?: string, to?: string) {
    const filter: Record<string, unknown> = {
      partnerId: new Types.ObjectId(partnerId),
    };
    if (from || to) {
      filter.entryDate = {};
      if (from) (filter.entryDate as Record<string, string>).$gte = from;
      if (to) (filter.entryDate as Record<string, string>).$lte = to;
    }

    const entries = await PartnerLedger.find(filter).sort({ entryDate: 1, createdAt: 1 }).lean();

    let runningBalance = 0;
    const computedEntries = entries.map((e) => {
      runningBalance += e.credit - e.debit;
      return {
        ...e,
        balance: runningBalance,
      };
    });

    const partner = await Partner.findById(partnerId);

    return {
      partner,
      entries: computedEntries,
      summary: {
        totalCredits: entries.reduce((s, e) => s + e.credit, 0),
        totalDebits: entries.reduce((s, e) => s + e.debit, 0),
        netBalance: runningBalance,
      },
    };
  },

  async getPartnerLedgerSummary(partnerId: string) {
    const entries = await PartnerLedger.find({ partnerId: new Types.ObjectId(partnerId) }).lean();
    const totalCredits = entries.reduce((s, e) => s + e.credit, 0);
    const totalDebits = entries.reduce((s, e) => s + e.debit, 0);
    return {
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
    };
  },

  async getAllPartnersSummary() {
    const partners = await Partner.find({ isActive: true }).lean();
    const results = [];

    for (const p of partners) {
      const summary = await this.getPartnerLedgerSummary(p._id.toString());
      results.push({
        partner: p,
        ...summary,
      });
    }

    return results;
  },
};
