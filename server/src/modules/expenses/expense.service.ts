import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { Expense, IExpense, ExpensePaymentStatus, IExpensePayment } from './models/expense.model';
import { ExpenseCategory } from './models/expenseCategory.model';
import { Vendor, PaymentMethod } from './models/vendor.model';
import { RecurringExpenseTemplate } from './models/recurringTemplate.model';
import { CashMovement } from '../cash/models/cashMovement.model';
import { PartnerLedger } from '../partners/models/partnerLedger.model';
import { Partner } from '../partners/models/partner.model';
import { getNextSequence } from '../orders/models/counter.model';
import { periodLockService } from '../finance/periodLock.service';
import { closingService } from '../closing/closing.service';
import { DailyClosing } from '../closing/models/dailyClosing.model';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface CreateExpenseParams {
  expenseDate: string; // YYYY-MM-DD
  categoryId: string;
  vendorId?: string;
  vendorName?: string;
  amount: number; // integer paise
  isPaid?: boolean;
  paymentMethod?: PaymentMethod;
  paidByPartnerId?: string;
  reference?: string;
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
}

export interface UpdateExpenseParams {
  categoryId?: string;
  vendorId?: string;
  vendorName?: string;
  amount?: number;
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
}

export interface AddPaymentParams {
  method: PaymentMethod;
  amount: number;
  paidByPartnerId?: string;
  reference?: string;
}

export interface ExpenseListParams {
  from?: string;
  to?: string;
  categoryId?: string;
  vendorId?: string;
  status?: string;
  paymentStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const expenseService = {
  /**
   * Generates next sequential expense number: EXP-YYYYMM-XXXX
   */
  async generateExpenseNumber(expenseDate: string): Promise<string> {
    const ym = expenseDate.substring(0, 7).replace('-', '');
    const seq = await getNextSequence(`expense:${ym}`);
    return `EXP-${ym}-${String(seq).padStart(4, '0')}`;
  },

  /**
   * Creates an expense entry. Handles cash drawer movement and partner ledger if owner_paid.
   */
  async createExpense(
    params: CreateExpenseParams,
    userId: string,
    _userRole: string
  ): Promise<IExpense> {
    await periodLockService.assertMonthNotFinalized(params.expenseDate);

    const category = await ExpenseCategory.findById(params.categoryId);
    if (!category || !category.isActive) {
      throw new AppError('Invalid or inactive expense category', 400);
    }

    let vendorName = params.vendorName;
    if (params.vendorId) {
      const vendor = await Vendor.findById(params.vendorId);
      if (!vendor) {
        throw new AppError('Invalid vendor ID', 400);
      }
      if (!vendorName) {
        vendorName = vendor.name;
      }
    }

    // 5-minute duplicate check warning detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const possibleDuplicate = await Expense.findOne({
      expenseDate: params.expenseDate,
      categoryId: params.categoryId,
      amount: params.amount,
      createdAt: { $gte: fiveMinutesAgo },
      status: 'active',
    });

    const expenseNo = await this.generateExpenseNumber(params.expenseDate);

    const payments: IExpensePayment[] = [];
    let paidAmount = 0;
    let paymentStatus: ExpensePaymentStatus = 'unpaid';

