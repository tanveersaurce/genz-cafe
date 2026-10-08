import { describe, it, expect } from 'vitest';
import { formatPaiseToRupees, rupeesToPaise, formatGst } from '../lib/formatPrice';

describe('formatPrice utility functions', () => {
  describe('formatPaiseToRupees', () => {
    it('correctly converts whole rupee amounts in paise', () => {
      expect(formatPaiseToRupees(15000)).toBe('₹150');
      expect(formatPaiseToRupees(22000)).toBe('₹220');
      expect(formatPaiseToRupees(0)).toBe('₹0');
    });

    it('correctly formats paise fractions with two decimals', () => {
      expect(formatPaiseToRupees(15050)).toBe('₹150.50');
      expect(formatPaiseToRupees(999)).toBe('₹9.99');
    });

    it('handles thousands formatting correctly in Indian locale', () => {
      expect(formatPaiseToRupees(250000)).toBe('₹2,500');
      expect(formatPaiseToRupees(10000000)).toBe('₹1,00,000');
    });
  });

  describe('rupeesToPaise', () => {
    it('converts numerical rupees to paise integer', () => {
      expect(rupeesToPaise(150)).toBe(15000);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise(150.5)).toBe(15050);
    });

    it('handles string input and cleans non-digit characters', () => {
      expect(rupeesToPaise('150')).toBe(15000);
      expect(rupeesToPaise('₹150')).toBe(15000);
      expect(rupeesToPaise('150.50')).toBe(15050);
      expect(rupeesToPaise('invalid')).toBe(0);
    });
  });

  describe('formatGst', () => {
    it('formats rate into percent label', () => {
      expect(formatGst(5)).toBe('5% GST');
      expect(formatGst(18)).toBe('18% GST');
    });
  });
});
