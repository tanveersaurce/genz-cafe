import { Schema, model, Document, Types } from 'mongoose';

export interface IPartnerShare {
  partnerId: Types.ObjectId;
  basisPoints: number; // integer 0..10000
}

export interface IPartnerShareSchedule extends Document {
  effectiveFrom: string; // YYYY-MM-01
  shares: IPartnerShare[];
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const partnerShareSchema = new Schema<IPartnerShare>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    basisPoints: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },
  },
  { _id: false }
);

const partnerShareScheduleSchema = new Schema<IPartnerShareSchedule>(
  {
    effectiveFrom: {
      type: String,
      required: true,
      index: true,
    },
    shares: {
      type: [partnerShareSchema],
      required: true,
      validate: [
        (val: IPartnerShare[]) => val.length > 0,
        'At least one partner share required',
      ],
    },
    notes: {
      type: String,
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

partnerShareScheduleSchema.index({ effectiveFrom: -1 });

export const PartnerShareSchedule = model<IPartnerShareSchedule>(
  'PartnerShareSchedule',
  partnerShareScheduleSchema
);
