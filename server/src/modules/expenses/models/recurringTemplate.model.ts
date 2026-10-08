import { Schema, model, Document, Types } from 'mongoose';
import { PaymentMethod } from './vendor.model';

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface IRecurringExpenseTemplate extends Document {
  title: string;
  categoryId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  amount: number; // integer paise
  frequency: RecurringFrequency;
  dayOfMonth: number; // 1 to 28
  paymentMethod: PaymentMethod;
  paidByPartnerId?: Types.ObjectId;
  isActive: boolean;
  lastGeneratedMonth?: string; // YYYY-MM
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const recurringExpenseTemplateSchema = new Schema<IRecurringExpenseTemplate>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
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
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    dayOfMonth: {
      type: Number,
      default: 1,
      min: 1,
      max: 28,
    },
    paymentMethod: {
      type: String,
      enum: ['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'],
      default: 'bank_transfer',
    },
    paidByPartnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastGeneratedMonth: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const RecurringExpenseTemplate = model<IRecurringExpenseTemplate>(
  'RecurringExpenseTemplate',
  recurringExpenseTemplateSchema
);
