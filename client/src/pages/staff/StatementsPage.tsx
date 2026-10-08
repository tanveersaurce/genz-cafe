import React, { useState, useEffect } from 'react';
import {
  FileText,
  Lock,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { formatPrice, rupeesToPaise } from '@/lib/formatPrice';
import {
  statementService,
  MonthlyStatement,
  StatementPreCheckResponse,
  StatementPreview,
} from '@/services/statementService';

export const StatementsPage: React.FC = () => {
  const { user } = useAuth();
  const [statements, setStatements] = useState<MonthlyStatement[]>([]);
  const [loading, setLoading] = useState(true);

  // Finalize Modal State
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [finalizeMonth, setFinalizeMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [retainedRupees, setRetainedRupees] = useState('0');
  const [prechecks, setPrechecks] = useState<StatementPreCheckResponse | null>(null);
  const [previewData, setPreviewData] = useState<StatementPreview | null>(null);
  const [checkingPrechecks, setCheckingPrechecks] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reopen Modal State
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [selectedStatementForReopen, setSelectedStatementForReopen] = useState<MonthlyStatement | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const loadStatements = async () => {
    try {
      setLoading(true);
      const data = await statementService.listStatements();
      setStatements(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatements();
  }, []);

  const runPreChecksAndPreview = async (month: string, retained: string) => {
    try {
      setCheckingPrechecks(true);
      setActionError(null);
      const pre = await statementService.getPreChecks(month);
      setPrechecks(pre);

      const retainedPaise = rupeesToPaise(retained);
      const prev = await statementService.previewStatement(month, retainedPaise);
      setPreviewData(prev);
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to calculate pre-checks and statement preview');
    } finally {
      setCheckingPrechecks(false);
    }
  };

  const handleOpenFinalizeModal = () => {
    setActionError(null);
    setOverrideReason('');
    setIsFinalizeOpen(true);
    runPreChecksAndPreview(finalizeMonth, retainedRupees);
  };

  const handleConfirmFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const retainedPaise = rupeesToPaise(retainedRupees);
      const needsOverride = Boolean(prechecks && !prechecks.canFinalize);

      if (needsOverride && (!overrideReason || overrideReason.trim().length === 0)) {
        setActionError('An override reason is mandatory when pre-checks are not satisfied');
        return;
      }

      await statementService.finalizeStatement({
        month: finalizeMonth,
        retainedAmount: retainedPaise,
        overridePrechecks: needsOverride,
        overrideReason: needsOverride ? overrideReason : undefined,
      });

      setIsFinalizeOpen(false);
      loadStatements();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to finalize statement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatementForReopen) return;
    setActionError(null);
    try {
      setActionLoading(true);
      await statementService.reopenStatement(selectedStatementForReopen.month, reopenReason);
      setIsReopenOpen(false);
      setSelectedStatementForReopen(null);
      setReopenReason('');
      loadStatements();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to reopen statement');
    } finally {
      setActionLoading(false);
    }
  };

  const canManage = hasPermission(user?.permissions, 'partners:manage');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-forest">
            Partner Monthly Statements
          </h1>
          <p className="text-sm text-cafe-text-muted mt-1">
            Month-end audit freeze, largest-remainder profit allocation, cryptographic period locking, and PDF statements.
          </p>
        </div>
        <div>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenFinalizeModal}
              className="bg-cafe-gold hover:bg-cafe-gold/90 text-cafe-forest font-semibold"
            >
              <Lock className="w-4 h-4 mr-1.5" />
              Finalize Month
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <Spinner className="mx-auto" />
          <p className="text-xs text-cafe-text-muted mt-2">Loading monthly statements...</p>
        </div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-xl border border-cafe-forest/10 p-12 text-center text-cafe-text-muted">
          <FileText className="w-12 h-12 mx-auto text-cafe-forest/30 mb-2" />
          <p className="text-base font-serif font-bold text-cafe-forest">No finalized statements yet</p>
          <p className="text-xs mt-1">Click "Finalize Month" to close a monthly accounting period.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {statements.map((stmt) => (
            <div
              key={stmt._id}
              className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs hover:border-cafe-forest/20 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cafe-forest/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cafe-forest/5 border border-cafe-forest/10 flex items-center justify-center text-cafe-forest">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-lg text-cafe-forest">
                        {stmt.statementNo} ({stmt.month})
                      </h3>
                      <Badge
                        variant={stmt.status === 'finalized' ? 'success' : 'warning'}
                        className="text-[10px] uppercase font-bold"
                      >
                        {stmt.status} (v{stmt.version})
                      </Badge>
                    </div>
                    <div className="text-xs text-cafe-text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cafe-forest" />
                      <span>
                        Finalized on{' '}
                        {stmt.finalizedAt ? new Date(stmt.finalizedAt).toLocaleDateString('en-IN') : 'N/A'}
                        {stmt.finalizedBy ? ` by ${stmt.finalizedBy.name}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={statementService.getPdfUrl(stmt.month)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cafe-forest text-white hover:bg-cafe-forest/90 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </a>

                  {stmt.status === 'finalized' && canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setSelectedStatementForReopen(stmt);
                        setReopenReason('');
                        setIsReopenOpen(true);
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Financial Snapshot Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                <div>
                  <span className="text-cafe-text-muted block">Net Revenue</span>
                  <span className="font-bold text-sm text-cafe-forest">
                    {formatPrice(stmt.totals.netRevenue)}
                  </span>
                </div>
                <div>
                  <span className="text-cafe-text-muted block">Operating Expenses</span>
                  <span className="font-bold text-sm text-amber-700">
                    {formatPrice(stmt.totals.operatingExpenses)}
                  </span>
                </div>
                <div>
                  <span className="text-cafe-text-muted block">Net Profit</span>
                  <span
                    className={`font-bold text-sm ${
                      stmt.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatPrice(stmt.totals.netProfit)}
                  </span>
                </div>
                <div>
                  <span className="text-cafe-text-muted block">Distributable Profit</span>
                  <span className="font-bold text-sm text-cafe-forest">
                    {formatPrice(stmt.distributableAmount)}
                  </span>
                </div>
              </div>

              {/* Allocations summary */}
              <div className="mt-4 pt-3 border-t border-cafe-forest/5 flex flex-wrap gap-2 text-xs">
                {stmt.allocations.map((a, idx) => (
                  <Badge key={idx} variant="cream" className="text-xs py-1 px-2.5">
                    {a.partnerNameSnapshot} ({(a.basisPoints / 100).toFixed(1)}%):{' '}
                    <span className="font-bold ml-1">{formatPrice(a.amount)}</span>
                  </Badge>
                ))}
              </div>

              {/* Integrity checksum */}
              <div className="mt-3 text-[10px] text-cafe-text-muted/70 font-mono truncate">
                SHA-256 Checksum: {stmt.checksum}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Finalize Statement */}
      <Modal
        isOpen={isFinalizeOpen}
        onClose={() => setIsFinalizeOpen(false)}
        title="Finalize Accounting Month & Lock Period"
      >
        <form onSubmit={handleConfirmFinalize} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Target Month</label>
              <Input
                type="month"
                required
                value={finalizeMonth}
                onChange={(e) => {
                  setFinalizeMonth(e.target.value);
                  runPreChecksAndPreview(e.target.value, retainedRupees);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">
                Retained Reserves (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={retainedRupees}
                onChange={(e) => {
                  setRetainedRupees(e.target.value);
                  runPreChecksAndPreview(finalizeMonth, e.target.value);
                }}
              />
            </div>
          </div>

          {checkingPrechecks ? (
            <div className="p-4 text-center">
              <Spinner className="mx-auto" />
              <p className="text-xs text-cafe-text-muted mt-1">Verifying register closings & orders...</p>
            </div>
          ) : (
            <>
              {/* Pre-check Status Banner */}
              {prechecks && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    prechecks.canFinalize
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {prechecks.canFinalize ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {prechecks.canFinalize
                        ? 'All pre-flight checks passed'
                        : 'Pre-flight checks flagged pending items'}
                    </span>
                  </div>
                  {prechecks.issues.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 mt-1 text-[11px]">
                      {prechecks.issues.map((iss, idx) => (
                        <li key={idx}>{iss}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Partner Allocation Preview */}
              {previewData && (
                <div className="bg-cafe-cream/30 border border-cafe-forest/10 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-cafe-forest">
                    <span>Net Distributable: {formatPrice(previewData.distributableAmount)}</span>
                    <span>Retained: {formatPrice(previewData.retainedAmount)}</span>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-cafe-forest/10">
                    {previewData.allocations.map((a, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-cafe-text-dark">
                          {a.partnerNameSnapshot} ({(a.basisPoints / 100).toFixed(2)}%)
                        </span>
                        <span className="font-serif font-bold text-cafe-forest">
                          {formatPrice(a.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Override Input (if prechecks failed) */}
              {prechecks && !prechecks.canFinalize && (
                <div>
                  <label className="block text-xs font-bold text-red-600 mb-1">
                    Partner Override Reason (Mandatory to bypass flags)
                  </label>
                  <Input
                    required
                    placeholder="e.g. Month-end audited manually by managing partner"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsFinalizeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading || checkingPrechecks}>
              {actionLoading ? 'Finalizing...' : 'Finalize & Freeze Month'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reopen Statement */}
      <Modal
        isOpen={isReopenOpen}
        onClose={() => setIsReopenOpen(false)}
        title={`Reopen Statement: ${selectedStatementForReopen?.statementNo}`}
      >
        <form onSubmit={handleConfirmReopen} className="space-y-4">
          <p className="text-xs text-cafe-text-muted">
            Reopening will reverse partner ledger profit share allocations and allow modifications to the
            month. Subsequent finalized months will block reopening.
          </p>

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Reason for Reopening</label>
            <Input
              required
              placeholder="e.g. Omitted vendor supplier invoice needs inclusion"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsReopenOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={actionLoading}>
              {actionLoading ? 'Reopening...' : 'Confirm Reopen'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
