import { Schema, model, Document, Types } from 'mongoose';
import { KotStatus } from './order.model';

export interface ICustomerSubmissionItem {
  lineId?: string;
  nameSnapshot: string;
  variantName?: string;
  qty: number;
  note?: string;
}

export interface ICustomerSubmission extends Document {
  submissionId: string; // uuid
  orderId: Types.ObjectId;
  tableId: Types.ObjectId;
  tableNumber: number;
  customerName: string;
  customerPhone?: string | null;
  kotId: string;
  kotNo: string;
  itemSummaries: ICustomerSubmissionItem[];
  ipHash: string; // SHA-256 of IP, never raw IP
  userAgentHash?: string;
  idempotencyKey: string;
  status: KotStatus;
  cancelledByCustomerAt?: Date | null;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: Types.ObjectId | null;
  publicAccessTokenHash: string; // SHA-256 of 128-bit raw URL token
  undoUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSubmissionItemSchema = new Schema<ICustomerSubmissionItem>(
  {
    lineId: { type: String },
    nameSnapshot: { type: String, required: true },
    variantName: { type: String },
    qty: { type: Number, required: true },
    note: { type: String },
  },
  { _id: false }
);

const customerSubmissionSchema = new Schema<ICustomerSubmission>(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    tableNumber: {
      type: Number,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      default: null,
      trim: true,
    },
    kotId: {
      type: String,
      required: true,
      index: true,
    },
    kotNo: {
      type: String,
      required: true,
    },
    itemSummaries: {
      type: [customerSubmissionItemSchema],
      default: [],
    },
    ipHash: {
      type: String,
      required: true,
      index: true,
    },
    userAgentHash: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'new',
      index: true,
    },
    cancelledByCustomerAt: {
      type: Date,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
      index: true,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publicAccessTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    undoUntil: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast queries & abuse prevention
customerSubmissionSchema.index({ tableId: 1, idempotencyKey: 1 }, { unique: true });
customerSubmissionSchema.index({ tableId: 1, createdAt: -1 });
customerSubmissionSchema.index({ acknowledgedAt: 1, createdAt: -1 });
customerSubmissionSchema.index({ createdAt: 1, customerPhone: 1 });

export const CustomerSubmission = model<ICustomerSubmission>(
  'CustomerSubmission',
  customerSubmissionSchema
);
