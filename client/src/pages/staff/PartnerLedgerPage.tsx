import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatPrice } from '@/lib/formatPrice';
import { partnerService, PartnerLedgerResponse } from '@/services/partnerService';

export const PartnerLedgerPage: React.FC = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const [ledgerData, setLedgerData] = useState<PartnerLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const loadLedger = async () => {
    if (!partnerId) return;
    try {
      setLoading(true);
      const data = await partnerService.getPartnerLedger(
        partnerId,
        fromFilter || undefined,
        toFilter || undefined
      );
      setLedgerData(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [partnerId, fromFilter, toFilter]);

  if (loading) {
    return (
      <div className="p-16 text-center">
        <Spinner className="mx-auto" />
        <p className="text-xs text-cafe-text-muted mt-2">Loading partner ledger statement...</p>
      </div>
    );
  }

  if (!ledgerData) {
    return <div className="p-12 text-center text-cafe-text-muted">Partner not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/app/finance/partners"
            className="text-xs font-semibold text-cafe-forest hover:text-cafe-gold inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Partners
          </Link>
          <h1 className="text-2xl font-serif font-bold text-cafe-forest">
            {ledgerData.partner.name} - Ledger Statement
          </h1>
          <p className="text-sm text-cafe-text-muted mt-0.5">
            PAN: {ledgerData.partner.pan || 'N/A'} • Phone: {ledgerData.partner.phone || 'N/A'} • Email:{' '}
            {ledgerData.partner.email || 'N/A'}
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-white border border-cafe-forest/15 rounded-lg px-3 py-1.5 shadow-2xs">
          <Calendar className="w-4 h-4 text-cafe-forest" />
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="text-xs bg-transparent focus:outline-hidden"
          />
          <span className="text-xs text-cafe-text-muted">to</span>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            className="text-xs bg-transparent focus:outline-hidden"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Total Credits
          </span>
          <div className="mt-2 text-2xl font-serif font-bold text-emerald-700">
            {formatPrice(ledgerData.summary.totalCredits)}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">
            Capital, Profit Shares & Reimbursements
          </span>
        </div>

        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600">
            Total Debits
          </span>
          <div className="mt-2 text-2xl font-serif font-bold text-red-600">
            {formatPrice(ledgerData.summary.totalDebits)}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">
            Withdrawals, Capital Returns & Losses
          </span>
        </div>

        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-cafe-forest">
            Net Ledger Balance
          </span>
          <div className="mt-2 text-2xl font-serif font-bold text-cafe-forest">
            {formatPrice(ledgerData.summary.netBalance)}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">
            Net claim / liability in cafe equity
          </span>
        </div>
      </div>

      {/* Running Ledger Table */}
      <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-2xs overflow-hidden">
        <div className="bg-cafe-cream/50 p-4 border-b border-cafe-forest/10 flex items-center justify-between">
          <h3 className="font-serif font-bold text-base text-cafe-forest">Transaction Ledger</h3>
          <span className="text-xs text-cafe-text-muted">
            {ledgerData.entries.length} recorded entries
          </span>
        </div>

        {ledgerData.entries.length === 0 ? (
          <div className="p-12 text-center text-cafe-text-muted">
            No ledger transactions found for this partner in the selected range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cafe-cream/30 border-b border-cafe-forest/10 text-xs font-semibold text-cafe-forest uppercase">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Reference</th>
                  <th className="py-3 px-4 text-right">Debit (Dr)</th>
                  <th className="py-3 px-4 text-right">Credit (Cr)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-forest/5">
                {ledgerData.entries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-cafe-cream/20">
                    <td className="py-3 px-4 text-xs font-medium text-cafe-text-dark">
                      {entry.entryDate}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="cream" className="text-[10px] uppercase">
                        {entry.type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-cafe-text-dark">
                      {entry.description}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-red-600">
                      {entry.debit > 0 ? formatPrice(entry.debit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-emerald-700">
                      {entry.credit > 0 ? formatPrice(entry.credit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-serif font-bold text-cafe-forest">
                      {formatPrice(entry.balance ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
