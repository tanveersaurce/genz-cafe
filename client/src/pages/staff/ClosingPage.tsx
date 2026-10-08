import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Coins,
  Receipt,
  FileText,
  History,
  ShieldCheck,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { formatPaiseToRupees, rupeesToPaise } from '@/lib/formatPrice';
import {
  closingService,
  ClosingPreviewData,
  SubmitClosingInput,
  DailyClosingRecord,
} from '@/services/closingService';

const DENOMINATIONS = [
  { key: '500', value: 50000, label: '₹500 Notes' },
  { key: '200', value: 20000, label: '₹200 Notes' },
  { key: '100', value: 10000, label: '₹100 Notes' },
  { key: '50', value: 5000, label: '₹50 Notes' },
  { key: '20', value: 2000, label: '₹20 Notes' },
  { key: '10', value: 1000, label: '₹10 Notes' },
  { key: 'coins', value: 100, label: 'Coins (₹1 & ₹2 & ₹5)' },
];

export const ClosingPage: React.FC = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClosingPreviewData | null>(null);

  // Form State
  const [counts, setCounts] = useState<Record<string, number>>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    coins: 0,
  });

  const [cashRetainedRupees, setCashRetainedRupees] = useState<string>('');
  const [cashHandedOverRupees, setCashHandedOverRupees] = useState<string>('');
  const [reportedUpiRupees, setReportedUpiRupees] = useState<string>('');
  const [reportedCardRupees, setReportedCardRupees] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [overrideOpenOrders, setOverrideOpenOrders] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completedClosing, setCompletedClosing] = useState<DailyClosingRecord | null>(null);

  const isPartnerOrManager = user?.role === 'partner' || user?.role === 'manager';

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await closingService.getPreview();
      setPreview(data);
      // Pre-fill retained cash with default opening cash if available
      if (data.openingCash) {
        setCashRetainedRupees((data.openingCash / 100).toString());
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load daily closing preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  // Calculated counted cash in paise from denominations
  const countedCashPaise = DENOMINATIONS.reduce((sum, d) => {
    const qty = counts[d.key] || 0;
    return sum + qty * d.value;
  }, 0);

  const retainedPaise = rupeesToPaise(cashRetainedRupees);
  const handedOverPaise = rupeesToPaise(cashHandedOverRupees);
  const splitTotalPaise = retainedPaise + handedOverPaise;
  const splitRemainingPaise = countedCashPaise - splitTotalPaise;

  // Expected and difference
  const expectedCashPaise = preview?.expected?.expectedCash ?? 0;
  const differencePaise = countedCashPaise - expectedCashPaise;
  const tolerance = preview?.differenceTolerancePaise ?? 5000;
  const hasDiscrepancy = !preview?.isBlindCount && Math.abs(differencePaise) > tolerance;

  const handleDenominationChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    setCounts((prev) => ({
      ...prev,
      [key]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const handleAutoHandover = () => {
    const retained = rupeesToPaise(cashRetainedRupees);
    if (countedCashPaise >= retained) {
      const handover = countedCashPaise - retained;
      setCashHandedOverRupees((handover / 100).toString());
    }
  };

  const handleNextFromStep1 = () => {
    if (!preview) return;
    const hasBlockers = preview.openOrders.length > 0 || preview.unpaidBills.length > 0;
    if (hasBlockers && !overrideOpenOrders) {
      setError('Please resolve all open orders and unpaid bills before proceeding.');
      return;
    }
    if (hasBlockers && overrideOpenOrders && !overrideReason.trim()) {
      setError('A manager override reason is required to close with open orders/bills.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (countedCashPaise <= 0) {
      if (!window.confirm('Counted cash is ₹0. Are you sure you want to proceed?')) {
        return;
      }
    }
    setError(null);
    setStep(3);
  };

  const handleNextFromStep3 = () => {
    if (splitTotalPaise !== countedCashPaise) {
      setError(
        `Total allocated cash (${formatPaiseToRupees(splitTotalPaise)}) must exactly equal counted cash (${formatPaiseToRupees(countedCashPaise)}). Difference: ${formatPaiseToRupees(splitRemainingPaise)}`
      );
      return;
    }
    setError(null);
    setStep(4);
  };

  const handleSubmitClosing = async () => {
    if (!preview) return;
    if (hasDiscrepancy && (!note.trim() || note.trim().length < 5)) {
      setError('A detailed note (min 5 chars) is mandatory explaining the cash difference.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: SubmitClosingInput = {
      localDate: preview.localDate,
      countedCash: countedCashPaise,
      denominations: counts,
      cashRetained: retainedPaise,
      cashHandedOver: handedOverPaise,
      reportedUpi: reportedUpiRupees ? rupeesToPaise(reportedUpiRupees) : undefined,
      reportedCard: reportedCardRupees ? rupeesToPaise(reportedCardRupees) : undefined,
      note: note.trim() || undefined,
      overrideOpenOrders: overrideOpenOrders || undefined,
      overrideReason: overrideReason.trim() || undefined,
    };

    try {
      const record = await closingService.submitClosing(payload);
      setCompletedClosing(record);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to submit daily closing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" variant="gold" />
        <span className="text-body-sm text-brand-ink-500">Preparing closing wizard...</span>
      </div>
    );
  }

  if (completedClosing) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-brand-surface rounded-3xl border border-brand-border shadow-soft text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div>
          <h2 className="font-heading font-bold text-headline text-brand-ink-900">
            Daily Register Closed Successfully!
          </h2>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            Closing recorded for <strong>{completedClosing.localDate}</strong> by {completedClosing.closedBy.name}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-left p-6 bg-brand-surface-card rounded-2xl border border-brand-border text-body-sm">
          <div>
            <span className="text-caption text-brand-ink-400">Total Counted Cash</span>
            <div className="font-mono font-bold text-title text-brand-ink-900 mt-0.5">
              {formatPaiseToRupees(completedClosing.countedCash)}
            </div>
          </div>
          <div>
            <span className="text-caption text-brand-ink-400">Float Retained for Tomorrow</span>
            <div className="font-mono font-semibold text-body text-emerald-700 mt-0.5">
              {formatPaiseToRupees(completedClosing.cashRetained)}
            </div>
          </div>
          <div>
            <span className="text-caption text-brand-ink-400">Cash Handed Over (Safe)</span>
            <div className="font-mono font-semibold text-body text-brand-ink-900 mt-0.5">
              {formatPaiseToRupees(completedClosing.cashHandedOver)}
            </div>
          </div>
          <div>
            <span className="text-caption text-brand-ink-400">Total Bills Settled</span>
            <div className="font-semibold text-body text-brand-ink-900 mt-0.5">
              {completedClosing.salesSummary?.billsCount ?? 0} bills
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link to="/app/closing/history">
            <Button variant="secondary">
              <History className="w-4 h-4 mr-2" />
              View Closing History
            </Button>
          </Link>
          <Link to={`/app/closing/history?date=${completedClosing.localDate}`}>
            <Button variant="primary">
              <Printer className="w-4 h-4 mr-2" />
              Print Closing Slip
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-headline text-brand-ink-900">
              Daily Cash Register Closing
            </h1>
            <Badge variant="warning" size="sm">
              Date: {preview?.localDate || 'Today'}
            </Badge>
          </div>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            End-of-day register reconciliation, denomination count, and float settlement.
          </p>
        </div>

        <Link to="/app/closing/history">
          <Button variant="ghost" size="sm">
            <History className="w-4 h-4 mr-1.5" />
            Closing History
          </Button>
        </Link>
      </div>

      {/* Already Closed Banner */}
      {preview?.isAlreadyClosed && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-body-sm text-amber-900">
              Day Already Closed for {preview.localDate}
            </h4>
            <p className="text-caption text-amber-800 mt-0.5">
              The register for today has already been closed. Submitting again will update the closing snapshot and record the change in audit history.
            </p>
          </div>
        </div>
      )}

      {/* Wizard Steps Navigation */}
      <div className="grid grid-cols-4 gap-2 border-b border-brand-border pb-4">
        {[
          { num: 1, title: 'Pre-Checks' },
          { num: 2, title: 'Cash Count' },
          { num: 3, title: 'Settlement' },
          { num: 4, title: 'Review & Note' },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 pb-1 border-b-2 transition-colors ${
              step === s.num
                ? 'border-brand-primary text-brand-primary font-bold'
                : step > s.num
                ? 'border-emerald-600 text-emerald-700 font-medium'
                : 'border-transparent text-brand-ink-400 font-normal'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-caption ${
                step === s.num
                  ? 'bg-brand-primary text-brand-ink-950 font-bold'
                  : step > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-surface-card text-brand-ink-400'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </span>
            <span className="text-caption hidden sm:inline">{s.title}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-body-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: PRE-CHECKS */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-soft space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Step 1: Check Open Floor Orders & Unpaid Bills
                </h3>
                <p className="text-caption text-brand-ink-500">
                  Ensure all customer tables have billed and settled before closing the register.
                </p>
              </div>
            </div>

            {/* Open Orders */}
            <div className="p-4 rounded-2xl bg-brand-surface-card border border-brand-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body-sm text-brand-ink-900">
                  Open Orders ({preview?.openOrders.length || 0})
                </span>
                {preview?.openOrders.length === 0 ? (
                  <Badge variant="success" size="sm">
                    All Cleared
                  </Badge>
                ) : (
                  <Badge variant="danger" size="sm">
                    Action Required
                  </Badge>
                )}
              </div>

              {preview?.openOrders.length === 0 ? (
                <p className="text-caption text-emerald-700">✓ No open active orders found on the floor.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-caption text-red-600 font-medium">
                    The following orders must be completed, billed, or cancelled:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {preview?.openOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-2.5 rounded-xl bg-white border border-red-200 text-caption flex justify-between items-center"
                      >
                        <span className="font-medium text-brand-ink-800">
                          Order #{ord.orderNo} ({ord.type === 'dine_in' ? `Table ${ord.tableNumber}` : 'Takeaway'})
                        </span>
                        <Link
                          to="/app/pos"
                          className="text-brand-primary hover:underline font-semibold"
                        >
                          View in POS →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Unpaid Bills */}
            <div className="p-4 rounded-2xl bg-brand-surface-card border border-brand-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body-sm text-brand-ink-900">
                  Unpaid Invoices ({preview?.unpaidBills.length || 0})
                </span>
                {preview?.unpaidBills.length === 0 ? (
                  <Badge variant="success" size="sm">
                    All Settled
                  </Badge>
                ) : (
                  <Badge variant="danger" size="sm">
                    Unpaid Invoices
                  </Badge>
                )}
              </div>

              {preview?.unpaidBills.length === 0 ? (
                <p className="text-caption text-emerald-700">✓ All generated invoices have been paid or voided.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-caption text-red-600 font-medium">
                    The following invoices are awaiting payment:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {preview?.unpaidBills.map((b) => (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-xl bg-white border border-red-200 text-caption flex justify-between items-center"
                      >
                        <span className="font-medium text-brand-ink-800">
                          Invoice #{b.invoiceNo} ({formatPaiseToRupees(b.grandTotal)})
                        </span>
                        <Link
                          to="/app/pos"
                          className="text-brand-primary hover:underline font-semibold"
                        >
                          Collect in POS →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manager Override Checkbox if blockers exist */}
            {((preview?.openOrders.length || 0) > 0 || (preview?.unpaidBills.length || 0) > 0) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-body-sm text-amber-900">
                      Manager Override
                    </h4>
                    <p className="text-caption text-amber-800 mt-0.5">
                      If an order cannot be settled tonight due to an exceptional circumstance, a manager/partner can force closing with an audit rationale.
                    </p>
                  </div>
                </div>

                {isPartnerOrManager ? (
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-body-sm font-medium text-brand-ink-900">
                      <input
                        type="checkbox"
                        checked={overrideOpenOrders}
                        onChange={(e) => setOverrideOpenOrders(e.target.checked)}
                        className="rounded border-brand-border text-brand-primary focus:ring-brand-primary/30 w-4 h-4"
                      />
                      Override open orders/unpaid bills
                    </label>

                    {overrideOpenOrders && (
                      <input
                        type="text"
                        placeholder="Mandatory override reason (e.g. customer walked out, will file police report)"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-caption text-amber-700 italic">
                    Cashiers cannot override open orders. Please ask a Manager or Partner.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleNextFromStep1}
              disabled={
                ((preview?.openOrders.length || 0) > 0 || (preview?.unpaidBills.length || 0) > 0) &&
                (!overrideOpenOrders || !overrideReason.trim())
              }
            >
              Continue to Cash Count
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: CASH COUNT & DENOMINATIONS */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-soft space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                    Step 2: Physical Denomination Count
                  </h3>
                  <p className="text-caption text-brand-ink-500">
                    Count notes and coins inside the cash drawer.
                  </p>
                </div>
              </div>

              {preview?.isBlindCount ? (
                <Badge variant="info" size="sm">
                  Blind Count Mode (Cashier)
                </Badge>
              ) : (
                <div className="text-right">
                  <span className="text-caption text-brand-ink-400">Target Expected Cash</span>
                  <div className="font-mono font-bold text-headline text-brand-ink-900">
                    {formatPaiseToRupees(preview?.expected?.expectedCash ?? 0)}
                  </div>
                </div>
              )}
            </div>

            {/* Denomination Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DENOMINATIONS.map((d) => {
                const qty = counts[d.key] || 0;
                const subtotal = qty * d.value;
                return (
                  <div
                    key={d.key}
                    className="p-3.5 bg-brand-surface-card rounded-2xl border border-brand-border flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-body-sm text-brand-ink-900">{d.label}</span>
                      <div className="text-caption text-brand-ink-400 font-mono">
                        Subtotal: {formatPaiseToRupees(subtotal)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-brand-ink-400">×</span>
                      <input
                        type="number"
                        min="0"
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={(e) => handleDenominationChange(d.key, e.target.value)}
                        className="w-20 px-3 py-1.5 rounded-xl border border-brand-border bg-white text-right font-mono font-bold text-body text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Count Display */}
            <div className="p-4 rounded-2xl bg-brand-surface-card border border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-caption text-brand-ink-500 font-medium">Total Physical Count</span>
                <div className="font-mono font-bold text-title text-brand-ink-900">
                  {formatPaiseToRupees(countedCashPaise)}
                </div>
              </div>

              {!preview?.isBlindCount && (
                <div className="text-right">
                  <span className="text-caption text-brand-ink-500 font-medium">Discrepancy Variance</span>
                  <div
                    className={`font-mono font-bold text-title ${
                      Math.abs(differencePaise) <= tolerance
                        ? 'text-emerald-700'
                        : differencePaise > 0
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}
                  >
                    {differencePaise > 0 ? '+' : ''}
                    {formatPaiseToRupees(differencePaise)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button variant="primary" onClick={handleNextFromStep2}>
              Continue to Settlement
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: SETTLEMENT & HANDOVER */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-soft space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Step 3: Drawer Allocation & Float Retained
                </h3>
                <p className="text-caption text-brand-ink-500">
                  Allocate the counted cash between tomorrow's float and tonight's safe handover.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cash Retained */}
              <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border space-y-2">
                <label className="block text-body-sm font-semibold text-brand-ink-900">
                  Cash Retained in Drawer (₹):
                </label>
                <p className="text-caption text-brand-ink-500">
                  Float money kept in the cash drawer for tomorrow's shift opening.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-body text-brand-ink-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cashRetainedRupees}
                    onChange={(e) => setCashRetainedRupees(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-brand-border bg-white text-body font-mono font-bold text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>

              {/* Cash Handed Over */}
              <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-body-sm font-semibold text-brand-ink-900">
                    Cash Handed Over (₹):
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoHandover}
                    className="text-[11px] text-brand-primary hover:underline font-semibold"
                  >
                    Auto-Fill Remainder
                  </button>
                </div>
                <p className="text-caption text-brand-ink-500">
                  Amount deposited into locker/safe or handed to store manager.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-body text-brand-ink-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cashHandedOverRupees}
                    onChange={(e) => setCashHandedOverRupees(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-brand-border bg-white text-body font-mono font-bold text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Split Balance Verification */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                splitRemainingPaise === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {splitRemainingPaise === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div>
                  <span className="font-semibold text-body-sm">
                    {splitRemainingPaise === 0
                      ? 'Allocation Exactly Matches Counted Cash'
                      : 'Allocation Mismatch'}
                  </span>
                  <p className="text-caption">
                    Retained ({formatPaiseToRupees(retainedPaise)}) + Handed Over (
                    {formatPaiseToRupees(handedOverPaise)}) = {formatPaiseToRupees(splitTotalPaise)} (Target: {formatPaiseToRupees(countedCashPaise)})
                  </p>
                </div>
              </div>

              {splitRemainingPaise !== 0 && (
                <div className="text-right font-mono font-bold text-body">
                  Difference: {formatPaiseToRupees(splitRemainingPaise)}
                </div>
              )}
            </div>

            {/* Non-Cash Verification (UPI & Card) */}
            <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border space-y-3">
              <h4 className="font-semibold text-body-sm text-brand-ink-900">
                Digital Payment Terminal Totals (Optional Verification)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                    UPI Machine / QR Total (₹):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15420.00"
                    value={reportedUpiRupees}
                    onChange={(e) => setReportedUpiRupees(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-white text-body-sm font-mono text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-caption font-medium text-brand-ink-700 mb-1">
                    Card EDC Machine Batch Total (₹):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 8250.00"
                    value={reportedCardRupees}
                    onChange={(e) => setReportedCardRupees(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-border bg-white text-body-sm font-mono text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleNextFromStep3}
              disabled={splitRemainingPaise !== 0}
            >
              Review & Submit
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & DISCREPANCY NOTE */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-soft space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Step 4: Final Summary & Discrepancy Note
                </h3>
                <p className="text-caption text-brand-ink-500">
                  Review register totals before closing today's session.
                </p>
              </div>
            </div>

            {/* Reconciliation Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border">
                <span className="text-caption text-brand-ink-400">Counted Drawer Cash</span>
                <div className="font-mono font-bold text-headline text-brand-ink-900 mt-1">
                  {formatPaiseToRupees(countedCashPaise)}
                </div>
              </div>
              <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border">
                <span className="text-caption text-brand-ink-400">Float Retained for Tomorrow</span>
                <div className="font-mono font-bold text-headline text-emerald-700 mt-1">
                  {formatPaiseToRupees(retainedPaise)}
                </div>
              </div>
              <div className="p-4 bg-brand-surface-card rounded-2xl border border-brand-border">
                <span className="text-caption text-brand-ink-400">Cash Handed Over (Safe)</span>
                <div className="font-mono font-bold text-headline text-brand-ink-900 mt-1">
                  {formatPaiseToRupees(handedOverPaise)}
                </div>
              </div>
            </div>

            {/* Discrepancy Alert */}
            {hasDiscrepancy && (
              <div className="p-4 bg-red-50 border border-red-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-red-800 font-semibold text-body-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>
                    Cash Variance of {formatPaiseToRupees(Math.abs(differencePaise))} detected (
                    {differencePaise < 0 ? 'Shortage' : 'Surplus'})
                  </span>
                </div>
                <p className="text-caption text-red-700">
                  Tolerance is {formatPaiseToRupees(tolerance)}. A mandatory explanation note is required before this closing can be finalized.
                </p>
              </div>
            )}

            {/* Note Area */}
            <div>
              <label className="block text-body-sm font-semibold text-brand-ink-900 mb-1.5">
                Closing Note {hasDiscrepancy ? '(Mandatory Explanation)' : '(Optional)'}:
              </label>
              <textarea
                rows={3}
                placeholder={
                  hasDiscrepancy
                    ? 'Explain the root cause of the cash discrepancy in detail...'
                    : 'Any general remarks or comments for the morning shift...'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={hasDiscrepancy}
                className={`w-full p-3.5 rounded-2xl border bg-white text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 ${
                  hasDiscrepancy && (!note.trim() || note.trim().length < 5)
                    ? 'border-red-400 focus:ring-red-400/30'
                    : 'border-brand-border focus:ring-brand-primary/30'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitClosing}
              isLoading={submitting}
              disabled={hasDiscrepancy && (!note.trim() || note.trim().length < 5)}
            >
              <Lock className="w-4 h-4 mr-2" />
              Confirm & Lock Daily Closing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
