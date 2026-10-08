import mongoose, { Schema, Document, Types } from 'mongoose';
import { PnlResult } from '../pnlCalculator';

export type StatementStatus = 'draft' | 'finalized' | 'reopened';

export interface IStatementAllocation {
  partnerId: Types.ObjectId;
  partnerNameSnapshot: string;
  basisPoints: number;
  amount: number; // in signed integer paise (profit or loss share)
}

export interface IStatementReopenRecord {
  by: Types.ObjectId;
  at: Date;
  reason: string;
  previousSnapshot?: {
    statementNo: string;
    checksum: string;
    netProfit: number;
    distributableAmount: number;
    finalizedAt?: Date;
  };
}

export interface IMonthlyStatement extends Document {
  month: string; // "YYYY-MM"
  status: StatementStatus;
  version: number;
  statementNo: string; // e.g. "PS-2026-10"
  pnlSnapshot: PnlResult;
  shareScheduleSnapshot: {
    scheduleId?: Types.ObjectId;
    effectiveFrom: string;
    shares: Array<{
      partnerId: Types.ObjectId;
      basisPoints: number;
    }>;
  };
  allocations: IStatementAllocation[];
  retainedAmount: number; // in integer paise
  distributableAmount: number; // in integer paise
  totals: {
    grossSales: number;
    discounts: number;
    netRevenue: number;
    totalTax: number;
    directCosts: number;
    operatingExpenses: number;
    netProfit: number;
  };
  checksum: string; // SHA-256 hex string
  finalizedBy?: Types.ObjectId;
  finalizedAt?: Date;
  reopenHistory: IStatementReopenRecord[];
  isSuperseded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const statementAllocationSchema = new Schema<IStatementAllocation>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    partnerNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    basisPoints: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const statementReopenSchema = new Schema<IStatementReopenRecord>(
  {
    by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    previousSnapshot: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const monthlyStatementSchema = new Schema<IMonthlyStatement>(
  {
    month: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-(?:0[1-9]|1[0-2])$/,
    },
    status: {
      type: String,
      enum: ['draft', 'finalized', 'reopened'],
      default: 'draft',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    statementNo: {
      type: String,
      required: true,
      trim: true,
    },
    pnlSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    shareScheduleSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    allocations: [statementAllocationSchema],
    retainedAmount: {
      type: Number,
      default: 0,
    },
    distributableAmount: {
      type: Number,
      required: true,
    },
    totals: {
      grossSales: { type: Number, required: true },
      discounts: { type: Number, required: true },
      netRevenue: { type: Number, required: true },
      totalTax: { type: Number, required: true },
      directCosts: { type: Number, required: true },
      operatingExpenses: { type: Number, required: true },
      netProfit: { type: Number, required: true },
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    finalizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    finalizedAt: {
      type: Date,
    },
    reopenHistory: [statementReopenSchema],
    isSuperseded: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
monthlyStatementSchema.index({ month: 1, status: 1 });
monthlyStatementSchema.index({ month: 1, isSuperseded: 1 });

export const MonthlyStatement = mongoose.model<IMonthlyStatement>(
  'MonthlyStatement',
  monthlyStatementSchema
);
