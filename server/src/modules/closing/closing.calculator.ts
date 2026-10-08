import { IClosingExpected, IClosingSalesSummary } from './models/dailyClosing.model';
import { cashSettings } from '../../config/cashSettings';
import { AppError } from '../../utils/AppError';

export interface CalculatorPaymentInput {
  method: 'cash' | 'upi' | 'card' | 'other';
  amount: number; // in paise
  status: 'recorded' | 'reversed';
}

export interface CalculatorBillInput {
  status: 'issued' | 'paid' | 'void';
  totals: {
    subtotal: number;
    discount?: number;
    discountAmount?: number;
    taxable?: number;
    taxableAmount?: number;
    cgst: number;
    sgst: number;
    roundOff: number;
    grandTotal: number;
  };
}

export interface CalculatorOrderItemInput {
  status: 'active' | 'cancelled';
  priceSnapshot?: number;
  qty?: number;
}

export interface CalculatorClosingInput {
  openingCash: number;
  countedCash: number;
  cashRetained: number;
  cashHandedOver: number;
  cashIn: number;
  cashOut: number;
  payments: CalculatorPaymentInput[];
  bills: CalculatorBillInput[];
  cancelledItems: Array<{ amount: number }>;
  orders: Array<{ type: 'dine_in' | 'takeaway' }>;
  denominations?: Record<string, number>;
  note?: string;
}

export interface CalculatorClosingResult {
  expected: IClosingExpected;
  difference: number;
  differenceType: 'short' | 'excess' | 'exact';
  salesSummary: IClosingSalesSummary;
  isNoteRequired: boolean;
}

/**
 * Validates that counted cash equals the sum of denomination counts.
 */
export function validateDenominations(
  denominations: Record<string, number>,
  countedCashPaise: number
): void {
  let totalPaise = 0;
  for (const [denomStr, count] of Object.entries(denominations)) {
    const denomRupees = parseInt(denomStr, 10);
    if (isNaN(denomRupees) || count < 0) {
      throw new AppError(`Invalid denomination: ${denomStr}`, 400);
    }
    totalPaise += denomRupees * 100 * count;
  }

  if (totalPaise !== countedCashPaise) {
    throw new AppError(
      `Denomination breakdown (₹${(totalPaise / 100).toFixed(2)}) does not match counted cash (₹${(countedCashPaise / 100).toFixed(2)})`,
      400,
      'DENOMINATION_MISMATCH'
    );
  }
}

/**
 * Deterministic end-of-day register closing calculator.
 * All amounts are strictly integer paise.
 */
export function calculateDailyClosing(input: CalculatorClosingInput): CalculatorClosingResult {
  // 1. Verify cash split
  if (input.countedCash !== input.cashRetained + input.cashHandedOver) {
    throw new AppError(
      `Counted cash (₹${(input.countedCash / 100).toFixed(2)}) must equal retained (₹${(input.cashRetained / 100).toFixed(2)}) + handed over (₹${(input.cashHandedOver / 100).toFixed(2)})`,
      400,
      'CASH_SPLIT_MISMATCH'
    );
  }

  // 2. Validate denominations if supplied
  if (input.denominations && Object.keys(input.denominations).length > 0) {
    validateDenominations(input.denominations, input.countedCash);
  }

  // 3. Aggregate payments by method and status
  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let otherSales = 0;
  let cashReversals = 0;

  for (const p of input.payments) {
    if (p.status === 'recorded') {
      switch (p.method) {
        case 'cash':
          cashSales += p.amount;
          break;
        case 'upi':
          upiSales += p.amount;
          break;
        case 'card':
          cardSales += p.amount;
          break;
        case 'other':
          otherSales += p.amount;
          break;
      }
    } else if (p.status === 'reversed') {
      if (p.method === 'cash') {
        cashReversals += p.amount;
      }
    }
  }

  // 4. Expected cash formula
  const expectedCash =
    input.openingCash + cashSales - cashReversals + input.cashIn - input.cashOut;

  // 5. Difference: counted - expected
  const difference = input.countedCash - expectedCash;
  const differenceType = difference < 0 ? 'short' : difference > 0 ? 'excess' : 'exact';

  const isNoteRequired = Math.abs(difference) > cashSettings.differenceTolerancePaise;
  if (isNoteRequired && (!input.note || input.note.trim().length === 0)) {
    throw new AppError(
      `Cash discrepancy of ₹${(Math.abs(difference) / 100).toFixed(2)} exceeds tolerance of ₹${(cashSettings.differenceTolerancePaise / 100).toFixed(2)}. An explanatory note is mandatory.`,
      400,
      'CLOSING_NOTE_REQUIRED'
    );
  }

  // 6. Aggregate Sales Summary
  let billsIssuedCount = 0;
  let billsVoidCount = 0;
  let billsVoidAmount = 0;
  let grossSales = 0;
  let discountsTotal = 0;
  let taxableAmount = 0;
  let cgst = 0;
  let sgst = 0;
  let roundOff = 0;
  let netSales = 0;

  for (const bill of input.bills) {
    if (bill.status === 'void') {
      billsVoidCount += 1;
      billsVoidAmount += bill.totals.grandTotal;
    } else {
      billsIssuedCount += 1;
      grossSales += bill.totals.subtotal;
      discountsTotal += (bill.totals.discountAmount ?? bill.totals.discount ?? 0);
      taxableAmount += (bill.totals.taxableAmount ?? bill.totals.taxable ?? 0);
      cgst += bill.totals.cgst;
      sgst += bill.totals.sgst;
      roundOff += bill.totals.roundOff;
      netSales += bill.totals.grandTotal;
    }
  }

  // Orders count
  let dineInCount = 0;
  let takeawayCount = 0;
  for (const o of input.orders) {
    if (o.type === 'dine_in') dineInCount++;
    else if (o.type === 'takeaway') takeawayCount++;
  }

  const cancelledItemsCount = input.cancelledItems.length;
  const cancelledItemsValue = input.cancelledItems.reduce((acc, i) => acc + i.amount, 0);

  const expected: IClosingExpected = {
    cashSales,
    upiSales,
    cardSales,
    otherSales,
    cashReversals,
    cashIn: input.cashIn,
    cashOut: input.cashOut,
    expectedCash,
  };

  const salesSummary: IClosingSalesSummary = {
    billsIssuedCount,
    billsVoidCount,
    billsVoidAmount,
    grossSales,
    discountsTotal,
    taxableAmount,
    cgst,
    sgst,
    roundOff,
    netSales,
    cancelledItemsCount,
    cancelledItemsValue,
    ordersCountByType: {
      dine_in: dineInCount,
      takeaway: takeawayCount,
    },
  };

  return {
    expected,
    difference,
    differenceType,
    salesSummary,
    isNoteRequired,
  };
}