    if (params.isPaid && params.paymentMethod) {
      const paymentMethod = params.paymentMethod;
      let cashMovementId: Types.ObjectId | undefined;
      let ledgerEntryId: Types.ObjectId | undefined;

      // Handle cash drawer payment
      if (paymentMethod === 'cash_drawer') {
        await closingService.assertDayNotClosed(params.expenseDate);

        const movement = new CashMovement({
          localDate: params.expenseDate,
          type: 'out',
          amount: params.amount,
          category: 'purchase',
          reason: `Expense ${expenseNo}: ${params.notes || category.name}`,
          recordedBy: new Types.ObjectId(userId),
          recordedAt: new Date(),
          status: 'recorded',
        });
        await movement.save();
        cashMovementId = movement._id as Types.ObjectId;
      }

      // Handle owner paid
      if (paymentMethod === 'owner_paid') {
        if (!params.paidByPartnerId) {
          throw new AppError('Partner ID is required when payment method is owner_paid', 400);
        }
        const partner = await Partner.findById(params.paidByPartnerId);
        if (!partner) {
          throw new AppError('Partner not found', 404);
        }

        const ledgerEntry = new PartnerLedger({
          partnerId: partner._id,
          entryDate: params.expenseDate,
          type: 'expense_reimbursement',
          debit: 0,
          credit: params.amount,
          description: `Expense reimbursement: ${expenseNo} (${category.name})`,
          referenceType: 'Expense',
          createdBy: new Types.ObjectId(userId),
        });
        await ledgerEntry.save();
        ledgerEntryId = ledgerEntry._id as Types.ObjectId;
      }

      payments.push({
        method: paymentMethod,
        amount: params.amount,
        paidAt: new Date(),
        paidBy: new Types.ObjectId(userId),
        paidByPartnerId: params.paidByPartnerId ? new Types.ObjectId(params.paidByPartnerId) : undefined,
        reference: params.reference,
        cashMovementId,
        ledgerEntryId,
      });

      paidAmount = params.amount;
      paymentStatus = 'paid';
    }

    const expense = new Expense({
      expenseNo,
      expenseDate: params.expenseDate,
      categoryId: new Types.ObjectId(params.categoryId),
      vendorId: params.vendorId ? new Types.ObjectId(params.vendorId) : undefined,
      vendorName,
      amount: params.amount,
      paymentStatus,
      paidAmount,
      payments,
      status: 'active',
      invoiceNumber: params.invoiceNumber,
      notes: params.notes,
      receiptUrl: params.receiptUrl,
      createdBy: new Types.ObjectId(userId),
    });

    try {
      await expense.save();
    } catch (saveErr) {
      // Rollback dual writes if expense saving fails
      if (payments[0]?.cashMovementId) {
        await CashMovement.deleteOne({ _id: payments[0].cashMovementId });
      }
      if (payments[0]?.ledgerEntryId) {
        await PartnerLedger.deleteOne({ _id: payments[0].ledgerEntryId });
      }
      throw saveErr;
    }

    await auditService.log({
      actorId: userId,
      action: 'expenses.created',
      entityType: 'Expense',
      entityId: expense._id.toString(),
      metadata: {
        expenseNo,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        isPaid: params.isPaid,
        hasDuplicateWarning: !!possibleDuplicate,
      },
    });

