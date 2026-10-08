import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMenuPriceHistory extends Document {
  itemId: Types.ObjectId;
  variantName?: string | null;
  oldPrice: number; // in paise
  newPrice: number; // in paise
  changedBy: Types.ObjectId;
  changedAt: Date;
}

const menuPriceHistorySchema = new Schema<IMenuPriceHistory>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
      index: true,
    },
    variantName: {
      type: String,
      default: null,
      trim: true,
    },
    oldPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    newPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Price change lookup ordered by date descending
menuPriceHistorySchema.index({ itemId: 1, changedAt: -1 });

export const MenuPriceHistory = mongoose.model<IMenuPriceHistory>(
  'MenuPriceHistory',
  menuPriceHistorySchema
);
