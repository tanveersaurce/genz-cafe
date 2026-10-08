import { DateTime } from 'luxon';
import { Bill } from '../orders/models/bill.model';
import { Expense } from '../expenses/models/expense.model';
import { computePnl, PnlBillInput, PnlExpenseInput, PnlResult } from './pnlCalculator';
import { sanitizeCsvCell } from '../audit/auditViewer.service';

export interface PnlQueryRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export const pnlService = {
  /**
   * Computes P&L report for a specified date range in IST.
   */
  async getPnlReport(range: PnlQueryRange): Promise<PnlResult & { range: PnlQueryRange }> {
    const startOfDay = DateTime.fromFormat(range.from, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' })
      .startOf('day')
      .toJSDate();
    const endOfDay = DateTime.fromFormat(range.to, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' })
      .endOf('day')
      .toJSDate();

    // 1. Fetch all paid bills in the date range
    const bills = await Bill.find({
      status: 'paid',
      $or: [
        { paidAt: { $gte: startOfDay, $lte: endOfDay } },
        { paidAt: { $exists: false }, generatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    }).lean();

    const billInputs: PnlBillInput[] = bills.map((b) => ({
      subtotal: b.totals.subtotal,
      discount: b.totals.discount,
      taxable: b.totals.taxable,
      cgst: b.totals.cgst,
      sgst: b.totals.sgst,
      totalTax: b.totals.totalTax,
      roundOff: b.totals.roundOff,
      grandTotal: b.totals.grandTotal,
    }));

    // 2. Fetch active expenses in range
    const expenses = await Expense.find({
      status: 'active',
      expenseDate: { $gte: range.from, $lte: range.to },
    })
      .populate('categoryId', 'name type')
      .lean();

    const expenseInputs: PnlExpenseInput[] = expenses.map((e) => {
      const cat = e.categoryId as unknown as { name?: string; type?: string };
      return {
        amount: e.amount,
        categoryName: cat?.name || 'Uncategorized',
        categoryType: (cat?.type as PnlExpenseInput['categoryType']) || 'operating',
        isPaid: e.paymentStatus === 'paid',
      };
    });

    // 3. Compute deterministic P&L
    const pnl = computePnl(billInputs, expenseInputs);

    return {
      ...pnl,
      range,
    };
  },

  /**
   * Generates a monthly trend of P&L metrics for up to 12 months.
   */
  async getMonthlyTrend(year: number) {
    const months: Array<{
      month: string;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
      operatingExpenses: number;
      netProfit: number;
      marginBps: number;
    }> = [];

    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;
      const dt = DateTime.fromFormat(`${monthStr}-01`, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' });
      const from = dt.startOf('month').toFormat('yyyy-MM-dd');
      const to = dt.endOf('month').toFormat('yyyy-MM-dd');

      const pnl = await this.getPnlReport({ from, to });
      months.push({
        month: monthStr,
        netRevenue: pnl.revenue.netRevenue,
        cogs: pnl.directCosts.total,
        grossProfit: pnl.grossProfit,
        operatingExpenses: pnl.operatingExpenses.total,
        netProfit: pnl.netProfit,
        marginBps: pnl.grossMarginBasisPoints,
      });
    }

    return months;
  },

  /**
   * Exports the P&L report as a CSV string with formula injection protection.
   */
  async exportPnlCsv(range: PnlQueryRange): Promise<string> {
    const report = await this.getPnlReport(range);

    const rows: string[][] = [
      ['Gen-Z Cafe - Profit & Loss Statement'],
      ['Period', `${range.from} to ${range.to}`],
      ['Generated At', DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss')],
      [],
      ['Metric', 'Amount (Paise)', 'Amount (INR)', 'Percentage / Notes'],
      ['REVENUE'],
      ['Gross Sales', String(report.revenue.grossSales), (report.revenue.grossSales / 100).toFixed(2), ''],
      ['Discounts Allowed', String(report.revenue.discounts), (report.revenue.discounts / 100).toFixed(2), ''],
      ['Net Revenue (Ex-GST)', String(report.revenue.netRevenue), (report.revenue.netRevenue / 100).toFixed(2), '100.00%'],
      ['GST Collected', String(report.revenue.gstCollected), (report.revenue.gstCollected / 100).toFixed(2), ''],
      ['Round Off', String(report.revenue.roundOff), (report.revenue.roundOff / 100).toFixed(2), ''],
      ['Total Billed', String(report.revenue.totalBilled), (report.revenue.totalBilled / 100).toFixed(2), ''],
      [],
      ['DIRECT COSTS / COGS'],
      ['Raw Material Purchases', String(report.directCosts.cogsPurchases), (report.directCosts.cogsPurchases / 100).toFixed(2), ''],
      ['Total Direct Costs', String(report.directCosts.total), (report.directCosts.total / 100).toFixed(2), ''],
      [],
      ['GROSS PROFIT', String(report.grossProfit), (report.grossProfit / 100).toFixed(2), `${(report.grossMarginBasisPoints / 100).toFixed(2)}% margin`],
      [],
      ['OPERATING EXPENSES'],
      ...report.operatingExpenses.byCategory.map((cat) => [
        `  ${cat.name} (${cat.type})`,
        String(cat.amount),
        (cat.amount / 100).toFixed(2),
        '',
      ]),
      ['Total Operating Expenses', String(report.operatingExpenses.total), (report.operatingExpenses.total / 100).toFixed(2), ''],
      [],
      ['OPERATING PROFIT', String(report.operatingProfit), (report.operatingProfit / 100).toFixed(2), ''],
      [],
      ['NON-OPERATING EXPENSES'],
      ...report.nonOperatingExpenses.byCategory.map((cat) => [
        `  ${cat.name}`,
        String(cat.amount),
        (cat.amount / 100).toFixed(2),
        '',
      ]),
      ['Total Non-Operating Expenses', String(report.nonOperatingExpenses.total), (report.nonOperatingExpenses.total / 100).toFixed(2), ''],
      [],
      ['NET PROFIT', String(report.netProfit), (report.netProfit / 100).toFixed(2), ''],
      ['Unpaid Supplier Credit (Accounts Payable)', String(report.unpaidSupplierCredit), (report.unpaidSupplierCredit / 100).toFixed(2), ''],
    ];

    return rows
      .map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','))
      .join('\r\n');
  },
};
