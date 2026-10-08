import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, RotateCcw, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { cashService, CashMovement, CreateCashMovementInput } from '@/services/cashService';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export const CashMovementsPage: React.FC = () => {
  const { user } = useAuth();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [category, setCategory] = useState<CreateCashMovementInput['category']>('float_in');
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Approval Dialog State for Large Cash Out (> ₹2,000)
  const [isApprovalOpen, setIsApprovalOpen] = useState<boolean>(false);
  const [pendingMovement, setPendingMovement] = useState<CreateCashMovementInput | null>(null);

  // Reversal Modal State
  const [reversalTarget, setReversalTarget] = useState<CashMovement | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalLoading, setReversalLoading] = useState<boolean>(false);

  const isManagerOrPartner = user ? user.role === 'partner' || user.role === 'manager' : false;
  const canReverse = user ? hasPermission(user.permissions, 'closing:view') : false;

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const data = await cashService.getMovements();
      setMovements(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMessage(e?.message || 'Failed to load cash movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const totalInPaise = movements
    .filter((m) => m.status === 'recorded' && m.type === 'in')
    .reduce((acc, m) => acc + m.amount, 0);

  const totalOutPaise = movements
    .filter((m) => m.status === 'recorded' && m.type === 'out')
    .reduce((acc, m) => acc + m.amount, 0);

  const handleOpenCreateModal = (type: 'in' | 'out') => {
    setMovementType(type);
    setCategory(type === 'in' ? 'float_in' : 'purchase');
    setAmountRupees('');
    setReason('');
    setNote('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setErrorMessage('Please enter a valid positive amount in Rupees');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMessage('Reason is mandatory and must be at least 3 characters');
      return;
    }

    const amountPaise = Math.round(rupees * 100);
    const movementPayload: CreateCashMovementInput = {
      type: movementType,
      amount: amountPaise,
      category,
      reason: reason.trim(),
      note: note.trim() || undefined,
    };

    // If Cash Out > ₹2,000 and user is cashier -> require manager approval
    if (movementType === 'out' && amountPaise > 200000 && !isManagerOrPartner) {
      setPendingMovement(movementPayload);
      setIsApprovalOpen(true);
      return;
    }

    await executeSaveMovement(movementPayload);
  };

  const executeSaveMovement = async (payload: CreateCashMovementInput) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await cashService.createMovement(payload);
      setIsModalOpen(false);
      setPendingMovement(null);
      await fetchMovements();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMessage(e?.message || 'Failed to record cash movement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproved = async (approvalToken: string) => {
    if (!pendingMovement) return;
    await executeSaveMovement({
      ...pendingMovement,
      approvalToken,
    });
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    setReversalLoading(true);
    try {
      await cashService.reverseMovement(reversalTarget._id, reversalReason.trim());
      setReversalTarget(null);
      setReversalReason('');
      await fetchMovements();
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(e?.message || 'Failed to reverse cash movement');
    } finally {
      setReversalLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-headline text-brand-ink-900 tracking-tight">
            Drawer Cash Movements
          </h1>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            Record drawer cash deposits, float additions, and paid-out petty cash expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => handleOpenCreateModal('in')}>
            <ArrowDownLeft className="w-4 h-4 mr-1.5 text-emerald-600" />
            Cash In
          </Button>
          <Button variant="primary" onClick={() => handleOpenCreateModal('out')}>
            <ArrowUpRight className="w-4 h-4 mr-1.5 text-red-500" />
            Cash Out
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-caption text-brand-ink-500 font-medium">Today's Cash In</span>
            <h3 className="font-heading font-bold text-headline text-emerald-600 mt-1">
              ₹{(totalInPaise / 100).toFixed(2)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-caption text-brand-ink-500 font-medium">Today's Cash Out</span>
            <h3 className="font-heading font-bold text-headline text-red-600 mt-1">
              ₹{(totalOutPaise / 100).toFixed(2)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 bg-brand-surface rounded-3xl border border-brand-border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-caption text-brand-ink-500 font-medium">Net Movement</span>
            <h3 className="font-heading font-bold text-headline text-brand-ink-900 mt-1">
              ₹{((totalInPaise - totalOutPaise) / 100).toFixed(2)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
          <h3 className="font-heading font-semibold text-body text-brand-ink-900">
            Today's Movement Log
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchMovements} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Spinner size="lg" />
            <p className="text-body-sm text-brand-ink-500 mt-3">Loading drawer records...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center text-brand-ink-500">
            No cash movements recorded today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border text-caption font-semibold text-brand-ink-500 bg-brand-surface-card/50">
                  <th className="py-3 px-5">Time (IST)</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5">Reason</th>
                  <th className="py-3 px-5">Recorded By</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  {canReverse && <th className="py-3 px-5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-body-sm">
                {movements.map((m) => {
                  const isReversed = m.status === 'reversed';
                  return (
                    <tr
                      key={m._id}
                      className={`hover:bg-brand-surface-card/40 transition-colors ${
                        isReversed ? 'opacity-60 bg-brand-ink-50/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-5 font-mono text-caption text-brand-ink-500">
                        {new Date(m.recordedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant={m.type === 'in' ? 'success' : 'danger'} size="sm">
                          {m.type === 'in' ? 'Cash In' : 'Cash Out'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 capitalize font-medium text-brand-ink-700">
                        {m.category.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-brand-ink-900">
                        ₹{(m.amount / 100).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 text-brand-ink-700">
                        <div>{m.reason}</div>
                        {isReversed && m.reverseReason && (
                          <div className="text-caption text-red-600 mt-0.5">
                            Reversed: {m.reverseReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-brand-ink-600">
                        {m.recordedBy?.name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <Badge variant={isReversed ? 'danger' : 'success'} size="sm">
                          {m.status}
                        </Badge>
                      </td>
                      {canReverse && (
                        <td className="py-3.5 px-5 text-right">
                          {!isReversed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReversalTarget(m);
                                setReversalReason('');
                              }}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Reverse
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Movement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    movementType === 'in'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {movementType === 'in' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                    Record Cash {movementType === 'in' ? 'In (Deposit)' : 'Out (Withdrawal)'}
                  </h3>
                  <p className="text-caption text-brand-ink-500">
                    {movementType === 'in'
                      ? 'Add cash or opening float to drawer'
                      : 'Withdraw cash for petty expenses or owner payout'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-brand-ink-400 hover:text-brand-ink-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-caption">
                  {errorMessage}
                </div>
              )}

              {/* Amount Presets */}
              <div>
                <label className="block text-caption font-medium text-brand-ink-700 mb-2">
                  Quick Amount Presets:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountRupees(amt.toString())}
                      className="py-1.5 px-3 rounded-xl border border-brand-border bg-brand-surface-card hover:bg-brand-primary/10 hover:border-brand-primary text-body-sm font-semibold text-brand-ink-800 transition-colors"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Amount in Rupees (₹):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-title font-mono font-bold text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CreateCashMovementInput['category'])}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 capitalize"
                >
                  {movementType === 'in' ? (
                    <>
                      <option value="float_in">Float Addition</option>
                      <option value="other">Other Deposit</option>
                    </>
                  ) : (
                    <>
                      <option value="purchase">Supplies Purchase</option>
                      <option value="staff_advance">Staff Advance</option>
                      <option value="owner_withdrawal">Owner Withdrawal</option>
                      <option value="other">Other Expense</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Mandatory Reason:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bought emergency milk packets from dairy"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Optional Note:
                </label>
                <input
                  type="text"
                  placeholder="Vendor receipt number or extra note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </div>

              {movementType === 'out' && parseFloat(amountRupees || '0') > 2000 && !isManagerOrPartner && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-caption flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>Withdrawals above ₹2,000 will require a manager's 6-digit approval PIN.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Save Cash {movementType === 'in' ? 'In' : 'Out'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Dialog for Cash Out > ₹2,000 */}
      <ApprovalDialog
        isOpen={isApprovalOpen}
        onClose={() => {
          setIsApprovalOpen(false);
          setPendingMovement(null);
        }}
        title="Manager Approval: Large Cash Out"
        description={`Authorizing drawer withdrawal of ₹${((pendingMovement?.amount || 0) / 100).toFixed(2)}`}
        action="cash.out_large"
        entityId="cash_drawer"
        params={{
          amount: pendingMovement?.amount,
          reason: pendingMovement?.reason,
        }}
        onApproved={handleApproved}
      />

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
              <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                Reverse Cash Movement
              </h3>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-brand-ink-400 hover:text-brand-ink-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="p-6 space-y-4">
              <p className="text-body-sm text-brand-ink-600">
                Are you sure you want to reverse the{' '}
                <strong>₹{(reversalTarget.amount / 100).toFixed(2)}</strong> (
                {reversalTarget.type === 'in' ? 'Cash In' : 'Cash Out'}) movement recorded for "{reversalTarget.reason}"?
              </p>

              <div>
                <label className="block text-body-sm font-medium text-brand-ink-800 mb-1.5">
                  Mandatory Reversal Reason:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mistake in entering amount"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReversalTarget(null)}
                  disabled={reversalLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={reversalLoading}>
                  Confirm Reversal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
