import { Schema, model, Document, Types } from 'mongoose';
import { PaymentMethod } from './vendor.model';

export type ExpensePaymentStatus = 'paid' | 'partial' | 'unpaid';
export type ExpenseStatus = 'active' | 'voided';

export interface IExpensePayment {
  _id?: Types.ObjectId;
  method: PaymentMethod;
  amount: number; // integer paise
  paidAt: Date;
  paidBy: Types.ObjectId;
  paidByPartnerId?: Types.ObjectId;
  reference?: string;
  cashMovementId?: Types.ObjectId;
  ledgerEntryId?: Types.ObjectId;
}

export interface IExpense extends Document {
  expenseNo: string;
  expenseDate: string; // YYYY-MM-DD (localDate IST)
  categoryId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  vendorName?: string;
  amount: number; // integer paise
  paymentStatus: ExpensePaymentStatus;
  paidAmount: number; // integer paise
  payments: IExpensePayment[];
  status: ExpenseStatus;
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
  isRecurringInstance: boolean;
  recurringTemplateId?: Types.ObjectId;
  voidReason?: string;
  voidedBy?: Types.ObjectId;
  voidedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expensePaymentSchema = new Schema<IExpensePayment>(
  {
    method: {
      type: String,
      enum: ['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paidByPartnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
    },
    reference: {
      type: String,
      trim: true,
    },
    cashMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'CashMovement',
    },
    ledgerEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerLedger',
    },
  },
  { _id: true }
);

const expenseSchema = new Schema<IExpense>(
  {
    expenseNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expenseDate: {
      type: String,
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partial', 'unpaid'],
      default: 'paid',
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    payments: {
      type: [expensePaymentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'voided'],
      default: 'active',
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    receiptUrl: {
      type: String,
      trim: true,
    },
    isRecurringInstance: {
      type: Boolean,
      default: false,
    },
    recurringTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'RecurringExpenseTemplate',
    },
    voidReason: {
      type: String,
      trim: true,
    },
    voidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    voidedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ expenseDate: 1, categoryId: 1, status: 1 });
expenseSchema.index({ createdAt: -1 });

export const Expense = model<IExpense>('Expense', expenseSchema);
