import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrustedDevice extends Document {
  name: string;
  deviceTokenHash: string;
  registeredBy: Types.ObjectId;
  registeredAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date | null;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const trustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    deviceTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TrustedDevice = mongoose.model<ITrustedDevice>('TrustedDevice', trustedDeviceSchema);
