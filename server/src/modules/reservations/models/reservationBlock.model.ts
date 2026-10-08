import { Schema, model, Document, Types } from 'mongoose';

export interface IReservationBlock extends Document {
  startAt: Date;
  endAt: Date;
  reason: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reservationBlockSchema = new Schema<IReservationBlock>(
  {
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
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

reservationBlockSchema.index({ startAt: 1, endAt: 1 });

export const ReservationBlock = model<IReservationBlock>('ReservationBlock', reservationBlockSchema);
