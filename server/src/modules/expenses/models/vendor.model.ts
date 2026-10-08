import { Schema, model, Document, Types } from 'mongoose';

export type PaymentMethod = 'cash_drawer' | 'upi' | 'bank_transfer' | 'card' | 'owner_paid';

export interface IVendor extends Document {
  name: string;
  category?: Types.ObjectId;
  gstin?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  defaultPaymentMethod?: PaymentMethod;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    defaultPaymentMethod: {
      type: String,
      enum: ['cash_drawer', 'upi', 'bank_transfer', 'card', 'owner_paid'],
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Vendor = model<IVendor>('Vendor', vendorSchema);
