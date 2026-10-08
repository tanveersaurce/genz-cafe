import { Schema, model, Document, Types } from 'mongoose';

export type CapitalEntryType = 'contribution' | 'capital_return';
export type CapitalPaymentMethod = 'bank_transfer' | 'upi' | 'cash_drawer' | 'cheque' | 'other';

export interface ICapitalEntry extends Document {
  partnerId: Types.ObjectId;
  type: CapitalEntryType;
  amount: number; // integer paise
  effectiveDate: string; // YYYY-MM-DD
  paymentMethod: CapitalPaymentMethod;
  reference?: string;
  notes?: string;
  isReversed: boolean;
  reversedAt?: Date;
  reversedBy?: Types.ObjectId;
  reversalReason?: string;
  reversalEntryId?: Types.ObjectId;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const capitalEntrySchema = new Schema<ICapitalEntry>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['contribution', 'capital_return'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    effectiveDate: {
      type: String,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cash_drawer', 'cheque', 'other'],
      default: 'bank_transfer',
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversedAt: {
      type: Date,
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reversalReason: {
      type: String,
      trim: true,
    },
    reversalEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'CapitalEntry',
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

capitalEntrySchema.index({ partnerId: 1, effectiveDate: -1 });

export const CapitalEntry = model<ICapitalEntry>('CapitalEntry', capitalEntrySchema);
