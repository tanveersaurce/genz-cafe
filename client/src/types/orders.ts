export type OrderType = 'dine_in' | 'takeaway';

export type OrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type OrderItemStatus =
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';

export interface OrderItem {
  _id?: string;
  id?: string;
  itemId: string;
  name: string;
  variantName?: string;
  quantity: number;
  unitPricePaise: number;
  subtotalPaise: number;
  notes?: string;
  status: OrderItemStatus;
  preparedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface PaymentSplit {
  method: 'cash' | 'upi' | 'card';
  amountPaise: number;
}

export interface PaymentDetails {
  cashReceivedPaise?: number;
  changeGivenPaise?: number;
  upiTransactionId?: string;
  cardLast4?: string;
  splitPayments?: PaymentSplit[];
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
  byUserId?: string | null;
  reason?: string;
}

export interface Order {
  _id: string;
  id: string;
  orderNumber: string;
  type: OrderType;
  tableId?: string | null;
  tableNumber?: number | null;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotalPaise: number;
  taxRatePercent: number;
  taxPaise: number;
  discountPaise: number;
  discountReason?: string;
  roundOffPaise: number;
  totalPaise: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  paymentDetails?: PaymentDetails;
  createdById: string;
  settledById?: string | null;
  cancelledReason?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TableOccupancy {
  tableId: string;
  tableNumber: number;
  label: string;
  zone: string;
  capacity: number;
  isReservable: boolean;
  occupancyStatus: 'available' | 'occupied' | 'billed';
  activeOrder: {
    id: string;
    _id?: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: string;
    itemCount: number;
    totalPaise: number;
    createdAt: string;
  } | null;
}

export interface CreateOrderInput {
  type: OrderType;
  tableId?: string | null;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    itemId: string;
    variantName?: string;
    quantity: number;
    notes?: string;
  }>;
  discountPaise?: number;
  discountReason?: string;
}

export interface AddOrderItemsInput {
  items: Array<{
    itemId: string;
    variantName?: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface SettleOrderInput {
  paymentMethod: PaymentMethod;
  cashReceivedPaise?: number;
  upiTransactionId?: string;
  cardLast4?: string;
  splitPayments?: PaymentSplit[];
  discountPaise?: number;
  discountReason?: string;
}
