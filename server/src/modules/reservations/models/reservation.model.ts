import { Schema, model, Document, Types } from 'mongoose';

export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_SOURCES = ['online', 'phone', 'walk_in', 'staff'] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

export const RESERVATION_OCCASIONS = ['birthday', 'anniversary', 'business', 'other'] as const;
export type ReservationOccasion = (typeof RESERVATION_OCCASIONS)[number];

export interface IStatusHistoryEntry {
  status: ReservationStatus;
  at: Date;
  byUserId: Types.ObjectId | null;
}

export interface IReservation extends Document {
  code: string;
  customerName: string;
  phone: string; // E.164 +91XXXXXXXXXX
  email?: string;
  guests: number;
  startAt: Date;
  endAt: Date;
  localDate: string; // "YYYY-MM-DD" in IST
  status: ReservationStatus;
  source: ReservationSource;
  tableIds: Types.ObjectId[];
  occasion?: ReservationOccasion;
  specialRequest?: string;
  internalNotes?: string;
  idempotencyKey?: string;
  cancelledAt?: Date;
  cancelledBy?: 'customer' | 'staff';
  cancelReason?: string;
  statusHistory: IStatusHistoryEntry[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    byUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const reservationSchema = new Schema<IReservation>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    localDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      enum: RESERVATION_SOURCES,
      default: 'online',
    },
    tableIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Table',
      },
    ],
    occasion: {
      type: String,
      enum: RESERVATION_OCCASIONS,
    },
    specialRequest: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    internalNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      enum: ['customer', 'staff'],
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for rapid day-based and customer query lookups
reservationSchema.index({ localDate: 1, status: 1 });
reservationSchema.index({ phone: 1, status: 1 });

export const Reservation = model<IReservation>('Reservation', reservationSchema);
