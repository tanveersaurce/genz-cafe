import mongoose, { Schema, Document, Types } from 'mongoose';
import { FoodType, GstRate } from '../../menu/models/MenuItem';

export type OrderType = 'dine_in' | 'takeaway';
export type OrderStatus = 'open' | 'billed' | 'paid' | 'cancelled';
export type OrderItemStatus = 'active' | 'cancelled';

export interface IOrderItem {
  lineId: string; // uuid
  menuItemId: Types.ObjectId;
  nameSnapshot: string;
  variantName?: string;
  unitPrice: number; // in integer paise
  gstRateSnapshot: GstRate;
  foodTypeSnapshot: FoodType;
  qty: number;
  note?: string; // max 100
  kotId?: string;
  sentAt?: Date | null;
  status: OrderItemStatus;
  cancelReason?: string;
  cancelledBy?: Types.ObjectId;
  addedBy?: Types.ObjectId | null;
  source?: 'staff' | 'customer';
  submissionId?: string;
}

export type KotStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface IOrderKot {
  kotId: string; // uuid
  kotNo: string; // e.g. "KOT-001"
  itemLineIds: string[];
  sentAt: Date;
  sentBy?: Types.ObjectId | null;
  status: KotStatus;
  receivedAt: Date;
  startedAt?: Date | null;
  readyAt?: Date | null;
  servedAt?: Date | null;
  startedBy?: Types.ObjectId | null;
  readyBy?: Types.ObjectId | null;
  servedBy?: Types.ObjectId | null;
  source?: 'staff' | 'customer';
  customerName?: string;
  submissionId?: string;
}

export interface IOrderDiscount {
  type: 'flat' | 'percent';
  value: number; // flat: paise, percent: 0-100
  reason: string;
  appliedBy: Types.ObjectId;
}

export interface IOrder extends Document {
  orderNo: string; // display "T-001" style
  localDate: string; // IST "YYYY-MM-DD"
  type: OrderType;
  tableId?: Types.ObjectId | null;
  tableNumber?: number | null;
  reservationId?: Types.ObjectId | null;
  customerName?: string;
  customerPhone?: string;
  status: OrderStatus;
  items: IOrderItem[];
  kots: IOrderKot[];
  discount?: IOrderDiscount | null;
  billId?: Types.ObjectId | null;
  version: number; // optimistic concurrency version
  idempotencyKeys: string[];
  openedBy?: Types.ObjectId | null;
  closedAt?: Date | null;
  hasUnacknowledgedCustomerSubmission?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    lineId: {
      type: String,
      required: true,
    },
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    nameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    variantName: {
      type: String,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPrice must be an integer in paise',
      },
    },
    gstRateSnapshot: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18],
    },
    foodTypeSnapshot: {
      type: String,
      required: true,
      enum: ['veg', 'non_veg', 'egg'],
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer between 1 and 50',
      },
    },
    note: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    kotId: {
      type: String,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
    cancelReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    source: {
      type: String,
      enum: ['staff', 'customer'],
      default: 'staff',
    },
    submissionId: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const orderKotSchema = new Schema<IOrderKot>(
  {
    kotId: {
      type: String,
      required: true,
    },
    kotNo: {
      type: String,
      required: true,
    },
    itemLineIds: {
      type: [String],
      required: true,
      default: [],
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'served', // legacy KOTs without status default to 'served' so they don't appear on active kitchen board
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    readyAt: {
      type: Date,
      default: null,
    },
    servedAt: {
      type: Date,
      default: null,
    },
    startedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readyBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    servedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    source: {
      type: String,
      enum: ['staff', 'customer'],
      default: 'staff',
    },
    customerName: {
      type: String,
      trim: true,
    },
    submissionId: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const orderDiscountSchema = new Schema<IOrderDiscount>(
  {
    type: {
      type: String,
      required: true,
      enum: ['flat', 'percent'],
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    appliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNo: {
      type: String,
      required: true,
      index: true,
    },
    localDate: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['dine_in', 'takeaway'],
      index: true,
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      default: null,
    },
    tableNumber: {
      type: Number,
      default: null,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'billed', 'paid', 'cancelled'],
      default: 'open',
      index: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
      validate: [
        (items: IOrderItem[]) => items.length <= 60,
        'Cannot have more than 60 items per order',
      ],
    },
    kots: {
      type: [orderKotSchema],
      default: [],
    },
    discount: {
      type: orderDiscountSchema,
      default: null,
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
    idempotencyKeys: {
      type: [String],
      default: [],
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    hasUnacknowledgedCustomerSubmission: {
      type: Boolean,
      default: false,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

// Indexes
orderSchema.index({ localDate: 1, status: 1 });
orderSchema.index({ tableId: 1, status: 1 });
orderSchema.index({ orderNo: 1 });

// Critical rule: At most ONE order with status "open" or "billed" per table for dine-in orders
orderSchema.index(
  { tableId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'dine_in',
      status: { $in: ['open', 'billed'] },
    },
  }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
