import mongoose, { Schema, Document, Types } from 'mongoose';
import { ComputedLineItem, TaxBreakupItem } from '../billingCalculator';

export type BillStatus = 'issued' | 'paid' | 'void';

export interface IBillSettingsSnapshot {
  legalName: string;
  gstin: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  pricesIncludeTax: boolean;
  gstEnabled: boolean;
}

export interface IBillTotals {
  subtotal: number; // in integer paise
  discount: number; // in paise
  taxable: number; // in paise
  cgst: number; // in paise
  sgst: number; // in paise
  totalTax: number; // in paise
  roundOff: number; // in paise (+/-)
  grandTotal: number; // in paise
}

export interface IBillItemSnapshot extends ComputedLineItem {
  name: string;
  variantName?: string;
  foodType: string;
}

export interface IBill extends Document {
  invoiceNo: string; // e.g. "GZ2627-000001", <= 16 chars
  financialYear: string; // e.g. "2026-27"
  orderId: Types.ObjectId;
  orderNo: string;
  tableNumber?: number | null;
  items: IBillItemSnapshot[];
  totals: IBillTotals;
  taxBreakup: TaxBreakupItem[];
  settingsSnapshot: IBillSettingsSnapshot;
  status: BillStatus;
  voidReason?: string;
  voidedBy?: Types.ObjectId;
  voidedAt?: Date;
  generatedBy: Types.ObjectId;
  generatedAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const billItemSnapshotSchema = new Schema<IBillItemSnapshot>(
  {
    lineId: String,
    name: { type: String, required: true },
    variantName: String,
    foodType: { type: String, required: true },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    grossAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    netGrossAmount: { type: Number, required: true },
    gstRate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    cgstAmount: { type: Number, required: true },
    sgstAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const taxBreakupSchema = new Schema<TaxBreakupItem>(
  {
    gstRate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    cgstAmount: { type: Number, required: true },
    sgstAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
  },
  { _id: false }
);

const billTotalsSchema = new Schema<IBillTotals>(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    taxable: { type: Number, required: true },
    cgst: { type: Number, required: true },
    sgst: { type: Number, required: true },
    totalTax: { type: Number, required: true },
    roundOff: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
  },
  { _id: false }
);

const billSettingsSnapshotSchema = new Schema<IBillSettingsSnapshot>(
  {
    legalName: { type: String, required: true },
    gstin: { type: String, required: true },
    address: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    pricesIncludeTax: { type: Boolean, required: true },
    gstEnabled: { type: Boolean, required: true },
  },
  { _id: false }
);

const billSchema = new Schema<IBill>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 16,
    },
    financialYear: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNo: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      default: null,
    },
    items: {
      type: [billItemSnapshotSchema],
      required: true,
    },
    totals: {
      type: billTotalsSchema,
      required: true,
    },
    taxBreakup: {
      type: [taxBreakupSchema],
      required: true,
    },
    settingsSnapshot: {
      type: billSettingsSnapshotSchema,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['issued', 'paid', 'void'],
      default: 'issued',
      index: true,
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
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

export const Bill = mongoose.model<IBill>('Bill', billSchema);
