import crypto from 'crypto';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { MonthlyStatement, IMonthlyStatement } from './models/monthlyStatement.model';
import { pnlService } from './pnl.service';
import { partnerService } from '../partners/partner.service';
import { Partner } from '../partners/models/partner.model';
import { PartnerLedger } from '../partners/models/partnerLedger.model';
import { DailyClosing } from '../closing/models/dailyClosing.model';
import { Order } from '../orders/models/order.model';
import { Bill } from '../orders/models/bill.model';
import { RecurringExpenseTemplate } from '../expenses/models/recurringTemplate.model';
import { allocateProfit } from './allocationCalculator';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface FinalizeStatementParams {
  month: string; // YYYY-MM
  retainedAmount?: number; // paise
  overridePrechecks?: boolean;
  overrideReason?: string;
}

export const statementService = {
  /**
   * Runs pre-flight checks before finalization.
   */
  async getPreCheckStatus(month: string) {
    const existing = await MonthlyStatement.findOne({ month, status: 'finalized' });
    if (existing) {
      return {
        isFinalized: true,
        canFinalize: false,
        issues: [`Month ${month} is already finalized`],
        unclosedDates: [],
        openOrdersCount: 0,
        unpaidBillsCount: 0,
      };
    }

    const dt = DateTime.fromFormat(`${month}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
    const issues: string[] = [];

    // Check 1: Unclosed business days with bills
    const startOfMonth = dt.startOf('month').toJSDate();
    const endOfMonth = dt.endOf('month').toJSDate();

    const billsInMonth = await Bill.find({
      generatedAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    const datesWithBills = new Set<string>();
    for (const b of billsInMonth) {
      const billDate = DateTime.fromJSDate(b.generatedAt).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
      datesWithBills.add(billDate);
    }

    const unclosedDates: string[] = [];
    for (const dateStr of datesWithBills) {
      const closing = await DailyClosing.findOne({ localDate: dateStr, status: 'closed' });
      if (!closing) {
        unclosedDates.push(dateStr);
      }
    }

    if (unclosedDates.length > 0) {
      issues.push(`${unclosedDates.length} date(s) with sales have not been closed: ${unclosedDates.join(', ')}`);
    }

    // Check 2: Open orders / unpaid bills in date range
    const [openOrders, unpaidBills] = await Promise.all([
      Order.countDocuments({
        status: 'open',
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      Bill.countDocuments({
        status: 'issued',
        generatedAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
    ]);

    if (openOrders > 0) {
      issues.push(`${openOrders} open order(s) remain incomplete`);
    }
    if (unpaidBills > 0) {
      issues.push(`${unpaidBills} bill(s) remain in unpaid 'issued' state`);
    }

    // Check 3: Active recurring templates that haven't generated for this month
    const ungeneratedRecurring = await RecurringExpenseTemplate.countDocuments({
      isActive: true,
      $or: [{ lastGeneratedMonth: { $ne: month } }, { lastGeneratedMonth: { $exists: false } }],
    });

    if (ungeneratedRecurring > 0) {
      issues.push(`${ungeneratedRecurring} active recurring expense template(s) have not been generated for ${month}`);
    }

    return {
      isFinalized: false,
      canFinalize: issues.length === 0,
      issues,
      unclosedDates,
      openOrdersCount: openOrders,
      unpaidBillsCount: unpaidBills,
    };
  },

  /**
   * Previews statement numbers and profit allocation without committing.
   */
  async previewStatement(month: string, retainedAmount = 0) {
    const dt = DateTime.fromFormat(`${month}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
    const from = dt.startOf('month').toFormat('yyyy-MM-dd');
    const to = dt.endOf('month').toFormat('yyyy-MM-dd');

    const pnl = await pnlService.getPnlReport({ from, to });
    const schedule = await partnerService.getLatestShareSchedule(`${month}-01`);

    if (!schedule) {
      throw new AppError('No active partner share schedule found for this month', 400);
    }

    const netProfit = pnl.netProfit;
    // If profit, subtract retainedAmount; if loss, full loss is allocated
    const distributableAmount = netProfit > 0 ? Math.max(0, netProfit - retainedAmount) : netProfit;

    const partnerIdStrs = schedule.shares.map((s) => {
      const pid = s.partnerId as unknown;
      if (pid && typeof pid === 'object' && '_id' in (pid as Record<string, unknown>)) {
        return String((pid as { _id: unknown })._id);
      }
      return String(pid);
    });

    const partnerDocs = await Partner.find({
      _id: { $in: partnerIdStrs.map((id) => new Types.ObjectId(id)) },
    }).lean();
    const partnerMap = new Map(partnerDocs.map((p) => [p._id.toString(), p.name]));

    const allocationResult = allocateProfit(
      distributableAmount,
      schedule.shares.map((s, idx) => {
        const partnerId = partnerIdStrs[idx] ?? '';
        const partnerObj = s.partnerId as unknown as { name?: string };
        const partnerName =
          partnerObj?.name || partnerMap.get(partnerId) || 'Partner';
        return {
          partnerId,
          partnerName,
          basisPoints: s.basisPoints,
        };
      })
    );

    const allocations = allocationResult.allocations.map((a) => ({
      partnerId: new Types.ObjectId(a.partnerId),
      partnerNameSnapshot: a.partnerName,
      basisPoints: a.basisPoints,
      amount: a.amount,
    }));

    return {
      month,
      pnl,
      schedule,
      retainedAmount,
      distributableAmount,
      allocations,
    };
  },

  /**
   * Finalizes monthly statement, records immutable snapshot, and credits/debits partner ledgers.
   */
  async finalizeStatement(params: FinalizeStatementParams, userId: string): Promise<IMonthlyStatement> {
    const { month, retainedAmount = 0, overridePrechecks, overrideReason } = params;

    const existing = await MonthlyStatement.findOne({ month, status: 'finalized' });
    if (existing) {
      throw new AppError(`Month ${month} is already finalized`, 409, 'PERIOD_FINALIZED');
    }

    const precheck = await this.getPreCheckStatus(month);
    if (!precheck.canFinalize) {
      if (!overridePrechecks) {
        throw new AppError(
          `Pre-flight checks failed: ${precheck.issues.join('; ')}`,
          400,
          'PRECHECKS_FAILED',
          { issues: precheck.issues }
        );
      }
      if (!overrideReason || overrideReason.trim().length === 0) {
        throw new AppError('An override reason is mandatory to bypass pre-flight checks', 400);
      }

      await auditService.log({
        actorId: userId,
        action: 'statement.override_precheck',
        entityType: 'MonthlyStatement',
        entityId: month,
        metadata: {
          month,
          issues: precheck.issues,
          reason: overrideReason,
        },
      });
    }

    const preview = await this.previewStatement(month, retainedAmount);

    // Compute checksum over deterministic payload
    const checksumPayload = JSON.stringify({
      month,
      totals: {
        grossSales: preview.pnl.revenue.grossSales,
        netRevenue: preview.pnl.revenue.netRevenue,
        cogs: preview.pnl.directCosts.total,
        operatingExpenses: preview.pnl.operatingExpenses.total,
        netProfit: preview.pnl.netProfit,
      },
      retainedAmount,
      distributableAmount: preview.distributableAmount,
      allocations: preview.allocations.map(
        (a: { partnerId: Types.ObjectId; basisPoints: number; amount: number }) => ({
          partnerId: a.partnerId.toString(),
          basisPoints: a.basisPoints,
          amount: a.amount,
        })
      ),
    });
    const checksum = crypto.createHash('sha256').update(checksumPayload).digest('hex');

    const dt = DateTime.fromFormat(`${month}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
    const endOfMonthDateStr = dt.endOf('month').toFormat('yyyy-MM-dd');

    const statement = new MonthlyStatement({
      month,
      status: 'finalized',
      version: 1,
      statementNo: `PS-${month}`,
      pnlSnapshot: preview.pnl,
      shareScheduleSnapshot: {
        scheduleId: preview.schedule._id,
        effectiveFrom: preview.schedule.effectiveFrom,
        shares: preview.schedule.shares.map((s) => {
          const pidObj = s.partnerId as unknown as { _id?: Types.ObjectId | string };
          return {
            partnerId: new Types.ObjectId(pidObj?._id || (s.partnerId as Types.ObjectId | string)),
            basisPoints: s.basisPoints,
          };
        }),
      },
      allocations: preview.allocations,
      retainedAmount,
      distributableAmount: preview.distributableAmount,
      totals: {
        grossSales: preview.pnl.revenue.grossSales,
        discounts: preview.pnl.revenue.discounts,
        netRevenue: preview.pnl.revenue.netRevenue,
        totalTax: preview.pnl.revenue.gstCollected,
        directCosts: preview.pnl.directCosts.total,
        operatingExpenses: preview.pnl.operatingExpenses.total,
        netProfit: preview.pnl.netProfit,
      },
      checksum,
      finalizedBy: new Types.ObjectId(userId),
      finalizedAt: new Date(),
    });

    await statement.save();

    // Credit / debit partner ledgers
    for (const alloc of preview.allocations) {
      const isProfit = alloc.amount >= 0;
      const ledgerEntry = new PartnerLedger({
        partnerId: alloc.partnerId,
        entryDate: endOfMonthDateStr,
        type: isProfit ? 'profit_share' : 'loss_share',
        credit: isProfit ? alloc.amount : 0,
        debit: isProfit ? 0 : Math.abs(alloc.amount),
        description: `Monthly ${isProfit ? 'profit' : 'loss'} share: PS-${month} (${(alloc.basisPoints / 100).toFixed(2)}%)`,
        referenceId: statement._id,
        referenceType: 'MonthlyStatement',
        createdBy: new Types.ObjectId(userId),
      });
      await ledgerEntry.save();
    }

    await auditService.log({
      actorId: userId,
      action: 'statement.finalized',
      entityType: 'MonthlyStatement',
      entityId: statement._id.toString(),
      metadata: {
        month,
        netProfit: preview.pnl.netProfit,
        distributableAmount: preview.distributableAmount,
        checksum,
      },
    });

    return statement;
  },

  /**
   * Reopens a finalized statement (partner only). Reverses ledger profit shares.
   */
  async reopenStatement(month: string, reason: string, userId: string): Promise<IMonthlyStatement> {
    const statement = await MonthlyStatement.findOne({ month, status: 'finalized' });
    if (!statement) {
      throw new AppError(`No active finalized statement found for month ${month}`, 404);
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('A reason is mandatory to reopen a finalized statement', 400);
    }

    // Check if subsequent months are finalized
    const laterStatement = await MonthlyStatement.findOne({
      month: { $gt: month },
      status: 'finalized',
    });
    if (laterStatement) {
      throw new AppError(
        `Cannot reopen month ${month} because subsequent month ${laterStatement.month} is already finalized`,
        400
      );
    }

    // Reverse ledger entries
    for (const alloc of statement.allocations) {
      const isProfit = alloc.amount >= 0;
      const reversalLedger = new PartnerLedger({
        partnerId: alloc.partnerId,
        entryDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
        type: 'adjustment',
        credit: isProfit ? 0 : Math.abs(alloc.amount),
        debit: isProfit ? alloc.amount : 0,
        description: `Reversal of statement PS-${month}: ${reason}`,
        referenceId: statement._id,
        referenceType: 'MonthlyStatement',
        createdBy: new Types.ObjectId(userId),
      });
      await reversalLedger.save();
    }

    const previousSnapshot = {
      statementNo: statement.statementNo,
      checksum: statement.checksum,
      netProfit: statement.totals.netProfit,
      distributableAmount: statement.distributableAmount,
      finalizedAt: statement.finalizedAt,
    };

    statement.status = 'reopened';
    statement.reopenHistory.push({
      by: new Types.ObjectId(userId),
      at: new Date(),
      reason: reason.trim(),
      previousSnapshot,
    });
    statement.version += 1;
    await statement.save();

    await auditService.log({
      actorId: userId,
      action: 'statement.reopened',
      entityType: 'MonthlyStatement',
      entityId: statement._id.toString(),
      metadata: {
        month,
        reason,
      },
    });

    return statement;
  },

  async listStatements() {
    return MonthlyStatement.find()
      .sort({ month: -1 })
      .populate('finalizedBy', 'name email');
  },

  async getStatementByMonth(month: string) {
    const statement = await MonthlyStatement.findOne({ month })
      .populate('finalizedBy', 'name email')
      .populate('reopenHistory.by', 'name email');
    if (!statement) throw new AppError(`Statement for month ${month} not found`, 404);
    return statement;
  },
};
