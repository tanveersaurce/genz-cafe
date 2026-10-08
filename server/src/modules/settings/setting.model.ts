import { Schema, model, Document, Types } from 'mongoose';

export interface ISetting<T = unknown> extends Document {
  key: string;
  value: T;
  updatedBy?: Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Setting = model<ISetting>('Setting', settingSchema);
