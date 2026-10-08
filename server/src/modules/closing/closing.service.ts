import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { DailyClosing, IDailyClosing } from './models/dailyClosing.model';
import { CashMovement } from '../cash/models/cashMovement.model';
import { Payment } from '../orders/models/payment.model';
import { Bill } from '../orders/models/bill.model';
import { Order } from '../orders/models/order.model';
import { calculateDailyClosing } from './closing.calculator';
import { cashSettings } from '../../config/cashSettings';
import { hasPermission, Role } from '../auth/permissions';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { periodLockService } from '../finance/periodLock.service';

export interface SubmitClosingParams {
  localDate: string;
  openingCash?: number;
  openingCashReason?: string;
  countedCash: number;
  denominations?: Record<string, number>;
  cashRetained: number;
  cashHandedOver: number;
  reportedUpi?: number;
  reportedCard?: number;
  note?: string;
  overrideOpenOrders?: boolean;
  overrideReason?: string;
}

export const closingService = {
  /**
   * Asserts that the specified IST date has not been marked closed.
   * Throws 409 DAY_CLOSED if the day is closed.
   */
  async assertDayNotClosed(localDate: string): Promise<void> {
    const existing = await DailyClosing.findOne({ localDate, status: 'closed' });
    if (existing) {
      throw new AppError(
        `The business day for ${localDate} is closed. Modifications to bills, payments, or cash movements are locked unless reopened by a partner.`,
        409,
        'DAY_CLOSED'
      );
    }
  },

  /**
   * Returns the opening float for a date (previous day's cashRetained or default).
   */
  async getOpeningFloat(targetDate: string): Promise<number> {
    const previousClosing = await DailyClosing.findOne({
      localDate: { $lt: targetDate },
      status: 'closed',
    }).sort({ localDate: -1 });

    if (previousClosing) {
      return previousClosing.cashRetained;
    }
    return cashSettings.defaultOpeningFloatPaise;
  },

  /**
   * Gathers transactions for a date and returns preview numbers.
   * Enforces BLIND COUNT for cashiers (hides expected cash and sales totals).
   */
  async getPreview(targetDate: string, userRole: string) {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const today = nowIst.toFormat('yyyy-MM-dd');
    const yesterday = nowIst.minus({ days: 1 }).toFormat('yyyy-MM-dd');

    if (targetDate > today) {
      throw new AppError('Cannot preview closing for a future date', 400);
    }
    if (targetDate < yesterday) {
      // Allow previewing past dates only if already closed or for historical view
    }

    const startOfDay = DateTime.fromFormat(targetDate, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .startOf('day')
      .toJSDate();

    const endOfDay = DateTime.fromFormat(targetDate, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .endOf('day')
      .toJSDate();

    // 1. Fetch cash movements
    const movements = await CashMovement.find({
      localDate: targetDate,
      status: 'recorded',
    }).populate('recordedBy', 'name');

    const cashIn = movements
      .filter((m) => m.type === 'in')
      .reduce((acc, m) => acc + m.amount, 0);

    const cashOut = movements
      .filter((m) => m.type === 'out')
      .reduce((acc, m) => acc + m.amount, 0);

    // 2. Fetch payments received on this IST date
    const payments = await Payment.find({
      receivedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 3. Fetch bills generated on this IST date
    const bills = await Bill.find({
      generatedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 4. Fetch orders for this localDate
    const orders = await Order.find({ localDate: targetDate });

    // Open orders & unpaid bills
    const openOrders = orders
      .filter((o) => o.status === 'open')
      .map((o) => ({
        id: o._id.toString(),
        orderNo: o.orderNo,
        tableNumber: o.tableNumber,
        type: o.type,
      }));

    const unpaidBills = bills
      .filter((b) => b.status === 'issued')
      .map((b) => ({
        id: b._id.toString(),
        invoiceNo: b.invoiceNo,
        grandTotal: b.totals.grandTotal,
      }));

    const openingCash = await this.getOpeningFloat(targetDate);
    const existingClosing = await DailyClosing.findOne({ localDate: targetDate, status: 'closed' });

    const canViewFull = hasPermission(userRole as Role, 'closing:view');

    if (!canViewFull) {
      // BLIND COUNT: Cashier sees opening cash and movements, but NOT expected cash or sales totals!
      return {
        localDate: targetDate,
        isBlindCount: true,
        isAlreadyClosed: !!existingClosing,
        openingCash,
        cashIn,
        cashOut,
        movements,
        openOrders,
        unpaidBills,
        supportedDenominations: cashSettings.supportedDenominations,
        differenceTolerancePaise: cashSettings.differenceTolerancePaise,
      };
    }

    // Full preview for Partner/Manager
    const cancelledItems: Array<{ amount: number }> = [];
    for (const o of orders) {
      for (const i of o.items) {
        if (i.status === 'cancelled') {
          cancelledItems.push({ amount: i.unitPrice * i.qty });
        }
      }
    }

    const calcResult = calculateDailyClosing({
      openingCash,
      countedCash: openingCash + cashIn - cashOut, // dummy counted to run calculation
      cashRetained: openingCash,
      cashHandedOver: cashIn - cashOut > 0 ? cashIn - cashOut : 0,
      cashIn,
      cashOut,
      payments: payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        status: p.status,
      })),
      bills: bills.map((b) => ({
        status: b.status,
        totals: b.totals,
      })),
      cancelledItems,
      orders: orders.map((o) => ({ type: o.type })),
    });

    return {
      localDate: targetDate,
      isBlindCount: false,
      isAlreadyClosed: !!existingClosing,
      openingCash,
      cashIn,
      cashOut,
      expected: calcResult.expected,
      salesSummary: calcResult.salesSummary,
      movements,
      openOrders,
      unpaidBills,
      supportedDenominations: cashSettings.supportedDenominations,
      differenceTolerancePaise: cashSettings.differenceTolerancePaise,
    };
  },

  /**
   * Submits daily register closing.
   */
  async submitClosing(
    params: SubmitClosingParams,
    userId: string,
    userRole: string
  ): Promise<IDailyClosing> {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const today = nowIst.toFormat('yyyy-MM-dd');
    const yesterday = nowIst.minus({ days: 1 }).toFormat('yyyy-MM-dd');

    if (params.localDate > today) {
      throw new AppError('Cannot submit closing for a future date', 400);
    }
    if (params.localDate < yesterday) {
      throw new AppError('Closing can only be submitted for today or yesterday', 400);
    }

    // Check if day is already closed
    const alreadyClosed = await DailyClosing.findOne({
      localDate: params.localDate,
      status: 'closed',
    });
    if (alreadyClosed) {
      throw new AppError(
        `Register for ${params.localDate} is already closed. To re-enter, a partner must reopen the day first.`,
        409,
        'DAY_ALREADY_CLOSED'
      );
    }

    const startOfDay = DateTime.fromFormat(params.localDate, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .startOf('day')
      .toJSDate();

    const endOfDay = DateTime.fromFormat(params.localDate, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .endOf('day')
      .toJSDate();

    // Pre-check 1: Open orders and unpaid bills
    const orders = await Order.find({ localDate: params.localDate });
    const bills = await Bill.find({
      generatedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const openOrders = orders.filter((o) => o.status === 'open');
    const unpaidBills = bills.filter((b) => b.status === 'issued');

    if (openOrders.length > 0 || unpaidBills.length > 0) {
      const isPartner = hasPermission(userRole as Role, 'closing:reopen');
      if (isPartner && params.overrideOpenOrders) {
        if (!params.overrideReason || params.overrideReason.trim().length === 0) {
          throw new AppError('Override reason is mandatory when closing with open orders', 400);
        }
        await auditService.log({
          actorId: userId,
          action: 'closing.override_open_orders',
          entityType: 'DailyClosing',
          entityId: params.localDate,
          metadata: {
            openOrdersCount: openOrders.length,
            unpaidBillsCount: unpaidBills.length,
            reason: params.overrideReason,
          },
        });
      } else {
        throw new AppError(
          `Cannot close day: ${openOrders.length} order(s) remain open and ${unpaidBills.length} bill(s) are unpaid. Please complete or cancel them before closing.`,
          409,
          'OPEN_ORDERS_EXIST',
          {
            openOrders: openOrders.map((o) => ({ id: o._id, orderNo: o.orderNo })),
            unpaidBills: unpaidBills.map((b) => ({ id: b._id, invoiceNo: b.invoiceNo })),
          }
        );
      }
    }

    // Determine opening cash: either explicitly provided for initial closing or derived
    let openingCash = params.openingCash;
    if (openingCash === undefined) {
      openingCash = await this.getOpeningFloat(params.localDate);
    }

    // Fetch cash movements
    const movements = await CashMovement.find({
      localDate: params.localDate,
      status: 'recorded',
    });
    const cashIn = movements
      .filter((m) => m.type === 'in')
      .reduce((acc, m) => acc + m.amount, 0);
    const cashOut = movements
      .filter((m) => m.type === 'out')
      .reduce((acc, m) => acc + m.amount, 0);

    // Fetch payments
    const payments = await Payment.find({
      receivedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const cancelledItems: Array<{ amount: number }> = [];
    for (const o of orders) {
      for (const i of o.items) {
        if (i.status === 'cancelled') {
          cancelledItems.push({ amount: i.unitPrice * i.qty });
        }
      }
    }

    // Run deterministic calculation
    const calc = calculateDailyClosing({
      openingCash,
      countedCash: params.countedCash,
      cashRetained: params.cashRetained,
      cashHandedOver: params.cashHandedOver,
      cashIn,
      cashOut,
      payments: payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        status: p.status,
      })),
      bills: bills.map((b) => ({
        status: b.status,
        totals: b.totals,
      })),
      cancelledItems,
      orders: orders.map((o) => ({ type: o.type })),
      denominations: params.denominations,
      note: params.note,
    });

    // Check if reopening an existing record or creating new
    let closing = await DailyClosing.findOne({ localDate: params.localDate });
    if (!closing) {
      closing = new DailyClosing({
        localDate: params.localDate,
        status: 'closed',
        openingCash,
        openingCashReason: params.openingCashReason,
        countedCash: params.countedCash,
        denominations: params.denominations,
        cashRetained: params.cashRetained,
        cashHandedOver: params.cashHandedOver,
        expected: calc.expected,
        difference: calc.difference,
        reportedUpi: params.reportedUpi,
        reportedCard: params.reportedCard,
        salesSummary: calc.salesSummary,
        note: params.note,
        closedBy: new Types.ObjectId(userId),
        closedAt: new Date(),
        reopenHistory: [],
        version: 1,
      });
    } else {
      // Re-closing an opened closing
      closing.status = 'closed';
      closing.openingCash = openingCash;
      closing.countedCash = params.countedCash;
      closing.denominations = params.denominations;
      closing.cashRetained = params.cashRetained;
      closing.cashHandedOver = params.cashHandedOver;
      closing.expected = calc.expected;
      closing.difference = calc.difference;
      closing.reportedUpi = params.reportedUpi;
      closing.reportedCard = params.reportedCard;
      closing.salesSummary = calc.salesSummary;
      closing.note = params.note;
      closing.closedBy = new Types.ObjectId(userId);
      closing.closedAt = new Date();
      closing.version += 1;
    }

    await closing.save();

    await auditService.log({
      actorId: userId,
      action: 'closing.submitted',
      entityType: 'DailyClosing',
      entityId: closing._id.toString(),
      metadata: {
        localDate: closing.localDate,
        countedCash: closing.countedCash,
        expectedCash: calc.expected.expectedCash,
        difference: calc.difference,
        differenceType: calc.differenceType,
        netSales: calc.salesSummary.netSales,
      },
    });

    return closing;
  },

  /**
   * Reopens a closed day with an audit reason (partner only).
   */
  async reopenClosing(localDate: string, reason: string, userId: string): Promise<IDailyClosing> {
    const closing = await DailyClosing.findOne({ localDate, status: 'closed' });
    if (!closing) {
      throw new AppError(`No active closed register found for date ${localDate}`, 404);
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('A reason is mandatory to reopen a closed day', 400);
    }

    await periodLockService.assertMonthNotFinalized(localDate);

    const previousSnapshot = {
      countedCash: closing.countedCash,
      expectedCash: closing.expected.expectedCash,
      difference: closing.difference,
      cashRetained: closing.cashRetained,
      cashHandedOver: closing.cashHandedOver,
      closedAt: closing.closedAt,
    };

    closing.status = 'reopened';
    closing.reopenHistory.push({
      by: new Types.ObjectId(userId),
      at: new Date(),
      reason: reason.trim(),
      previousSnapshot,
    });
    closing.version += 1;
    await closing.save();

    await auditService.log({
      actorId: userId,
      action: 'closing.reopened',
      entityType: 'DailyClosing',
      entityId: closing._id.toString(),
      metadata: {
        localDate,
        reason,
        previousDifference: closing.difference,
      },
    });

    return closing;
  },

  /**
   * Retrieves paginated closing history (closing:view).
   */
  async listClosings(params: { from?: string; to?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const filter: Record<string, unknown> = {};
    if (params.from || params.to) {
      filter.localDate = {};
      if (params.from) (filter.localDate as Record<string, string>).$gte = params.from;
      if (params.to) (filter.localDate as Record<string, string>).$lte = params.to;
    }

    const total = await DailyClosing.countDocuments(filter);
    const closings = await DailyClosing.find(filter)
      .sort({ localDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('closedBy', 'name username');

    return {
      closings,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Retrieves single closing record by localDate.
   */
  async getClosingByDate(localDate: string) {
    const closing = await DailyClosing.findOne({ localDate })
      .populate('closedBy', 'name username')
      .populate('reopenHistory.by', 'name username');
    if (!closing) {
      throw new AppError(`No closing found for date ${localDate}`, 404);
    }
    return closing;
  },
};
