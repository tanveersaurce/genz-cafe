import mongoose, { Schema, Document, Types } from 'mongoose';

export const CASH_MOVEMENT_TYPES = ['in', 'out'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_MOVEMENT_CATEGORIES = [
  'float_in',
  'purchase',
  'staff_advance',
  'owner_withdrawal',
  'other',
] as const;
export type CashMovementCategory = (typeof CASH_MOVEMENT_CATEGORIES)[number];

export type CashMovementStatus = 'recorded' | 'reversed';

export interface ICashMovement extends Document {
  localDate: string; // IST date YYYY-MM-DD
  type: CashMovementType;
  amount: number; // in integer paise (> 0)
  category: CashMovementCategory;
  reason: string;
  note?: string;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  status: CashMovementStatus;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reverseReason?: string;
  approvalTokenId?: Types.ObjectId;
  approvalApproverId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cashMovementSchema = new Schema<ICashMovement>(
  {
    localDate: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1, // in paise
    },
    category: {
      type: String,
      enum: ['float_in', 'purchase', 'staff_advance', 'owner_withdrawal', 'other'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['recorded', 'reversed'],
      default: 'recorded',
      index: true,
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: {
      type: Date,
    },
    reverseReason: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    approvalTokenId: {
      type: Schema.Types.ObjectId,
      ref: 'ApprovalToken',
    },
    approvalApproverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for day filtering
cashMovementSchema.index({ localDate: 1, status: 1 });

export const CashMovement = mongoose.model<ICashMovement>('CashMovement', cashMovementSchema);
