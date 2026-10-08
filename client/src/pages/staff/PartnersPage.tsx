import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Users,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatPrice, rupeesToPaise } from '@/lib/formatPrice';
import {
  partnerService,
  PartnerSummaryItem,
  PartnerShareSchedule,
  CapitalEntry,
  PartnerWithdrawal,
} from '@/services/partnerService';

export const PartnersPage: React.FC = () => {
  const [summaries, setSummaries] = useState<PartnerSummaryItem[]>([]);
  const [shares, setShares] = useState<PartnerShareSchedule | null>(null);
  const [capitalEntries, setCapitalEntries] = useState<CapitalEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCapitalOpen, setIsCapitalOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [isSharesOpen, setIsSharesOpen] = useState(false);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);

  // Capital Form State
  const [capPartnerId, setCapPartnerId] = useState('');
  const [capType, setCapType] = useState<'contribution' | 'capital_return'>('contribution');
  const [capAmountRupees, setCapAmountRupees] = useState('');
  const [capDate, setCapDate] = useState(() => new Date().toISOString().split('T')[0] || '');
  const [capMethod, setCapMethod] = useState('bank_transfer');
  const [capRef, setCapRef] = useState('');
  const [capNotes, setCapNotes] = useState('');

  // Withdrawal Form State
  const [withPartnerId, setWithPartnerId] = useState('');
  const [withAmountRupees, setWithAmountRupees] = useState('');
  const [withDate, setWithDate] = useState(() => new Date().toISOString().split('T')[0] || '');
  const [withMethod, setWithMethod] = useState('bank_transfer');
  const [withRef, setWithRef] = useState('');
  const [withNotes, setWithNotes] = useState('');

  // Shares Form State
  const [newShareDate, setNewShareDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [partnerSharesInputs, setPartnerSharesInputs] = useState<Record<string, string>>({});

  // Add Partner Form State
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerPan, setNewPartnerPan] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, curShares, capData, withData] = await Promise.all([
        partnerService.getSummary(),
        partnerService.getCurrentShares(),
        partnerService.listCapitalEntries(),
        partnerService.listWithdrawals(),
      ]);
      setSummaries(sumData);
      setShares(curShares);
      setCapitalEntries(capData);
      setWithdrawals(withData);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const amountPaise = rupeesToPaise(capAmountRupees);
      await partnerService.createCapitalEntry({
        partnerId: capPartnerId,
        type: capType,
        amount: amountPaise,
        effectiveDate: capDate,
        paymentMethod: capMethod,
        reference: capRef || undefined,
        notes: capNotes || undefined,
      });
      setIsCapitalOpen(false);
      setCapAmountRupees('');
      setCapRef('');
      setCapNotes('');
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to record capital entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const amountPaise = rupeesToPaise(withAmountRupees);
      const res = await partnerService.createWithdrawal({
        partnerId: withPartnerId,
        amount: amountPaise,
        paymentMethod: withMethod,
        effectiveDate: withDate,
        reference: withRef || undefined,
        notes: withNotes || undefined,
      });

      if (res.warning) {
        alert(`Warning: ${res.warning}`);
      }

      setIsWithdrawalOpen(false);
      setWithAmountRupees('');
      setWithRef('');
      setWithNotes('');
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to record withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateShares = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const sharesArray = summaries.map((s) => {
        const pct = parseFloat(partnerSharesInputs[s.partner._id] || '0');
        return {
          partnerId: s.partner._id,
          basisPoints: Math.round(pct * 100),
        };
      });

      const totalBps = sharesArray.reduce((acc, s) => acc + s.basisPoints, 0);
      if (totalBps !== 10000) {
        setActionError(`Total shares must equal 100.00% (currently ${(totalBps / 100).toFixed(2)}%)`);
        return;
      }

      await partnerService.createShareSchedule({
        effectiveFrom: newShareDate,
        shares: sharesArray,
      });

      setIsSharesOpen(false);
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to update share schedule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      await partnerService.createPartner({
        name: newPartnerName,
        email: newPartnerEmail || undefined,
        phone: newPartnerPhone || undefined,
        pan: newPartnerPan || undefined,
      });
      setIsAddPartnerOpen(false);
      setNewPartnerName('');
      setNewPartnerEmail('');
      setNewPartnerPhone('');
      setNewPartnerPan('');
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to add partner');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-forest">Partners & Equity</h1>
          <p className="text-sm text-cafe-text-muted mt-1">
            Manage partner equity schedules, capital contributions, withdrawals, and individual accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActionError(null);
              setIsAddPartnerOpen(true);
            }}
          >
            <Users className="w-4 h-4 mr-1.5" />
            Add Partner
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActionError(null);
              // Pre-fill inputs with current shares
              const init: Record<string, string> = {};
              if (shares?.shares) {
                shares.shares.forEach((s) => {
                  const pid = typeof s.partnerId === 'string' ? s.partnerId : s.partnerId._id;
                  init[pid] = (s.basisPoints / 100).toFixed(2);
                });
              }
              setPartnerSharesInputs(init);
              setIsSharesOpen(true);
            }}
          >
            <Percent className="w-4 h-4 mr-1.5" />
            Edit Shares
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActionError(null);
              setIsCapitalOpen(true);
            }}
          >
            <ArrowDownLeft className="w-4 h-4 mr-1.5 text-emerald-600" />
            Capital Entry
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setActionError(null);
              setIsWithdrawalOpen(true);
            }}
            className="bg-cafe-gold hover:bg-cafe-gold/90 text-cafe-forest font-semibold"
          >
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            Record Withdrawal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <Spinner className="mx-auto" />
          <p className="text-xs text-cafe-text-muted mt-2">Loading partner details...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Partner Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaries.map((item) => {
              const partnerShare = shares?.shares.find((s) => {
                const pid = typeof s.partnerId === 'string' ? s.partnerId : s.partnerId._id;
                return pid === item.partner._id;
              });

              return (
                <div
                  key={item.partner._id}
                  className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-serif font-bold text-lg text-cafe-forest">
                          {item.partner.name}
                        </h3>
                        <p className="text-xs text-cafe-text-muted mt-0.5">
                          PAN: {item.partner.pan || 'N/A'} • {item.partner.phone || item.partner.email || ''}
                        </p>
                      </div>
                      <Badge variant="cream" className="text-xs font-bold text-cafe-forest">
                        {partnerShare ? `${(partnerShare.basisPoints / 100).toFixed(2)}%` : '0.00%'}
                      </Badge>
                    </div>

                    <div className="mt-4 pt-4 border-t border-cafe-forest/10 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-cafe-text-muted">Total Credits / Profits</span>
                        <span className="font-medium text-emerald-700">
                          {formatPrice(item.totalCredits)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cafe-text-muted">Total Debits / Withdrawals</span>
                        <span className="font-medium text-red-600">
                          {formatPrice(item.totalDebits)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-cafe-forest/10 font-bold text-sm">
                        <span className="text-cafe-forest">Current Ledger Balance</span>
                        <span className="text-cafe-forest">{formatPrice(item.netBalance)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-cafe-forest/10">
                    <Link
                      to={`/app/finance/ledger/${item.partner._id}`}
                      className="text-xs font-semibold text-cafe-forest hover:text-cafe-gold flex items-center justify-between"
                    >
                      <span>View Detailed Ledger</span>
                      <FileText className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Share Schedule Details */}
          <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-base text-cafe-forest">
                  Active Equity Ownership Schedule
                </h3>
                <p className="text-xs text-cafe-text-muted">
                  Effective From: {shares?.effectiveFrom || '2026-01-01'} (Total must equal 100.00%)
                </p>
              </div>
              <Badge variant="success" className="text-xs uppercase">
                Active 10,000 bps
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {shares?.shares.map((s, idx) => {
                const pName = typeof s.partnerId === 'object' ? s.partnerId.name : 'Partner';
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-cafe-cream/30 border border-cafe-forest/10 flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-cafe-forest">{pName}</span>
                    <span className="text-sm font-bold text-cafe-gold font-serif">
                      {(s.basisPoints / 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Capital & Withdrawals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Capital Entries */}
            <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-2xs overflow-hidden">
              <div className="p-4 bg-cafe-cream/30 border-b border-cafe-forest/10 flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm text-cafe-forest">
                  Capital Contributions & Returns
                </h3>
                <Badge variant="cream" className="text-xs">
                  {capitalEntries.length} entries
                </Badge>
              </div>
              <div className="divide-y divide-cafe-forest/5 max-h-72 overflow-y-auto">
                {capitalEntries.map((c) => (
                  <div
                    key={c._id}
                    className={`p-3.5 flex items-center justify-between text-xs ${
                      c.isReversed ? 'opacity-40 line-through' : ''
                    }`}
                  >
                    <div>
                       <div className="font-semibold text-cafe-forest">{c.partnerId?.name}</div>
                      <div className="text-cafe-text-muted">
                        {c.effectiveDate} • {c.paymentMethod} {c.reference ? `(${c.reference})` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif font-bold text-emerald-700">
                        {formatPrice(c.amount)}
                      </div>
                      <Badge variant="cream" className="text-[10px] uppercase">
                        {c.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Withdrawals */}
            <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-2xs overflow-hidden">
              <div className="p-4 bg-cafe-cream/30 border-b border-cafe-forest/10 flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm text-cafe-forest">
                  Partner Profit Withdrawals
                </h3>
                <Badge variant="cream" className="text-xs">
                  {withdrawals.length} entries
                </Badge>
              </div>
              <div className="divide-y divide-cafe-forest/5 max-h-72 overflow-y-auto">
                {withdrawals.map((w) => (
                  <div
                    key={w._id}
                    className={`p-3.5 flex items-center justify-between text-xs ${
                      w.status === 'reversed' ? 'opacity-40 line-through' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-cafe-forest">{w.partnerId?.name}</div>
                      <div className="text-cafe-text-muted">
                        {w.effectiveDate} • {w.paymentMethod}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif font-bold text-red-600">
                        - {formatPrice(w.amount)}
                      </div>
                      <Badge
                        variant={w.status === 'recorded' ? 'cream' : 'danger'}
                        className="text-[10px] uppercase"
                      >
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Capital Entry */}
      <Modal
        isOpen={isCapitalOpen}
        onClose={() => setIsCapitalOpen(false)}
        title="Record Capital Entry"
      >
        <form onSubmit={handleRecordCapital} className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Partner</label>
            <select
              required
              value={capPartnerId}
              onChange={(e) => setCapPartnerId(e.target.value)}
              className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
            >
              <option value="">Select Partner...</option>
              {summaries.map((s) => (
                <option key={s.partner._id} value={s.partner._id}>
                  {s.partner.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Entry Type</label>
              <select
                value={capType}
                onChange={(e) => setCapType(e.target.value as 'contribution' | 'capital_return')}
                className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
              >
                <option value="contribution">Capital Contribution (+)</option>
                <option value="capital_return">Capital Return (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={capAmountRupees}
                onChange={(e) => setCapAmountRupees(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Effective Date</label>
              <Input
                type="date"
                required
                value={capDate}
                onChange={(e) => setCapDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Payment Method</label>
              <select
                value={capMethod}
                onChange={(e) => setCapMethod(e.target.value)}
                className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
              >
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash_drawer">Cash Drawer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">
              Reference / Transaction ID
            </label>
            <Input
              placeholder="e.g. NEFT-20261019"
              value={capRef}
              onChange={(e) => setCapRef(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCapitalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Recording...' : 'Record Capital Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Withdrawal */}
      <Modal
        isOpen={isWithdrawalOpen}
        onClose={() => setIsWithdrawalOpen(false)}
        title="Record Partner Profit Withdrawal"
      >
        <form onSubmit={handleRecordWithdrawal} className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Partner</label>
            <select
              required
              value={withPartnerId}
              onChange={(e) => setWithPartnerId(e.target.value)}
              className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
            >
              <option value="">Select Partner...</option>
              {summaries.map((s) => (
                <option key={s.partner._id} value={s.partner._id}>
                  {s.partner.name} (Balance: {formatPrice(s.netBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={withAmountRupees}
                onChange={(e) => setWithAmountRupees(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Payment Method</label>
              <select
                value={withMethod}
                onChange={(e) => setWithMethod(e.target.value)}
                className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
              >
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="upi">UPI</option>
                <option value="cash_drawer">Cash Drawer (Deducts Float)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Date</label>
            <Input
              type="date"
              required
              value={withDate}
              onChange={(e) => setWithDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsWithdrawalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Recording...' : 'Record Withdrawal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Update Shares Schedule */}
      <Modal
        isOpen={isSharesOpen}
        onClose={() => setIsSharesOpen(false)}
        title="Update Partner Equity Share Schedule"
      >
        <form onSubmit={handleUpdateShares} className="space-y-4">
          <p className="text-xs text-cafe-text-muted">
            Define equity ownership percentages. Total must sum to exactly 100.00%. Changes take effect on the 1st of the selected month.
          </p>

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">
              Effective Month (First day)
            </label>
            <Input
              type="date"
              required
              value={newShareDate}
              onChange={(e) => setNewShareDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {summaries.map((s) => (
              <div key={s.partner._id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-cafe-forest">{s.partner.name}</span>
                <div className="flex items-center gap-1 w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 50.00"
                    value={partnerSharesInputs[s.partner._id] || ''}
                    onChange={(e) =>
                      setPartnerSharesInputs({
                        ...partnerSharesInputs,
                        [s.partner._id]: e.target.value,
                      })
                    }
                  />
                  <span className="text-xs text-cafe-text-muted">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-cafe-forest/10">
            <Button type="button" variant="ghost" onClick={() => setIsSharesOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Update Shares'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Partner */}
      <Modal
        isOpen={isAddPartnerOpen}
        onClose={() => setIsAddPartnerOpen(false)}
        title="Add New Partner"
      >
        <form onSubmit={handleAddPartner} className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Partner Full Name</label>
            <Input
              required
              placeholder="e.g. Rohan Sharma"
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Email</label>
              <Input
                type="email"
                placeholder="rohan@genzcafe.in"
                value={newPartnerEmail}
                onChange={(e) => setNewPartnerEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Phone</label>
              <Input
                placeholder="9876543210"
                value={newPartnerPhone}
                onChange={(e) => setNewPartnerPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">PAN Card</label>
            <Input
              placeholder="e.g. ABCDE1234F"
              value={newPartnerPan}
              onChange={(e) => setNewPartnerPan(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddPartnerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Add Partner'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
