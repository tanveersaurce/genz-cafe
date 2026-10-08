import crypto from 'crypto';
import { Schema, model, Document } from 'mongoose';

export const TABLE_ZONES = ['indoor', 'outdoor', 'window', 'family', 'other'] as const;
export type TableZone = (typeof TABLE_ZONES)[number];

export const generateTableQrToken = (): string => {
  return crypto.randomBytes(16).toString('base64url');
};

export interface ITable extends Document {
  number: number;
  label?: string;
  capacity: number;
  zone: TableZone;
  isReservable: boolean;
  isActive: boolean;
  sortOrder: number;
  notes?: string;
  qrToken?: string;
  qrTokenRotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tableSchema = new Schema<ITable>(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 99,
      index: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      index: true,
    },
    zone: {
      type: String,
      enum: TABLE_ZONES,
      default: 'indoor',
      index: true,
    },
    isReservable: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    qrToken: {
      type: String,
      unique: true,
      sparse: true,
      default: () => generateTableQrToken(),
      index: true,
    },
    qrTokenRotatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? ret._id.toString() : '';
        ret.tableNumber = ret.number;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Table = model<ITable>('Table', tableSchema);
