import { Schema, model, Document, Types } from 'mongoose';

export type WithdrawalPaymentMethod = 'bank_transfer' | 'upi' | 'cash_drawer';
export type WithdrawalStatus = 'recorded' | 'reversed';

export interface IPartnerWithdrawal extends Document {
  partnerId: Types.ObjectId;
  amount: number; // integer paise
  paymentMethod: WithdrawalPaymentMethod;
  effectiveDate: string; // YYYY-MM-DD
  status: WithdrawalStatus;
  reference?: string;
  notes?: string;
  cashMovementId?: Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: Types.ObjectId;
  reversalReason?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const partnerWithdrawalSchema = new Schema<IPartnerWithdrawal>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cash_drawer'],
      required: true,
    },
    effectiveDate: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['recorded', 'reversed'],
      default: 'recorded',
      index: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    cashMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'CashMovement',
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

partnerWithdrawalSchema.index({ partnerId: 1, effectiveDate: -1 });

export const PartnerWithdrawal = model<IPartnerWithdrawal>(
  'PartnerWithdrawal',
  partnerWithdrawalSchema
);
