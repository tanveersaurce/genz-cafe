import { Schema, model, Document } from 'mongoose';

export type ExpenseCategoryType =
  | 'cogs_purchase'
  | 'operating'
  | 'payroll'
  | 'rent_utilities'
  | 'marketing'
  | 'maintenance'
  | 'other_operating'
  | 'non_operating';

export interface IExpenseCategory extends Document {
  name: string;
  type: ExpenseCategoryType;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'cogs_purchase',
        'operating',
        'payroll',
        'rent_utilities',
        'marketing',
        'maintenance',
        'other_operating',
        'non_operating',
      ],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

expenseCategorySchema.index({ type: 1, sortOrder: 1, name: 1 });

export const ExpenseCategory = model<IExpenseCategory>('ExpenseCategory', expenseCategorySchema);
