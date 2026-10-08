import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type PaymentStatus = 'recorded' | 'reversed';

export interface IPayment extends Document {
  billId: Types.ObjectId;
  orderId: Types.ObjectId;
  method: PaymentMethod;
  amount: number; // in integer paise
  reference?: string; // max 40 chars
  receivedBy: Types.ObjectId;
  receivedAt: Date;
  status: PaymentStatus;
  reversalReason?: string;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    billId: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
      enum: ['cash', 'upi', 'card', 'other'],
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Payment amount must be a positive integer in paise',
      },
    },
    reference: {
      type: String,
      maxlength: 40,
      trim: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: ['recorded', 'reversed'],
      default: 'recorded',
      index: true,
    },
    reversalReason: {
      type: String,
      trim: true,
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: {
      type: Date,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
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

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
