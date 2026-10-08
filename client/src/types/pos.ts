import { CalculationResult } from '../lib/billingCalculator';

export type TableLiveStatus = 'free' | 'occupied' | 'billed' | 'reserved_soon';

export interface PosTable {
  tableId: string;
  tableNumber: number;
  label?: string;
  capacity: number;
  zone: string;
  status: TableLiveStatus;
  readyCount?: number;
  oldestReadyMinutes?: number;
  hasUnacknowledgedCustomerSubmission?: boolean;
  openOrder: {
    orderId: string;
    orderNo: string;
    itemsCount: number;
    runningTotalPaise: number;
    ageMinutes: number;
  } | null;
  reservedSoon: {
    reservationId: string;
    startTime: string;
    customerName: string;
    partySize: number;
  } | null;
}

export interface PosOrderItem {
  lineId: string;
  menuItemId: string;
  nameSnapshot: string;
  variantName?: string;
  unitPrice: number; // in integer paise
  gstRateSnapshot: number;
  foodTypeSnapshot: 'veg' | 'non_veg' | 'egg';
  qty: number;
  note?: string;
  kotId?: string;
  sentAt?: string | null;
  status: 'active' | 'cancelled';
  cancelReason?: string;
  addedBy?: {
    id?: string;
    _id?: string;
    name?: string;
  };
  source?: 'staff' | 'customer';
  submissionId?: string;
}

export interface PosOrderKot {
  kotId: string;
  kotNo: string;
  itemLineIds: string[];
  sentAt: string;
  status?: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  receivedAt?: string;
  startedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  source?: 'staff' | 'customer';
  customerName?: string;
  submissionId?: string;
}

export interface PosOrder {
  _id: string;
  id: string;
  orderNo: string;
  localDate: string;
  type: 'dine_in' | 'takeaway';
  tableId?: string | null;
  tableNumber?: number | null;
  reservationId?: string | null;
  customerName?: string;
  customerPhone?: string;
  status: 'open' | 'billed' | 'paid' | 'cancelled';
  items: PosOrderItem[];
  kots: PosOrderKot[];
  discount?: {
    type: 'flat' | 'percent';
    value: number;
    reason: string;
  } | null;
  billId?: string | null;
  version: number;
  openedBy: {
    id?: string;
    _id?: string;
    name?: string;
    username?: string;
  };
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosBill {
  _id: string;
  id: string;
  invoiceNo: string;
  financialYear: string;
  orderId: string;
  orderNo: string;
  tableNumber?: number | null;
  items: {
    lineId?: string;
    name: string;
    variantName?: string;
    foodType: string;
    qty: number;
    unitPrice: number;
    grossAmount: number;
    discountAmount: number;
    netGrossAmount: number;
    gstRate: number;
    taxableAmount: number;
    taxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    totalAmount: number;
  }[];
  totals: {
    subtotal: number;
    discount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    totalTax: number;
    roundOff: number;
    grandTotal: number;
  };
  taxBreakup: {
    gstRate: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    taxAmount: number;
  }[];
  settingsSnapshot: {
    legalName: string;
    gstin: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    pricesIncludeTax: boolean;
    gstEnabled: boolean;
  };
  status: 'issued' | 'paid' | 'void';
  voidReason?: string;
  generatedAt: string;
  paidAt?: string;
}

export interface PosPayment {
  _id: string;
  id: string;
  billId: string;
  orderId: string;
  method: 'cash' | 'upi' | 'card' | 'other';
  amount: number;
  reference?: string;
  receivedAt: string;
  status: 'recorded' | 'reversed';
  reversalReason?: string;
  receivedBy: {
    name?: string;
    username?: string;
  };
}

export interface OrderDetailResponse {
  order: PosOrder;
  calculated: CalculationResult;
}

export interface MenuItemVariant {
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface MenuItem {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  category: string;
  foodType: 'veg' | 'non_veg' | 'egg';
  basePrice: number;
  variants: MenuItemVariant[];
  gstRate: 0 | 5 | 12 | 18;
  isAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
  tags?: string[];
  description?: string;
  isFeatured?: boolean;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
