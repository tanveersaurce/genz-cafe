import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Order } from './models/order.model';
import { Bill, IBillItemSnapshot } from './models/bill.model';
import { Payment } from './models/payment.model';
import { getNextSequence } from './models/counter.model';
import { calculateBill } from './billingCalculator';
import { billingSettings } from '../../config/billingSettings';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';
import { closingService } from '../closing/closing.service';
import { periodLockService } from '../finance/periodLock.service';
import { approvalService } from '../approvals/approval.service';
import { hasPermission, Role } from '../auth/permissions';

/**
 * Returns the Indian financial year string and invoice prefix based on an IST instant.
 * In India, the financial year runs from 1 April to 31 March.
 * Example: 2026-10-06 -> FY: "2026-27", prefix: "GZ2627"
 * Example: 2027-04-01 -> FY: "2027-28", prefix: "GZ2728"
 */
export const getFinancialYear = (
  date: Date = new Date()
): { financialYear: string; prefix: string } => {
  const istDate = DateTime.fromJSDate(date).setZone('Asia/Kolkata');
  const year = istDate.year;
  const month = istDate.month; // 1-12

  const fyStartYear = month >= billingSettings.financialYearStartMonth ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  const yyStart = (fyStartYear % 100).toString().padStart(2, '0');
  const yyEnd = (fyEndYear % 100).toString().padStart(2, '0');

  const financialYear = `${fyStartYear}-${yyEnd}`;
  const prefix = `${billingSettings.invoicePrefix}${yyStart}${yyEnd}`;

  return { financialYear, prefix };
};

