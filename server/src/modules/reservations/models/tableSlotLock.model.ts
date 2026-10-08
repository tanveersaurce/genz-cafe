import { Schema, model, Document, Types } from 'mongoose';

export interface ITableSlotLock extends Document {
  tableId: Types.ObjectId;
  slotStart: Date;
  reservationId: Types.ObjectId;
  createdAt: Date;
}

const tableSlotLockSchema = new Schema<ITableSlotLock>(
  {
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    slotStart: {
      type: Date,
      required: true,
      index: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // TTL index to automatically prune locks older than 7 days
      expires: 60 * 60 * 24 * 7,
    },
  },
  {
    timestamps: false,
  }
);

// Double-Booking Guard: Unique compound index on tableId + slotStart
// Prevents race conditions and guarantees mutual exclusion at database engine level
tableSlotLockSchema.index({ tableId: 1, slotStart: 1 }, { unique: true });

export const TableSlotLock = model<ITableSlotLock>('TableSlotLock', tableSlotLockSchema);
