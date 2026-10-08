import { Schema, model, Document, Types } from 'mongoose';

export interface IBankDetails {
  accountNo?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
}

export interface IPartner extends Document {
  name: string;
  email?: string;
  phone?: string;
  userId?: Types.ObjectId;
  pan?: string;
  bankDetails?: IBankDetails;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true,
    },
    bankDetails: {
      accountNo: { type: String, trim: true },
      ifsc: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Partner = model<IPartner>('Partner', partnerSchema);
