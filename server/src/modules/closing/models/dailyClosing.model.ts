import mongoose, { Schema, Document, Types } from 'mongoose';

export type DailyClosingStatus = 'closed' | 'reopened';

export interface IClosingExpected {
  cashSales: number;
  upiSales: number;
  cardSales: number;
  otherSales: number;
  cashReversals: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
}

export interface IClosingSalesSummary {
  billsIssuedCount: number;
  billsVoidCount: number;
  billsVoidAmount: number;
  grossSales: number;
  discountsTotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  netSales: number;
  cancelledItemsCount: number;
  cancelledItemsValue: number;
  ordersCountByType: {
    dine_in: number;
    takeaway: number;
  };
}

export interface IClosingReopenRecord {
  by: Types.ObjectId;
  at: Date;
  reason: string;
  previousSnapshot: {
    countedCash: number;
    expectedCash: number;
    difference: number;
    cashRetained: number;
    cashHandedOver: number;
    closedAt: Date;
  };
}

export interface IDailyClosing extends Document {
  localDate: string; // IST date YYYY-MM-DD
  status: DailyClosingStatus;
  openingCash: number; // in paise
  openingCashReason?: string;
  countedCash: number; // in paise
  denominations?: Record<string, number>;
  cashRetained: number; // in paise
  cashHandedOver: number; // in paise
  expected: IClosingExpected;
  difference: number; // countedCash - expectedCash (negative = short, positive = excess)
  reportedUpi?: number;
  reportedCard?: number;
  salesSummary: IClosingSalesSummary;
  note?: string;
  closedBy: Types.ObjectId;
  closedAt: Date;
  reopenHistory: IClosingReopenRecord[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const dailyClosingSchema = new Schema<IDailyClosing>(
  {
    localDate: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['closed', 'reopened'],
      default: 'closed',
      index: true,
    },
    openingCash: {
      type: Number,
      required: true,
      min: 0,
    },
    openingCashReason: {
      type: String,
      trim: true,
    },
    countedCash: {
      type: Number,
      required: true,
      min: 0,
    },
    denominations: {
      type: Map,
      of: Number,
    },
    cashRetained: {
      type: Number,
      required: true,
      min: 0,
    },
    cashHandedOver: {
      type: Number,
      required: true,
      min: 0,
    },
    expected: {
      cashSales: { type: Number, required: true },
      upiSales: { type: Number, required: true },
      cardSales: { type: Number, required: true },
      otherSales: { type: Number, required: true },
      cashReversals: { type: Number, required: true },
      cashIn: { type: Number, required: true },
      cashOut: { type: Number, required: true },
      expectedCash: { type: Number, required: true },
    },
    difference: {
      type: Number,
      required: true,
    },
    reportedUpi: {
      type: Number,
    },
    reportedCard: {
      type: Number,
    },
    salesSummary: {
      billsIssuedCount: { type: Number, required: true },
      billsVoidCount: { type: Number, required: true },
      billsVoidAmount: { type: Number, required: true },
      grossSales: { type: Number, required: true },
      discountsTotal: { type: Number, required: true },
      taxableAmount: { type: Number, required: true },
      cgst: { type: Number, required: true },
      sgst: { type: Number, required: true },
      roundOff: { type: Number, required: true },
      netSales: { type: Number, required: true },
      cancelledItemsCount: { type: Number, required: true },
      cancelledItemsValue: { type: Number, required: true },
      ordersCountByType: {
        dine_in: { type: Number, default: 0 },
        takeaway: { type: Number, default: 0 },
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    closedAt: {
      type: Date,
      default: Date.now,
    },
    reopenHistory: [
      {
        by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, default: Date.now },
        reason: { type: String, required: true },
        previousSnapshot: { type: Schema.Types.Mixed, required: true },
      },
    ],
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// One closed record per date
dailyClosingSchema.index({ localDate: 1, status: 1 });

export const DailyClosing = mongoose.model<IDailyClosing>('DailyClosing', dailyClosingSchema);
