import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  Printer,
  RotateCcw,
  X,
  FileText,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import { closingService, DailyClosingRecord } from '@/services/closingService';

export const ClosingHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Selected Detail Modal
  const [selectedClosing, setSelectedClosing] = useState<DailyClosingRecord | null>(null);
  const [printLayout, setPrintLayout] = useState<'a4' | 'thermal'>('a4');

  // Reopen Modal (Partner only)
  const [reopenTarget, setReopenTarget] = useState<DailyClosingRecord | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopening, setReopening] = useState<boolean>(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const isPartner = user?.role === 'partner';

  const fetchClosings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await closingService.listClosings({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setClosings(res.closings);

      // If dateParam was passed via URL, automatically open that closing
      if (dateParam && !selectedClosing) {
        const found = res.closings.find((c) => c.localDate === dateParam);
        if (found) {
          setSelectedClosing(found);
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to fetch daily closings history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const handlePrint = (layout: 'a4' | 'thermal') => {
    setPrintLayout(layout);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTarget || !reopenReason.trim()) return;

    setReopening(true);
    setReopenError(null);
    try {
      const updated = await closingService.reopenClosing(reopenTarget.localDate, reopenReason.trim());
      setReopenTarget(null);
      setReopenReason('');
      if (selectedClosing?._id === updated._id) {
        setSelectedClosing(updated);
      }
      await fetchClosings();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setReopenError(e?.message || 'Failed to reopen daily register');
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-150">
      {/* Screen Only Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-headline text-brand-ink-900">
              Daily Closing History
            </h1>
            <Badge variant="cream" size="sm">
              Archived Logs
            </Badge>
          </div>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            Browse past daily closings, print thermal closing slips, and view sales reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/app/closing">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Perform Closing
            </Button>
          </Link>
        </div>
      </div>

      {/* Screen Only Filters */}
      <div className="print:hidden p-4 bg-brand-surface rounded-2xl border border-brand-border shadow-soft flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-ink-400" />
          <span className="text-caption font-semibold text-brand-ink-700">From Date:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-ink-400" />
          <span className="text-caption font-semibold text-brand-ink-700">To Date:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>

        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {error && (
        <div className="print:hidden p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-body-sm">
          {error}
        </div>
      )}

      {/* Closings Table */}
      <div className="print:hidden bg-brand-surface rounded-3xl border border-brand-border shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2">
            <Spinner size="lg" variant="gold" />
            <span className="text-caption text-brand-ink-400">Loading closing records...</span>
          </div>
        ) : closings.length === 0 ? (
          <div className="p-12 text-center text-brand-ink-500">
            No daily closing records found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border text-caption font-semibold text-brand-ink-500 bg-brand-surface-card/60">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Closed By</th>
                  <th className="py-3 px-5 text-right">Counted Cash</th>
                  <th className="py-3 px-5 text-right">Expected</th>
                  <th className="py-3 px-5 text-right">Difference</th>
                  <th className="py-3 px-5 text-right">Handed Over</th>
                  <th className="py-3 px-5 text-right">Total Bills</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-body-sm">
                {closings.map((c) => {
                  const isReopened = c.status === 'reopened';
                  const hasVariance = c.difference !== 0;

                  return (
                    <tr
                      key={c._id}
                      className="hover:bg-brand-surface-card/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedClosing(c)}
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-brand-ink-900">
                        {c.localDate}
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant={isReopened ? 'warning' : 'success'} size="sm">
                          {isReopened ? 'Reopened' : 'Closed'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-brand-ink-700">
                        {c.closedBy?.name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-brand-ink-900">
                        {formatPaiseToRupees(c.countedCash)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-brand-ink-500">
                        {formatPaiseToRupees(c.expected.expectedCash)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold">
                        <span
                          className={
                            hasVariance
                              ? c.difference > 0
                                ? 'text-blue-600'
                                : 'text-red-600'
                              : 'text-emerald-700'
                          }
                        >
                          {c.difference > 0 ? '+' : ''}
                          {formatPaiseToRupees(c.difference)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-brand-ink-900">
                        {formatPaiseToRupees(c.cashHandedOver)}
                      </td>
                      <td className="py-3.5 px-5 text-right text-brand-ink-600">
                        {c.salesSummary?.billsCount ?? 0}
                      </td>
                      <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedClosing(c)}
                          title="View Details"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL (With Print Support) */}
      {selectedClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white print:static print:z-auto">
          <div className="bg-white rounded-3xl border border-brand-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Modal Controls (Hidden in print) */}
            <div className="print:hidden p-5 border-b border-brand-border flex items-center justify-between bg-brand-surface-card sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-primary" />
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Daily Closing Report: {selectedClosing.localDate}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handlePrint('thermal')}>
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print 80mm Slip
                </Button>
                <Button variant="primary" size="sm" onClick={() => handlePrint('a4')}>
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print A4
                </Button>
                {isPartner && selectedClosing.status === 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={() => {
                      setReopenTarget(selectedClosing);
                      setReopenReason('');
                      setReopenError(null);
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reopen Day
                  </Button>
                )}
                <button
                  onClick={() => setSelectedClosing(null)}
                  className="p-1 text-brand-ink-400 hover:text-brand-ink-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Area */}
            <div
              className={`p-6 sm:p-8 space-y-6 ${
                printLayout === 'thermal'
                  ? 'print:w-[80mm] print:p-2 print:text-[11px] print:leading-tight print:space-y-3 font-mono mx-auto'
                  : 'print:p-8 font-sans'
              }`}
            >
              {/* Slip Header */}
              <div className="text-center border-b pb-4 space-y-1">
                <h2 className="font-heading font-bold text-headline tracking-wider text-brand-ink-900">
                  GEN-Z CAFE
                </h2>
                <div className="text-caption text-brand-ink-500 uppercase tracking-widest font-mono">
                  Daily Cash Register Closing
                </div>
                <div className="text-body-sm font-bold text-brand-ink-800">
                  Date: {selectedClosing.localDate}
                </div>
                <div className="text-caption text-brand-ink-400">
                  Closed at: {new Date(selectedClosing.closedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
                <div className="text-caption text-brand-ink-500">
                  Closed by: {selectedClosing.closedBy?.name} (@{selectedClosing.closedBy?.username})
                </div>
                {selectedClosing.status === 'reopened' && (
                  <div className="mt-2 text-caption font-bold text-amber-700 uppercase">
                    [STATUS: REOPENED BY PARTNER]
                  </div>
                )}
              </div>

              {/* Cash Reconciliation Summary */}
              <div className="space-y-2 border-b pb-4">
                <h4 className="font-bold text-caption uppercase tracking-wider text-brand-ink-400">
                  Cash Reconciliation
                </h4>
                <div className="flex justify-between text-body-sm">
                  <span>Opening Cash Float:</span>
                  <span className="font-mono">{formatPaiseToRupees(selectedClosing.expected.openingCash)}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span>Cash Sales Received:</span>
                  <span className="font-mono">{formatPaiseToRupees(selectedClosing.expected.cashSales)}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span>Cash In (Float Additions):</span>
                  <span className="font-mono">+{formatPaiseToRupees(selectedClosing.expected.cashIn)}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span>Cash Out (Expenses/Withdrawals):</span>
                  <span className="font-mono">-{formatPaiseToRupees(selectedClosing.expected.cashOut)}</span>
                </div>
                <div className="flex justify-between text-body-sm font-semibold border-t pt-1">
                  <span>Expected Drawer Cash:</span>
                  <span className="font-mono">{formatPaiseToRupees(selectedClosing.expected.expectedCash)}</span>
                </div>
                <div className="flex justify-between text-body-sm font-bold text-brand-ink-900">
                  <span>Physical Counted Cash:</span>
                  <span className="font-mono">{formatPaiseToRupees(selectedClosing.countedCash)}</span>
                </div>
                <div className="flex justify-between text-body-sm font-bold border-t pt-1">
                  <span>Variance / Discrepancy:</span>
                  <span
                    className={`font-mono ${
                      selectedClosing.difference === 0
                        ? 'text-emerald-700'
                        : selectedClosing.difference > 0
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}
                  >
                    {selectedClosing.difference > 0 ? '+' : ''}
                    {formatPaiseToRupees(selectedClosing.difference)}
                  </span>
                </div>
              </div>

              {/* Cash Allocation */}
              <div className="space-y-2 border-b pb-4">
                <h4 className="font-bold text-caption uppercase tracking-wider text-brand-ink-400">
                  Cash Allocation
                </h4>
                <div className="flex justify-between text-body-sm">
                  <span>Float Retained for Tomorrow:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatPaiseToRupees(selectedClosing.cashRetained)}
                  </span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span>Cash Handed Over (Safe/Bank):</span>
                  <span className="font-mono font-semibold text-brand-ink-900">
                    {formatPaiseToRupees(selectedClosing.cashHandedOver)}
                  </span>
                </div>
                {selectedClosing.reportedUpi !== undefined && (
                  <div className="flex justify-between text-body-sm text-brand-ink-600">
                    <span>Reported UPI Machine:</span>
                    <span className="font-mono">{formatPaiseToRupees(selectedClosing.reportedUpi)}</span>
                  </div>
                )}
                {selectedClosing.reportedCard !== undefined && (
                  <div className="flex justify-between text-body-sm text-brand-ink-600">
                    <span>Reported Card EDC:</span>
                    <span className="font-mono">{formatPaiseToRupees(selectedClosing.reportedCard)}</span>
                  </div>
                )}
              </div>

              {/* Denominations (if recorded) */}
              {selectedClosing.denominations && (
                <div className="space-y-2 border-b pb-4">
                  <h4 className="font-bold text-caption uppercase tracking-wider text-brand-ink-400">
                    Denominations Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption font-mono">
                    {Object.entries(selectedClosing.denominations).map(([denom, count]) => {
                      if (count === 0) return null;
                      return (
                        <div key={denom} className="flex justify-between">
                          <span>{denom === 'coins' ? 'Coins' : `₹${denom}`} × {count}:</span>
                          <span>
                            {formatPaiseToRupees(
                              count * (denom === 'coins' ? 100 : parseInt(denom, 10) * 100)
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sales Performance Summary */}
              {selectedClosing.salesSummary && (
                <div className="space-y-2 border-b pb-4">
                  <h4 className="font-bold text-caption uppercase tracking-wider text-brand-ink-400">
                    Sales & Tax Summary
                  </h4>
                  <div className="flex justify-between text-body-sm">
                    <span>Total Invoices Generated:</span>
                    <span className="font-semibold">{selectedClosing.salesSummary.billsCount}</span>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span>Gross Sales:</span>
                    <span className="font-mono">{formatPaiseToRupees(selectedClosing.salesSummary.grossSales)}</span>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span>Discounts Awarded:</span>
                    <span className="font-mono text-red-600">
                      -{formatPaiseToRupees(selectedClosing.salesSummary.discounts)}
                    </span>
                  </div>
                  <div className="flex justify-between text-body-sm">
                    <span>GST Collected:</span>
                    <span className="font-mono">{formatPaiseToRupees(selectedClosing.salesSummary.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-body-sm font-bold border-t pt-1">
                    <span>Net Sales Revenue:</span>
                    <span className="font-mono">{formatPaiseToRupees(selectedClosing.salesSummary.netSales)}</span>
                  </div>
                  <div className="flex justify-between text-caption text-brand-ink-500 pt-1">
                    <span>Dine-In: {selectedClosing.salesSummary.dineInOrdersCount} orders</span>
                    <span>Takeaway: {selectedClosing.salesSummary.takeawayOrdersCount} orders</span>
                  </div>
                  {(selectedClosing.salesSummary.voidBillsCount > 0 ||
                    selectedClosing.salesSummary.cancelledItemsCount > 0) && (
                    <div className="flex justify-between text-caption text-red-600 pt-1">
                      <span>Void Invoices: {selectedClosing.salesSummary.voidBillsCount}</span>
                      <span>Cancelled Items: {selectedClosing.salesSummary.cancelledItemsCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              {selectedClosing.note && (
                <div className="space-y-1 border-b pb-4">
                  <h4 className="font-bold text-caption uppercase tracking-wider text-brand-ink-400">
                    Remarks / Discrepancy Note
                  </h4>
                  <p className="text-body-sm text-brand-ink-800 bg-brand-surface-card p-3 rounded-xl">
                    "{selectedClosing.note}"
                  </p>
                </div>
              )}

              {/* Reopen Audit Trail */}
              {selectedClosing.reopenHistory && selectedClosing.reopenHistory.length > 0 && (
                <div className="space-y-2 border-b pb-4">
                  <h4 className="font-bold text-caption uppercase tracking-wider text-amber-700">
                    Reopen Audit History
                  </h4>
                  {selectedClosing.reopenHistory.map((rh, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-caption space-y-1">
                      <div className="font-semibold text-amber-900">
                        Reopened by {rh.by?.name} on {new Date(rh.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                      <div className="text-amber-800">Reason: {rh.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Slip Footer */}
              <div className="text-center text-caption text-brand-ink-400 pt-2 font-mono">
                --- END OF CLOSING REPORT ---
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN CONFIRMATION MODAL */}
      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Reopen Daily Register
                </h3>
              </div>
              <button
                onClick={() => setReopenTarget(null)}
                className="text-brand-ink-400 hover:text-brand-ink-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="p-6 space-y-4">
              <p className="text-body-sm text-brand-ink-600">
                Are you sure you want to reopen the register for <strong>{reopenTarget.localDate}</strong>?
                This will unlock the register and allow bills/cash movements to be recorded or altered.
              </p>

              {reopenError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-caption">
                  {reopenError}
                </div>
              )}

              <div>
                <label className="block text-body-sm font-semibold text-brand-ink-800 mb-1.5">
                  Mandatory Reopen Reason:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Need to adjust missing bill payment from night shift"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReopenTarget(null)}
                  disabled={reopening}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={reopening}>
                  Confirm Reopen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
