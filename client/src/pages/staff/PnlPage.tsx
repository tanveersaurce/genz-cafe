import React, { useState, useEffect } from 'react';
import {
  Download,
  Calendar,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatPrice } from '@/lib/formatPrice';
import { financeService, PnlReport, MonthlyTrendItem } from '@/services/financeService';

export const PnlPage: React.FC = () => {
  const [report, setReport] = useState<PnlReport | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<'statement' | 'trend'>('statement');

  const loadData = async () => {
    try {
      setLoading(true);
      const [pnlData, trendData] = await Promise.all([
        financeService.getPnl({ month: selectedMonth }),
        financeService.getTrend(parseInt(selectedMonth.split('-')[0] || '2026', 10)),
      ]);
      setReport(pnlData);
      setTrend(trendData);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleExportCsv = () => {
    const url = financeService.getExportUrl({ month: selectedMonth });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-forest">Profit & Loss Statement</h1>
          <p className="text-sm text-cafe-text-muted mt-1">
            Real-time managerial P&L, gross margins, direct COGS, and operating expense breakdown.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-cafe-forest/15 rounded-lg px-3 py-1.5 shadow-2xs">
            <Calendar className="w-4 h-4 text-cafe-forest" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm font-semibold text-cafe-forest bg-transparent focus:outline-hidden"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="border-cafe-forest/20 text-cafe-forest"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-2 border-b border-cafe-forest/10 pb-3">
        <button
          onClick={() => setViewMode('statement')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'statement'
              ? 'bg-cafe-forest text-white'
              : 'text-cafe-text-muted hover:text-cafe-forest'
          }`}
        >
          Statement Breakdown
        </button>
        <button
          onClick={() => setViewMode('trend')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'trend'
              ? 'bg-cafe-forest text-white'
              : 'text-cafe-text-muted hover:text-cafe-forest'
          }`}
        >
          12-Month Performance Trend
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <Spinner className="mx-auto" />
          <p className="text-xs text-cafe-text-muted mt-2">Computing financial metrics...</p>
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-cafe-text-muted">No data available for this month.</div>
      ) : viewMode === 'statement' ? (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-cafe-text-muted">
                Net Revenue (Ex-GST)
              </span>
              <div className="mt-2 text-2xl font-serif font-bold text-cafe-forest">
                {formatPrice(report.revenue.netRevenue)}
              </div>
              <span className="text-xs text-cafe-text-muted mt-1 block">
                Gross: {formatPrice(report.revenue.grossSales)} (Discounts:{' '}
                {formatPrice(report.revenue.discounts)})
              </span>
            </div>

            <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-cafe-text-muted">
                Gross Profit & Margin
              </span>
              <div className="mt-2 text-2xl font-serif font-bold text-emerald-700">
                {formatPrice(report.grossProfit)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <Percent className="w-3.5 h-3.5" />
                <span>{(report.grossMarginBasisPoints / 100).toFixed(2)}% Gross Margin</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-cafe-text-muted">
                Operating Expenses
              </span>
              <div className="mt-2 text-2xl font-serif font-bold text-amber-700">
                {formatPrice(report.operatingExpenses.total)}
              </div>
              <span className="text-xs text-cafe-text-muted mt-1 block">
                {report.operatingExpenses.byCategory.length} active cost categories
              </span>
            </div>

            <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-cafe-text-muted">
                Net Profit / (Loss)
              </span>
              <div
                className={`mt-2 text-2xl font-serif font-bold ${
                  report.netProfit >= 0 ? 'text-cafe-forest' : 'text-red-600'
                }`}
              >
                {report.netProfit >= 0 ? '+' : '-'}
                {formatPrice(Math.abs(report.netProfit))}
              </div>
              <span className="text-xs text-cafe-text-muted mt-1 block">
                Distributable to partner capital
              </span>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-2xs overflow-hidden">
            <div className="bg-cafe-forest text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg">P&L Detailed Breakdown</h3>
                <p className="text-xs text-cafe-cream/80">
                  Month: {selectedMonth} (GST Compliant, Accrual & Cash hybrid view)
                </p>
              </div>
              <Badge variant="gold" className="text-xs">
                Reconciled
              </Badge>
            </div>

            <div className="divide-y divide-cafe-forest/10">
              {/* REVENUE */}
              <div className="p-4 bg-cafe-cream/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cafe-forest mb-2">
                  1. Revenue from Operations
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-cafe-text-dark">Gross Food & Beverage Sales</span>
                    <span className="font-medium">{formatPrice(report.revenue.grossSales)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-red-600">
                    <span>Less: Promotional Discounts Allowed</span>
                    <span className="font-medium">- {formatPrice(report.revenue.discounts)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-cafe-forest border-t border-cafe-forest/10">
                    <span>Net Revenue (Ex-GST Base)</span>
                    <span>{formatPrice(report.revenue.netRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs text-cafe-text-muted">
                    <span>GST Collected (CGST + SGST held in trust)</span>
                    <span>{formatPrice(report.revenue.gstCollected)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs text-cafe-text-muted">
                    <span>Rounding Off Adjustment</span>
                    <span>{formatPrice(report.revenue.roundOff)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs text-cafe-text-muted">
                    <span>Total Billed Receipts</span>
                    <span>{formatPrice(report.revenue.totalBilled)}</span>
                  </div>
                </div>
              </div>

              {/* DIRECT COSTS */}
              <div className="p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cafe-forest mb-2">
                  2. Direct Costs (COGS Purchases)
                </h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-cafe-text-dark">Raw Material & Ingredient Purchases</span>
                    <span className="font-medium">
                      {formatPrice(report.directCosts.cogsPurchases)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-cafe-forest border-t border-cafe-forest/10">
                    <span>Total Direct Costs</span>
                    <span>{formatPrice(report.directCosts.total)}</span>
                  </div>
                </div>
              </div>

              {/* GROSS PROFIT */}
              <div className="p-4 bg-emerald-50/50 flex items-center justify-between font-bold text-emerald-800 text-base">
                <span>GROSS PROFIT (Margin: {(report.grossMarginBasisPoints / 100).toFixed(2)}%)</span>
                <span>{formatPrice(report.grossProfit)}</span>
              </div>

              {/* OPERATING EXPENSES */}
              <div className="p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cafe-forest mb-2">
                  3. Operating Expenses
                </h4>
                <div className="space-y-1.5 text-sm">
                  {report.operatingExpenses.byCategory.map((cat, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span className="text-cafe-text-dark">
                        {cat.name}{' '}
                        <span className="text-xs text-cafe-text-muted">({cat.type})</span>
                      </span>
                      <span className="font-medium">{formatPrice(cat.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 font-bold text-cafe-forest border-t border-cafe-forest/10">
                    <span>Total Operating Expenses</span>
                    <span>{formatPrice(report.operatingExpenses.total)}</span>
                  </div>
                </div>
              </div>

              {/* OPERATING PROFIT */}
              <div className="p-4 bg-cafe-cream/30 flex items-center justify-between font-bold text-cafe-forest text-base">
                <span>OPERATING PROFIT</span>
                <span>{formatPrice(report.operatingProfit)}</span>
              </div>

              {/* NON-OPERATING */}
              {report.nonOperatingExpenses.total > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cafe-forest mb-2">
                    4. Non-Operating Expenses
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    {report.nonOperatingExpenses.byCategory.map((cat, idx) => (
                      <div key={idx} className="flex justify-between py-1">
                        <span className="text-cafe-text-dark">{cat.name}</span>
                        <span className="font-medium">{formatPrice(cat.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 font-bold text-cafe-forest border-t border-cafe-forest/10">
                      <span>Total Non-Operating Expenses</span>
                      <span>{formatPrice(report.nonOperatingExpenses.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* NET PROFIT */}
              <div
                className={`p-5 flex items-center justify-between font-serif font-bold text-lg ${
                  report.netProfit >= 0 ? 'bg-cafe-forest text-white' : 'bg-red-700 text-white'
                }`}
              >
                <span>NET PROFIT / (LOSS)</span>
                <span>
                  {report.netProfit >= 0 ? '+' : '-'}
                  {formatPrice(Math.abs(report.netProfit))}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 12-Month Performance Trend View */
        <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-2xs overflow-hidden p-5">
          <h3 className="font-serif font-bold text-lg text-cafe-forest mb-4">
            Year {selectedMonth.split('-')[0]} Monthly Performance Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cafe-cream/50 border-b border-cafe-forest/10 text-xs font-semibold text-cafe-forest uppercase">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Net Revenue</th>
                  <th className="py-3 px-4 text-right">Direct COGS</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-right">Gross Margin</th>
                  <th className="py-3 px-4 text-right">Operating Exp</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-forest/5">
                {trend.map((row) => (
                  <tr
                    key={row.month}
                    className={`hover:bg-cafe-cream/20 ${
                      row.month === selectedMonth ? 'bg-cafe-gold/10 font-bold' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-cafe-forest font-semibold">{row.month}</td>
                    <td className="py-3 px-4 text-right">{formatPrice(row.netRevenue)}</td>
                    <td className="py-3 px-4 text-right">{formatPrice(row.cogs)}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">
                      {formatPrice(row.grossProfit)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">
                      {(row.marginBps / 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-amber-700">
                      {formatPrice(row.operatingExpenses)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        row.netProfit >= 0 ? 'text-cafe-forest' : 'text-red-600'
                      }`}
                    >
                      {row.netProfit >= 0 ? '+' : '-'}
                      {formatPrice(Math.abs(row.netProfit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
