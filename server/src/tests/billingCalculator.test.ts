import { describe, it, expect } from 'vitest';
import {
  calculateBill,
  distributeDiscountLargestRemainder,
  CalculatorLineInput,
} from '../modules/orders/billingCalculator';

describe('Billing Calculator Unit Tests', () => {
  describe('Discount Distribution (Largest-Remainder Method)', () => {
    it('distributes discount across 3 lines with zero paise drift', () => {
      // 3 items: ₹100, ₹200, ₹300 (total ₹600 = 60000 paise). Discount: ₹50 (5000 paise)
      const gross = [10000, 20000, 30000];
      const discount = 5000;
      const distributed = distributeDiscountLargestRemainder(gross, discount);

      expect(distributed).toHaveLength(3);
      expect(distributed.reduce((a, b) => a + b, 0)).toBe(discount);
    });

    it('distributes odd paise discount across 7 lines with zero paise drift', () => {
      const gross = [12500, 15000, 8900, 4500, 23000, 11000, 9900];
      const discount = 3333; // 33.33 INR
      const distributed = distributeDiscountLargestRemainder(gross, discount);

      expect(distributed).toHaveLength(7);
      expect(distributed.reduce((a, b) => a + b, 0)).toBe(discount);
    });

    it('distributes discount across 11 lines with zero paise drift', () => {
      const gross = [
        10000, 15500, 22000, 8500, 12000, 19900, 34500, 7500, 11500, 24000, 18000,
      ];
      const discount = 7777; // 77.77 INR
      const distributed = distributeDiscountLargestRemainder(gross, discount);

      expect(distributed).toHaveLength(11);
      expect(distributed.reduce((a, b) => a + b, 0)).toBe(discount);
    });

    it('handles zero discount or discount larger than subtotal', () => {
      const gross = [5000, 10000];
      expect(distributeDiscountLargestRemainder(gross, 0)).toEqual([0, 0]);

      // Discount exceeds subtotal: clamped to subtotal
      const capped = distributeDiscountLargestRemainder(gross, 20000);
      expect(capped.reduce((a, b) => a + b, 0)).toBe(15000);
    });
  });

  describe('Tax Calculations (Inclusive & Exclusive)', () => {
    it('calculates inclusive tax with odd paise deterministically (SGST gets remainder)', () => {
      // Gross: ₹155 (15500 paise), 5% GST inclusive
      // taxable = round(15500 * 100 / 105) = round(14761.904) = 14762 paise
      // tax = 15500 - 14762 = 738 paise
      // cgst = floor(738 / 2) = 369 paise
      // sgst = 738 - 369 = 369 paise
      const lines: CalculatorLineInput[] = [
        { qty: 1, unitPrice: 15500, gstRate: 5 },
      ];
      const result = calculateBill(lines, null, {
        gstEnabled: true,
        pricesIncludeTax: true,
        roundOffToRupee: false,
      });

      expect(result.subtotal).toBe(15500);
      expect(result.taxable).toBe(14762);
      expect(result.totalTax).toBe(738);
      expect(result.cgst).toBe(369);
      expect(result.sgst).toBe(369);
      expect(result.grandTotal).toBe(15500);
      expect(result.title).toBe('Tax Invoice');
    });

    it('calculates exclusive tax correctly', () => {
      // Gross: ₹200 (20000 paise), 5% GST exclusive
      // tax = round(20000 * 5 / 100) = 1000 paise (₹10)
      // total = 20000 + 1000 = 21000 paise (₹210)
      const lines: CalculatorLineInput[] = [
        { qty: 1, unitPrice: 20000, gstRate: 5 },
      ];
      const result = calculateBill(lines, null, {
        gstEnabled: true,
        pricesIncludeTax: false,
        roundOffToRupee: false,
      });

      expect(result.subtotal).toBe(20000);
      expect(result.taxable).toBe(20000);
      expect(result.totalTax).toBe(1000);
      expect(result.cgst).toBe(500);
      expect(result.sgst).toBe(500);
      expect(result.grandTotal).toBe(21000);
    });

    it('handles mixed tax rates (5%, 12%, 18%) and provides rate group breakdown', () => {
      const lines: CalculatorLineInput[] = [
        { qty: 2, unitPrice: 10000, gstRate: 5 }, // 20000 paise, 5%
        { qty: 1, unitPrice: 15000, gstRate: 12 }, // 15000 paise, 12%
        { qty: 1, unitPrice: 25000, gstRate: 18 }, // 25000 paise, 18%
      ];
      const result = calculateBill(lines, null, {
        gstEnabled: true,
        pricesIncludeTax: true,
      });

      expect(result.subtotal).toBe(60000);
      expect(result.taxBreakup).toHaveLength(3);
      expect(result.taxBreakup.map((tb) => tb.gstRate)).toEqual([5, 12, 18]);
      expect(
        result.taxBreakup.reduce((sum, tb) => sum + tb.taxAmount, 0)
      ).toBe(result.totalTax);
    });

    it('omits tax lines and changes title to "Bill" when gstEnabled is false', () => {
      const lines: CalculatorLineInput[] = [
        { qty: 2, unitPrice: 15000, gstRate: 5 },
      ];
      const result = calculateBill(lines, null, {
        gstEnabled: false,
      });

      expect(result.title).toBe('Bill');
      expect(result.totalTax).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.taxBreakup).toHaveLength(0);
      expect(result.grandTotal).toBe(30000);
    });
  });

  describe('Commercial Rupee Round-Off', () => {
    it('rounds up and down properly (+/- roundOff)', () => {
      // 100.40 INR = 10040 paise -> rounds down to 10000 paise (roundOff = -40)
      const resDown = calculateBill(
        [{ qty: 1, unitPrice: 10040, gstRate: 0 }],
        null,
        { roundOffToRupee: true }
      );
      expect(resDown.grandTotal).toBe(10000);
      expect(resDown.roundOff).toBe(-40);

      // 100.60 INR = 10060 paise -> rounds up to 10100 paise (roundOff = +40)
      const resUp = calculateBill(
        [{ qty: 1, unitPrice: 10060, gstRate: 0 }],
        null,
        { roundOffToRupee: true }
      );
      expect(resUp.grandTotal).toBe(10100);
      expect(resUp.roundOff).toBe(40);
    });

    it('handles zero and tiny totals', () => {
      const resZero = calculateBill([], null);
      expect(resZero.subtotal).toBe(0);
      expect(resZero.grandTotal).toBe(0);
      expect(resZero.roundOff).toBe(0);

      const resTiny = calculateBill(
        [{ qty: 1, unitPrice: 40, gstRate: 5 }],
        null,
        { roundOffToRupee: true }
      );
      expect(resTiny.grandTotal).toBe(0);
      expect(resTiny.roundOff).toBe(-40);
    });
  });

  describe('Property-Style Determinism Invariant Tests', () => {
    it('satisfies subtotal - discount + tax(exclusive) + roundOff == grandTotal for random carts', () => {
      // Run 50 pseudo-random carts
      for (let run = 0; run < 50; run++) {
        const lineCount = Math.floor(Math.random() * 8) + 1;
        const lines: CalculatorLineInput[] = [];

        for (let i = 0; i < lineCount; i++) {
          lines.push({
            qty: Math.floor(Math.random() * 5) + 1,
            unitPrice: Math.floor(Math.random() * 50000) + 100, // 1 to 500 INR
            gstRate: [0, 5, 12, 18][Math.floor(Math.random() * 4)]!,
          });
        }

        const isInclusive = Math.random() > 0.5;
        const isPercentDiscount = Math.random() > 0.5;
        const discountInput = {
          type: isPercentDiscount ? ('percent' as const) : ('flat' as const),
          value: isPercentDiscount
            ? Math.floor(Math.random() * 25)
            : Math.floor(Math.random() * 10000),
        };

        const result = calculateBill(lines, discountInput, {
          gstEnabled: true,
          pricesIncludeTax: isInclusive,
          roundOffToRupee: true,
        });

        // Invariant check:
        if (isInclusive) {
          expect(
            result.subtotal - result.discount + result.roundOff
          ).toBe(result.grandTotal);
        } else {
          expect(
            result.subtotal - result.discount + result.totalTax + result.roundOff
          ).toBe(result.grandTotal);
        }

        // All values are integers
        expect(Number.isInteger(result.subtotal)).toBe(true);
        expect(Number.isInteger(result.discount)).toBe(true);
        expect(Number.isInteger(result.taxable)).toBe(true);
        expect(Number.isInteger(result.cgst)).toBe(true);
        expect(Number.isInteger(result.sgst)).toBe(true);
        expect(Number.isInteger(result.totalTax)).toBe(true);
        expect(Number.isInteger(result.roundOff)).toBe(true);
        expect(Number.isInteger(result.grandTotal)).toBe(true);
      }
    });
  });
});