export const billService = {
  /**
   * Generates an immutable tax bill / invoice for an open order.
   * Fully idempotent: calling twice returns the already issued bill.
   */
  async generateBill(orderId: string, userId: string) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Idempotency: If order already has an active issued or paid bill, return it
    if (order.billId) {
      const existingBill = await Bill.findById(order.billId);
      if (existingBill && existingBill.status !== 'void') {
        return { bill: existingBill, order, isIdempotentReturn: true };
      }
    }

    if (order.status !== 'open') {
      throw new AppError('Cannot generate bill for an order that is not open', 409, 'ORDER_LOCKED');
    }

    const activeItems = order.items.filter((i) => i.status === 'active');
    if (activeItems.length === 0) {
      throw new AppError('Cannot generate bill with no active items', 400, 'NO_ACTIVE_ITEMS');
    }

    // 1. Calculate bill totals and per-line tax distributions
    const calculation = calculateBill(
      activeItems.map((i) => ({
        lineId: i.lineId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        gstRate: i.gstRateSnapshot,
      })),
      order.discount
    );

    // 2. Determine Indian Financial Year & generate sequence atomically
    const now = new Date();
    const { financialYear, prefix } = getFinancialYear(now);
    const counterKey = `invoice:${financialYear}`;
    const seq = await getNextSequence(counterKey);
    const invoiceNo = `${prefix}-${seq.toString().padStart(6, '0')}`;

    // 3. Assemble snapshot line items
    const snapshotItems: IBillItemSnapshot[] = calculation.lines.map((calcLine) => {
      const original = activeItems.find((i) => i.lineId === calcLine.lineId);
      return {
        ...calcLine,
        name: original?.nameSnapshot || 'Unknown Item',
        variantName: original?.variantName,
        foodType: original?.foodTypeSnapshot || 'veg',
      };
    });

    // 4. Create immutable Bill document
    const bill = await Bill.create({
      invoiceNo,
      financialYear,
      orderId: order._id,
      orderNo: order.orderNo,
      tableNumber: order.tableNumber,
      items: snapshotItems,
      totals: {
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        taxable: calculation.taxable,
        cgst: calculation.cgst,
        sgst: calculation.sgst,
        totalTax: calculation.totalTax,
        roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal,
      },
      taxBreakup: calculation.taxBreakup,
      settingsSnapshot: {
        legalName: billingSettings.legalName,
        gstin: billingSettings.gstin,
        address: billingSettings.address,
        pricesIncludeTax: billingSettings.pricesIncludeTax,
        gstEnabled: billingSettings.gstEnabled,
      },
      status: 'issued',
      generatedBy: new Types.ObjectId(userId),
      generatedAt: now,
    });

    // 5. Transition order to billed state
    order.status = 'billed';
    order.billId = bill._id;
    order.version += 1;
    await order.save();

    await auditService.log({
      actorId: userId,
      action: 'bill.generated',
      entityType: 'Bill',
      entityId: bill._id.toString(),
      metadata: {
        invoiceNo,
        orderNo: order.orderNo,
        grandTotal: calculation.grandTotal,
      },
    });

    realtimeService.emit(
      REALTIME_EVENTS.ORDER_UPDATED,
      [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
      {
        orderId: order._id.toString(),
        tableId: order.tableId ? order.tableId.toString() : null,
        version: order.version,
      }
    );
    if (order.tableId) {
      realtimeService.emit(REALTIME_EVENTS.TABLE_STATE_CHANGED, REALTIME_ROOMS.POS, {
        tableId: order.tableId.toString(),
      });
    }

    return { bill, order, isIdempotentReturn: false };
  },

  /**
   * Retrieves bill with payment history and remaining balance.
   */
  async getBillById(billId: string) {
    const bill = await Bill.findById(billId)
      .populate('generatedBy', 'name username')
      .populate('voidedBy', 'name username');

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    const payments = await Payment.find({ billId: bill._id }).populate(
      'receivedBy',
      'name username'
    );

    const activePayments = payments.filter((p) => p.status === 'recorded');
    const totalPaidPaise = activePayments.reduce((acc, p) => acc + p.amount, 0);
    const balancePaise = Math.max(0, bill.totals.grandTotal - totalPaidPaise);

    return {
      bill,
      payments,
      totalPaidPaise,
      balancePaise,
    };
  },

  /**
   * Lists bills by date or status.
   */
  async getBills(params: { date?: string; status?: string }) {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const targetDateStr = params.date || nowIst.toFormat('yyyy-MM-dd');

    const startOfTargetDay = DateTime.fromFormat(targetDateStr, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .startOf('day')
      .toJSDate();

    const endOfTargetDay = DateTime.fromFormat(targetDateStr, 'yyyy-MM-dd', {
      zone: 'Asia/Kolkata',
    })
      .endOf('day')
      .toJSDate();

    const filter: Record<string, unknown> = {
      generatedAt: { $gte: startOfTargetDay, $lte: endOfTargetDay },
    };

    if (params.status) {
      filter.status = params.status;
    }

    const bills = await Bill.find(filter)
      .sort({ generatedAt: -1 })
      .populate('generatedBy', 'name username');

    return bills;
  },

  /**
   * Records a payment against a bill. Overpayment is strictly rejected.
   */
  async recordPayment(
    billId: string,
    params: {
      method: 'cash' | 'upi' | 'card' | 'other';
      amount: number;
      reference?: string;
      idempotencyKey?: string;
    },
    userId: string
  ) {
    const bill = await Bill.findById(billId);
    if (!bill) throw new AppError('Bill not found', 404);
    if (bill.status === 'void') throw new AppError('Cannot record payment for a void bill', 409);

    // Idempotency: Return existing payment if duplicate key presented
    if (params.idempotencyKey) {
      const existingPayment = await Payment.findOne({
        billId: bill._id,
        idempotencyKey: params.idempotencyKey,
      });
      if (existingPayment) {
        return { payment: existingPayment, bill, isDuplicate: true };
      }
    }

    const existingPayments = await Payment.find({ billId: bill._id, status: 'recorded' });
    const paidSoFar = existingPayments.reduce((acc, p) => acc + p.amount, 0);
    const balance = bill.totals.grandTotal - paidSoFar;

    if (params.amount > balance) {
      throw new AppError(
        `Payment amount exceeds remaining balance of ₹${(balance / 100).toFixed(2)}`,
        400,
        'PAYMENT_EXCEEDS_TOTAL'
      );
    }

    const payment = await Payment.create({
      billId: bill._id,
      orderId: bill.orderId,
      method: params.method,
      amount: params.amount,
      reference: params.reference,
      receivedBy: new Types.ObjectId(userId),
      receivedAt: new Date(),
      status: 'recorded',
      idempotencyKey: params.idempotencyKey,
    });

    const newTotalPaid = paidSoFar + params.amount;
    const isFullyPaid = newTotalPaid >= bill.totals.grandTotal;

    if (isFullyPaid) {
      bill.status = 'paid';
      bill.paidAt = new Date();
      await bill.save();

      // Complete the order and free the table
      const order = await Order.findById(bill.orderId);
      if (order) {
        order.status = 'paid';
        order.closedAt = new Date();
        order.version += 1;
        await order.save();

        realtimeService.emit(
          REALTIME_EVENTS.ORDER_UPDATED,
          [REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
          {
            orderId: order._id.toString(),
            tableId: order.tableId ? order.tableId.toString() : null,
            version: order.version,
          }
        );
        if (order.tableId) {
          realtimeService.emit(REALTIME_EVENTS.TABLE_STATE_CHANGED, REALTIME_ROOMS.POS, {
            tableId: order.tableId.toString(),
          });
        }
      }
    }

    await auditService.log({
      actorId: userId,
      action: 'payment.recorded',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      metadata: {
        billId: bill._id.toString(),
        invoiceNo: bill.invoiceNo,
        amount: params.amount,
        method: params.method,
        isFullyPaid,
      },
    });

    return { payment, bill, isFullyPaid, isDuplicate: false };
  },

  /**
   * Reverses a recorded payment (partner/manager only with mandatory reason).
   */
  async reversePayment(paymentId: string, reason: string, userId: string) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status === 'reversed') throw new AppError('Payment is already reversed', 400);

    const paymentLocalDate = DateTime.fromJSDate(payment.receivedAt).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
    await closingService.assertDayNotClosed(paymentLocalDate);
    await periodLockService.assertMonthNotFinalized(paymentLocalDate);

    payment.status = 'reversed';
    payment.reversalReason = reason;
    payment.reversedBy = new Types.ObjectId(userId);
    payment.reversedAt = new Date();
    await payment.save();

    // If bill or order were marked paid, return them to issued / billed status
    const bill = await Bill.findById(payment.billId);
    if (bill && bill.status === 'paid') {
      bill.status = 'issued';
      bill.paidAt = undefined;
      await bill.save();

      const order = await Order.findById(bill.orderId);
      if (order && order.status === 'paid') {
        order.status = 'billed';
        order.closedAt = undefined;
        order.version += 1;
        await order.save();
      }
    }

    await auditService.log({
      actorId: userId,
      action: 'payment.reversed',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      metadata: {
        billId: payment.billId.toString(),
        amount: payment.amount,
        reason,
      },
    });

    return { payment, bill };
  },

  /**
   * Voids an issued bill (requires billing:void or valid manager approval token).
   */
  async voidBill(
    billId: string,
    reason: string,
    userId: string,
    userRole?: string,
    approvalToken?: string
  ) {
    const bill = await Bill.findById(billId);
    if (!bill) throw new AppError('Bill not found', 404);
    if (bill.status === 'void') throw new AppError('Bill is already void', 400);

    const billLocalDate = DateTime.fromJSDate(bill.generatedAt).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
    await closingService.assertDayNotClosed(billLocalDate);
    await periodLockService.assertMonthNotFinalized(billLocalDate);

    let approverInfo: { approverId: string; approverName: string } | undefined;
    const canVoidDirectly = userRole ? hasPermission(userRole as Role, 'billing:void') : true;

    if (!canVoidDirectly) {
      if (!approvalToken) {
        throw new AppError(
          'Manager approval required to void a bill',
          403,
          'APPROVAL_REQUIRED',
          { action: 'bill.void' }
        );
      }

      const tokenResult = await approvalService.consumeApprovalToken({
        rawToken: approvalToken,
        action: 'bill.void',
        entityId: billId,
        params: { reason },
        userId,
      });

      approverInfo = {
        approverId: tokenResult.approverId,
        approverName: tokenResult.approverName,
      };
    }

    const payment = await Payment.findOne({ billId: bill._id, status: 'recorded' });
    if (payment) {
      throw new AppError(
        'Cannot void a bill with recorded payments. Reverse payments first.',
        409,
        'BILL_HAS_PAYMENTS'
      );
    }

    bill.status = 'void';
    bill.voidReason = reason;
    bill.voidedBy = new Types.ObjectId(userId);
    bill.voidedAt = new Date();
    await bill.save();

    // Return the order to open state so items can be amended or re-billed
    const order = await Order.findById(bill.orderId);
    if (order && order.status === 'billed') {
      order.status = 'open';
      order.billId = null;
      order.version += 1;
      await order.save();
    }

    await auditService.log({
      actorId: userId,
      action: 'bill.voided',
      entityType: 'Bill',
      entityId: bill._id.toString(),
      metadata: {
        invoiceNo: bill.invoiceNo,
        reason,
        approvedBy: approverInfo?.approverId,
        approverName: approverInfo?.approverName,
      },
    });

    return { bill, order };
  },
};
