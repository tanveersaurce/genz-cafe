import { Schema, model, Document, Types } from 'mongoose';

export type LedgerEntryType =
  | 'capital_contribution'
  | 'capital_return'
  | 'profit_share'
  | 'loss_share'
  | 'expense_reimbursement'
  | 'withdrawal'
  | 'adjustment';

export interface IPartnerLedger extends Document {
  partnerId: Types.ObjectId;
  entryDate: string; // YYYY-MM-DD
  type: LedgerEntryType;
  debit: number; // integer paise
  credit: number; // integer paise
  balance?: number; // running balance after this entry
  referenceId?: Types.ObjectId;
  referenceType?: string;
  description: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const partnerLedgerSchema = new Schema<IPartnerLedger>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    entryDate: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'capital_contribution',
        'capital_return',
        'profit_share',
        'loss_share',
        'expense_reimbursement',
        'withdrawal',
        'adjustment',
      ],
      required: true,
      index: true,
    },
    debit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    credit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    balance: {
      type: Number,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    referenceType: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
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

partnerLedgerSchema.index({ partnerId: 1, entryDate: 1, createdAt: 1 });

export const PartnerLedger = model<IPartnerLedger>('PartnerLedger', partnerLedgerSchema);
