import { describe, it, expect } from 'vitest';
import { computePnl, PnlBillInput, PnlExpenseInput } from '../modules/finance/pnlCalculator';
import { allocateProfit, PartnerShare } from '../modules/finance/allocationCalculator';

describe('Finance Calculators Unit Test Suite', () => {
  describe('P&L Calculator (computePnl)', () => {
    it('accurately computes revenue, margins, operating profit, and net profit with hand-calculated fixtures', () => {
      // 2 sample bills:
      // Bill 1: subtotal 50,000 paise (₹500), discount 5,000 paise (₹50), taxable 42,857 paise, totalTax 2,143 paise, roundOff 0, grandTotal 45,000 paise
      // Bill 2: subtotal 100,000 paise (₹1000), discount 0, taxable 95,238 paise, totalTax 4,762 paise, roundOff 0, grandTotal 100,000 paise
      const bills: PnlBillInput[] = [
        {
          subtotal: 50000,
          discount: 5000,
          taxable: 42857,
          cgst: 1071,
          sgst: 1072,
          totalTax: 2143,
          roundOff: 0,
          grandTotal: 45000,
        },
        {
          subtotal: 100000,
          discount: 0,
          taxable: 95238,
          cgst: 2381,
          sgst: 2381,
          totalTax: 4762,
          roundOff: 0,
          grandTotal: 100000,
        },
      ];

      const expenses: PnlExpenseInput[] = [
        // Direct cost (COGS Purchase)
        { amount: 35000, categoryType: 'cogs_purchase', categoryName: 'Raw Materials & Coffee Beans', isPaid: true },
        // Operating expenses
        { amount: 20000, categoryType: 'rent_utilities', categoryName: 'Cafe Rent', isPaid: true },
        { amount: 15000, categoryType: 'payroll', categoryName: 'Staff Wages', isPaid: true },
        { amount: 5000, categoryType: 'marketing', categoryName: 'Social Ads', isPaid: true },
        { amount: 3000, categoryType: 'maintenance', categoryName: 'Espresso Machine Tune-up', isPaid: true },
        // Non-operating expense
        { amount: 2000, categoryType: 'non_operating', categoryName: 'Bank Loan Interest', isPaid: true },
        // Unpaid supplier credit
        { amount: 8000, categoryType: 'cogs_purchase', categoryName: 'Dairy Supplier Credit', isPaid: false },
      ];

      const pnl = computePnl(bills, expenses);

      // Revenue:
      // grossSales = 150,000 (₹1,500)
      // discounts = 5,000 (₹50)
      // netRevenue = 42,857 + 95,238 = 138,095 paise
      // totalTax = 2,143 + 4,762 = 6,905 paise
      // totalBilled = 45,000 + 100,000 = 145,000 paise
      expect(pnl.revenue.grossSales).toBe(150000);
      expect(pnl.revenue.discounts).toBe(5000);
      expect(pnl.revenue.netRevenue).toBe(138095);
      expect(pnl.revenue.gstCollected).toBe(6905);
      expect(pnl.revenue.totalBilled).toBe(145000);

      // Reconciliation Invariant: Net Revenue + GST Collected + Round-Off === Total Billed
      expect(pnl.revenue.netRevenue + pnl.revenue.gstCollected + pnl.revenue.roundOff).toBe(pnl.revenue.totalBilled);

      // Direct costs (COGS purchases) = 35,000 + 8,000 = 43,000 paise
      expect(pnl.directCosts.total).toBe(43000);

      // Gross profit = 138,095 - 43,000 = 95,095 paise
      expect(pnl.grossProfit).toBe(95095);

      // Gross margin = floor((95,095 * 10,000) / 138,095) = floor(6886.2) = 6886 bps (68.86%)
      expect(pnl.grossMarginBasisPoints).toBe(6886);

      // Operating expenses = 20,000 + 15,000 + 5,000 + 3,000 = 43,000 paise
      expect(pnl.operatingExpenses.total).toBe(43000);

      // Operating profit = 95,095 - 43,000 = 52,095 paise
      expect(pnl.operatingProfit).toBe(52095);

      // Non-operating expenses = 2,000 paise
      expect(pnl.nonOperatingExpenses.total).toBe(2000);

      // Net profit = 52,095 - 2,000 = 50,095 paise
      expect(pnl.netProfit).toBe(50095);

      // Unpaid supplier credit = 8,000 paise
      expect(pnl.unpaidSupplierCredit).toBe(8000);
    });

    it('handles zero revenue safely without division by zero', () => {
      const pnl = computePnl([], [
        { amount: 10000, categoryType: 'rent_utilities', categoryName: 'Rent', isPaid: true }
      ]);

      expect(pnl.revenue.netRevenue).toBe(0);
      expect(pnl.grossProfit).toBe(0);
      expect(pnl.grossMarginBasisPoints).toBe(0);
      expect(pnl.operatingExpenses.total).toBe(10000);
      expect(pnl.operatingProfit).toBe(-10000);
      expect(pnl.netProfit).toBe(-10000);
    });
  });

  describe('Profit Allocation Calculator (allocateProfit)', () => {
    it('distributes positive profit across 5 partners with exact sum and zero paise drift', () => {
      // 5 partners with 30%, 25%, 20%, 15%, 10%
      const shares: PartnerShare[] = [
        { partnerId: 'p-1', partnerName: 'Partner A', basisPoints: 3000 },
        { partnerId: 'p-2', partnerName: 'Partner B', basisPoints: 2500 },
        { partnerId: 'p-3', partnerName: 'Partner C', basisPoints: 2000 },
        { partnerId: 'p-4', partnerName: 'Partner D', basisPoints: 1500 },
        { partnerId: 'p-5', partnerName: 'Partner E', basisPoints: 1000 },
      ];

      // Odd paise net profit: 123,457 paise (₹1,234.57)
      const res = allocateProfit(123457, shares, 0);

      expect(res.distributableProfit).toBe(123457);
      const allocatedSum = res.allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(allocatedSum).toBe(123457);

      // Hand calculation:
      // p1: 123457 * 3000 / 10000 = 37037.1 -> base 37037, rem 1000
      // p2: 123457 * 2500 / 10000 = 30864.25 -> base 30864, rem 2500
      // p3: 123457 * 2000 / 10000 = 24691.4 -> base 24691, rem 4000
      // p4: 123457 * 1500 / 10000 = 18518.55 -> base 18518, rem 5500
      // p5: 123457 * 1000 / 10000 = 12345.7 -> base 12345, rem 7000
      // sumBase = 37037 + 30864 + 24691 + 18518 + 12345 = 123455
      // diff = 123457 - 123455 = 2 paise
      // Top 2 remainders: p5 (7000) and p4 (5500)
      // Expect p5 gets +1 (12346), p4 gets +1 (18519)
      expect(res.allocations.find((a) => a.partnerId === 'p-5')?.amount).toBe(12346);
      expect(res.allocations.find((a) => a.partnerId === 'p-4')?.amount).toBe(18519);
      expect(res.allocations.find((a) => a.partnerId === 'p-3')?.amount).toBe(24691);
      expect(res.allocations.find((a) => a.partnerId === 'p-2')?.amount).toBe(30864);
      expect(res.allocations.find((a) => a.partnerId === 'p-1')?.amount).toBe(37037);
    });

    it('distributes negative profit (loss share) across 3 partners with exact sum', () => {
      const shares: PartnerShare[] = [
        { partnerId: 'p-1', partnerName: 'Partner 1', basisPoints: 3334 },
        { partnerId: 'p-2', partnerName: 'Partner 2', basisPoints: 3333 },
        { partnerId: 'p-3', partnerName: 'Partner 3', basisPoints: 3333 },
      ];

      // Net loss: -50,001 paise
      const res = allocateProfit(-50001, shares, 0);

      expect(res.distributableProfit).toBe(-50001);
      const allocatedSum = res.allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(allocatedSum).toBe(-50001);
      // All partner amounts must be negative or zero
      for (const a of res.allocations) {
        expect(a.amount).toBeLessThanOrEqual(0);
      }
    });

    it('distributes across 7 partners with retained earnings share', () => {
      const shares: PartnerShare[] = [
        { partnerId: 'p-1', partnerName: 'P1', basisPoints: 2000 },
        { partnerId: 'p-2', partnerName: 'P2', basisPoints: 2000 },
        { partnerId: 'p-3', partnerName: 'P3', basisPoints: 1500 },
        { partnerId: 'p-4', partnerName: 'P4', basisPoints: 1500 },
        { partnerId: 'p-5', partnerName: 'P5', basisPoints: 1000 },
        { partnerId: 'p-6', partnerName: 'P6', basisPoints: 1000 },
        { partnerId: 'p-7', partnerName: 'P7', basisPoints: 1000 },
      ];

      // 10% retained earnings (1000 basis points) on ₹2,500.00 (250,000 paise)
      const res = allocateProfit(250000, shares, 1000);

      // Retained = 25,000 paise
      expect(res.retainedProfit).toBe(25000);
      // Distributable = 225,000 paise
      expect(res.distributableProfit).toBe(225000);
      const sum = res.allocations.reduce((acc, a) => acc + a.amount, 0);
      expect(sum).toBe(225000);
    });

    it('rejects share schedules that do not sum to exactly 10,000 basis points', () => {
      const invalidShares: PartnerShare[] = [
        { partnerId: 'p-1', partnerName: 'P1', basisPoints: 5000 },
        { partnerId: 'p-2', partnerName: 'P2', basisPoints: 4000 },
      ];

      expect(() => allocateProfit(100000, invalidShares, 0)).toThrow(/must equal 10000/);
    });
  });
});
