import { describe, it, expect } from 'vitest';
import {
  calculateDailyClosing,
  validateDenominations,
  CalculatorClosingInput,
} from '../modules/closing/closing.calculator';
import { AppError } from '../utils/AppError';

describe('Daily Closing Calculator Unit Tests', () => {
  it('correctly calculates expected cash, difference, and sales summary for a balanced day', () => {
    const input: CalculatorClosingInput = {
      openingCash: 200000, // ₹2,000
      countedCash: 750000, // ₹7,500
      cashRetained: 200000, // ₹2,000
      cashHandedOver: 550000, // ₹5,500
      cashIn: 50000, // ₹500 float added
      cashOut: 100000, // ₹1,000 for groceries
      payments: [
        { method: 'cash', amount: 600000, status: 'recorded' },
        { method: 'upi', amount: 400000, status: 'recorded' },
        { method: 'card', amount: 200000, status: 'recorded' },
      ],
      bills: [
        {
          status: 'paid',
          totals: {
            subtotal: 1000000,
            discountAmount: 100000,
            taxableAmount: 857143,
            cgst: 21428,
            sgst: 21429,
            roundOff: 0,
            grandTotal: 1200000,
          },
        },
      ],
      cancelledItems: [{ amount: 15000 }],
      orders: [{ type: 'dine_in' }, { type: 'takeaway' }],
    };

    // Expected = 200000 + 600000 - 0 + 50000 - 100000 = 750000
    // Difference = 750000 - 750000 = 0 (exact)
    const result = calculateDailyClosing(input);

    expect(result.expected.expectedCash).toBe(750000);
    expect(result.difference).toBe(0);
    expect(result.differenceType).toBe('exact');
    expect(result.expected.cashSales).toBe(600000);
    expect(result.expected.upiSales).toBe(400000);
    expect(result.salesSummary.billsIssuedCount).toBe(1);
    expect(result.salesSummary.ordersCountByType.dine_in).toBe(1);
    expect(result.salesSummary.ordersCountByType.takeaway).toBe(1);
  });

  it('detects short cash and enforces explanatory note when exceeding ₹50 tolerance', () => {
    const input: CalculatorClosingInput = {
      openingCash: 100000, // ₹1,000
      countedCash: 180000, // ₹1,800
      cashRetained: 100000,
      cashHandedOver: 80000,
      cashIn: 0,
      cashOut: 0,
      payments: [{ method: 'cash', amount: 100000, status: 'recorded' }], // ₹1,000
      bills: [],
      cancelledItems: [],
      orders: [],
      // Expected = 100000 + 100000 = 200000 (₹2,000)
      // Difference = 180000 - 200000 = -20000 (-₹200 -> short)
    };

    expect(() => calculateDailyClosing(input)).toThrow(AppError);
    expect(() => calculateDailyClosing(input)).toThrow(/An explanatory note is mandatory/i);

    // With note supplied: passes
    const resultWithNote = calculateDailyClosing({
      ...input,
      note: '₹200 missing from register cash drawer',
    });

    expect(resultWithNote.difference).toBe(-20000);
    expect(resultWithNote.differenceType).toBe('short');
  });

  it('detects excess cash and calculates cash reversals correctly', () => {
    const input: CalculatorClosingInput = {
      openingCash: 100000,
      countedCash: 210000, // ₹2,100
      cashRetained: 100000,
      cashHandedOver: 110000,
      cashIn: 0,
      cashOut: 0,
      payments: [
        { method: 'cash', amount: 150000, status: 'recorded' },
        { method: 'cash', amount: 50000, status: 'reversed' },
      ],
      bills: [],
      cancelledItems: [],
      orders: [],
      note: '₹100 tip left in drawer by customer',
      // Expected = 100000 + 150000 - 50000 = 200000
      // Difference = 210000 - 200000 = +10000 (+₹100 -> excess)
    };

    const result = calculateDailyClosing(input);
    expect(result.expected.expectedCash).toBe(200000);
    expect(result.expected.cashReversals).toBe(50000);
    expect(result.difference).toBe(10000);
    expect(result.differenceType).toBe('excess');
  });

  it('rejects when counted cash does not equal retained + handed over', () => {
    const input: CalculatorClosingInput = {
      openingCash: 100000,
      countedCash: 200000,
      cashRetained: 100000,
      cashHandedOver: 50000, // sum is 150000 != 200000
      cashIn: 0,
      cashOut: 0,
      payments: [],
      bills: [],
      cancelledItems: [],
      orders: [],
    };

    expect(() => calculateDailyClosing(input)).toThrow(/must equal retained/i);
  });

  it('validates denominations and detects sum mismatches', () => {
    // 500 x 3 = 1500, 200 x 2 = 400, 100 x 1 = 100 -> Total ₹2,000 = 200,000 paise
    const validDenoms = { '500': 3, '200': 2, '100': 1 };
    expect(() => validateDenominations(validDenoms, 200000)).not.toThrow();

    const invalidDenoms = { '500': 3, '200': 1 }; // ₹1,700 != ₹2,000
    expect(() => validateDenominations(invalidDenoms, 200000)).toThrow(/Denomination breakdown/i);
  });
});
