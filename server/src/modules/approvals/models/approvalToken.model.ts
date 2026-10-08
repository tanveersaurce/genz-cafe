import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApprovalToken extends Document {
  tokenHash: string;
  action: string;
  entityId: string;
  paramsHash: string;
  requestedBy: Types.ObjectId;
  approverId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

const approvalTokenSchema = new Schema<IApprovalToken>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    paramsHash: {
      type: String,
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    approverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // Auto-delete on TTL expiry
    },
    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const ApprovalToken = mongoose.model<IApprovalToken>('ApprovalToken', approvalTokenSchema);