    return expense;
  },

  /**
   * Updates an expense. Partner can edit open periods; Manager can edit only own within 24h.
   */
  async updateExpense(
    expenseId: string,
    params: UpdateExpenseParams,
    userId: string,
    userRole: string
  ): Promise<IExpense> {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }
    if (expense.status === 'voided') {
      throw new AppError('Cannot edit a voided expense', 400);
    }

    await periodLockService.assertMonthNotFinalized(expense.expenseDate);

    if (userRole === 'manager') {
      if (expense.createdBy.toString() !== userId) {
        throw new AppError('Managers can only edit expenses they created', 403);
      }
      const ageHours = (Date.now() - expense.createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        throw new AppError('Managers can only edit expenses within 24 hours of creation', 403);
      }
    }

    if (params.categoryId) {
      const category = await ExpenseCategory.findById(params.categoryId);
      if (!category) throw new AppError('Invalid category ID', 400);
      expense.categoryId = category._id as Types.ObjectId;
    }
    if (params.vendorId !== undefined) {
      if (params.vendorId) {
        const vendor = await Vendor.findById(params.vendorId);
        if (!vendor) throw new AppError('Invalid vendor ID', 400);
        expense.vendorId = vendor._id as Types.ObjectId;
        if (!params.vendorName) expense.vendorName = vendor.name;
      } else {
        expense.vendorId = undefined;
      }
    }
    if (params.vendorName !== undefined) expense.vendorName = params.vendorName;
    if (params.invoiceNumber !== undefined) expense.invoiceNumber = params.invoiceNumber;
    if (params.notes !== undefined) expense.notes = params.notes;
    if (params.receiptUrl !== undefined) expense.receiptUrl = params.receiptUrl;

    if (params.amount !== undefined && params.amount !== expense.amount) {
      if (expense.payments.length > 0) {
        throw new AppError(
          'Cannot directly change total amount on an expense with recorded payments. Void and recreate, or adjust payments.',
          400
        );
      }
      expense.amount = params.amount;
    }

    expense.updatedBy = new Types.ObjectId(userId);
    await expense.save();

    await auditService.log({
      actorId: userId,
      action: 'expenses.updated',
      entityType: 'Expense',
      entityId: expense._id.toString(),
      metadata: {
        expenseNo: expense.expenseNo,
        changes: params,
      },
    });

    return expense;
  },

  /**
   * Voids an expense (partner only). Reverses any linked cash drawer movements or partner ledger entries.
   */
  async voidExpense(expenseId: string, reason: string, userId: string): Promise<IExpense> {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }
    if (expense.status === 'voided') {
      throw new AppError('Expense is already voided', 400);
    }

    await periodLockService.assertMonthNotFinalized(expense.expenseDate);

    // Reversal of payments
    for (const payment of expense.payments) {
      if (payment.cashMovementId) {
        const movement = await CashMovement.findById(payment.cashMovementId);
        if (movement && movement.status === 'recorded') {
          // If the day is still open, mark reversed; if already closed, create compensating 'in' movement
          const closing = await DailyClosing.findOne({ localDate: movement.localDate, status: 'closed' });
          if (closing) {
            const compensatingMovement = new CashMovement({
              localDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
              type: 'in',
              amount: payment.amount,
              category: 'purchase',
              reason: `Compensating reversal for voided expense ${expense.expenseNo}`,
              recordedBy: new Types.ObjectId(userId),
              recordedAt: new Date(),
              status: 'recorded',
            });
            await compensatingMovement.save();
          } else {
            movement.status = 'reversed';
            movement.reversedBy = new Types.ObjectId(userId);
            movement.reversedAt = new Date();
            movement.reverseReason = `Expense ${expense.expenseNo} voided: ${reason}`;
            await movement.save();
          }
        }
      }

      if (payment.ledgerEntryId) {
        const partner = await Partner.findById(payment.paidByPartnerId);
        if (partner) {
          const reversalLedger = new PartnerLedger({
            partnerId: partner._id,
            entryDate: expense.expenseDate,
            type: 'adjustment',
            debit: payment.amount,
            credit: 0,
            description: `Void reversal for expense ${expense.expenseNo}`,
            referenceId: expense._id,
            referenceType: 'Expense',
            createdBy: new Types.ObjectId(userId),
          });
          await reversalLedger.save();
        }
      }
    }

    expense.status = 'voided';
    expense.voidReason = reason;
    expense.voidedBy = new Types.ObjectId(userId);
    expense.voidedAt = new Date();
    await expense.save();

    await auditService.log({
      actorId: userId,
      action: 'expenses.voided',
      entityType: 'Expense',
      entityId: expense._id.toString(),
      metadata: {
        expenseNo: expense.expenseNo,
        amount: expense.amount,
        reason,
      },
    });

    return expense;
  },

  /**
   * Adds a payment to an unpaid or partially paid expense.
   */
  async addPayment(
    expenseId: string,
    params: AddPaymentParams,
    userId: string
  ): Promise<IExpense> {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }
    if (expense.status === 'voided') {
      throw new AppError('Cannot add payment to a voided expense', 400);
    }

    await periodLockService.assertMonthNotFinalized(expense.expenseDate);

    const remaining = expense.amount - expense.paidAmount;
    if (params.amount > remaining) {
      throw new AppError(`Payment amount (₹${params.amount / 100}) exceeds remaining balance (₹${remaining / 100})`, 400);
    }

    let cashMovementId: Types.ObjectId | undefined;
    let ledgerEntryId: Types.ObjectId | undefined;

    if (params.method === 'cash_drawer') {
      const todayIst = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
      await closingService.assertDayNotClosed(todayIst);

      const movement = new CashMovement({
        localDate: todayIst,
        type: 'out',
        amount: params.amount,
        category: 'purchase',
        reason: `Payment on expense ${expense.expenseNo}`,
        recordedBy: new Types.ObjectId(userId),
        recordedAt: new Date(),
        status: 'recorded',
      });
      await movement.save();
      cashMovementId = movement._id as Types.ObjectId;
    }

    if (params.method === 'owner_paid') {
      if (!params.paidByPartnerId) {
        throw new AppError('Partner ID is required when payment method is owner_paid', 400);
      }
      const partner = await Partner.findById(params.paidByPartnerId);
      if (!partner) throw new AppError('Partner not found', 404);

      const ledgerEntry = new PartnerLedger({
        partnerId: partner._id,
        entryDate: DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd'),
        type: 'expense_reimbursement',
        debit: 0,
        credit: params.amount,
        description: `Expense payment: ${expense.expenseNo}`,
        referenceId: expense._id,
        referenceType: 'Expense',
        createdBy: new Types.ObjectId(userId),
      });
      await ledgerEntry.save();
      ledgerEntryId = ledgerEntry._id as Types.ObjectId;
    }

    expense.payments.push({
      method: params.method,
      amount: params.amount,
      paidAt: new Date(),
      paidBy: new Types.ObjectId(userId),
      paidByPartnerId: params.paidByPartnerId ? new Types.ObjectId(params.paidByPartnerId) : undefined,
      reference: params.reference,
      cashMovementId,
      ledgerEntryId,
    });

    expense.paidAmount += params.amount;
    expense.paymentStatus = expense.paidAmount >= expense.amount ? 'paid' : 'partial';
    await expense.save();

    await auditService.log({
      actorId: userId,
      action: 'expenses.payment_added',
      entityType: 'Expense',
      entityId: expense._id.toString(),
      metadata: {
        expenseNo: expense.expenseNo,
        amount: params.amount,
        method: params.method,
        remainingBalance: expense.amount - expense.paidAmount,
      },
    });

    return expense;
  },

  /**
   * Retrieves paginated list of expenses.
   */
  async listExpenses(params: ExpenseListParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (params.from || params.to) {
      query.expenseDate = {};
      if (params.from) (query.expenseDate as Record<string, string>).$gte = params.from;
      if (params.to) (query.expenseDate as Record<string, string>).$lte = params.to;
    }

    if (params.categoryId) query.categoryId = new Types.ObjectId(params.categoryId);
    if (params.vendorId) query.vendorId = new Types.ObjectId(params.vendorId);
    if (params.status) query.status = params.status;
    if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params.search) {
      query.$or = [
        { expenseNo: { $regex: params.search, $options: 'i' } },
        { vendorName: { $regex: params.search, $options: 'i' } },
        { invoiceNumber: { $regex: params.search, $options: 'i' } },
        { notes: { $regex: params.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Expense.find(query)
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('categoryId', 'name type')
        .populate('vendorId', 'name phone')
        .populate('createdBy', 'name email')
        .lean(),
      Expense.countDocuments(query),
    ]);

    // Aggregate summary numbers
    const summaryAgg = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' },
        },
      },
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary: {
        totalAmount: summaryAgg[0]?.totalAmount || 0,
        totalPaid: summaryAgg[0]?.totalPaid || 0,
      },
    };
  },

  /**
   * Generates recurring expenses for a target month (YYYY-MM).
   */
  async generateRecurringExpenses(targetMonth: string, userId: string) {
    await periodLockService.assertMonthNotFinalized(`${targetMonth}-01`);

    const templates = await RecurringExpenseTemplate.find({ isActive: true });
    const generated: IExpense[] = [];

    for (const t of templates) {
      if (t.lastGeneratedMonth === targetMonth) continue;

      const dayStr = String(Math.min(28, t.dayOfMonth)).padStart(2, '0');
      const expenseDate = `${targetMonth}-${dayStr}`;

      const expense = await this.createExpense(
        {
          expenseDate,
          categoryId: t.categoryId.toString(),
          vendorId: t.vendorId ? t.vendorId.toString() : undefined,
          amount: t.amount,
          isPaid: false, // Default to unpaid for review
          notes: `Recurring auto-generated: ${t.title}`,
        },
        userId,
        'partner'
      );

      expense.isRecurringInstance = true;
      expense.recurringTemplateId = t._id as Types.ObjectId;
      await expense.save();

      t.lastGeneratedMonth = targetMonth;
      await t.save();

      generated.push(expense);
    }

    return generated;
  },
};
