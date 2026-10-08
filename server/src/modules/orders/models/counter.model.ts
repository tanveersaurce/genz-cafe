import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  key: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const counterSchema = new Schema<ICounter>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

/**
 * Atomically increments and returns the next sequence number for a key.
 * Never performs read-then-write; always uses atomic $inc with upsert.
 */
export const getNextSequence = async (key: string): Promise<number> => {
  const result = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return result.seq;
};
