import React, { useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  Download,
  RefreshCw,
  X,
  FileText,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import {
  auditViewerService,
  AuditLogEntry,
  AuditQueryParams,
} from '@/services/auditViewerService';

const RISKY_ACTION_CHIPS = [
  { label: 'All Actions', value: '' },
  { label: 'Item Cancellations', value: 'orders:cancel' },
  { label: 'Discounts Applied', value: 'discount.apply' },
  { label: 'Void Bills', value: 'bill.void' },
  { label: 'Cash Reversals', value: 'cash.reversed' },
  { label: 'Day Reopenings', value: 'closing.reopened' },
  { label: 'Revoked Terminals', value: 'device.revoked' },
];

const ENTITY_TYPES = [
  { label: 'All Entities', value: '' },
  { label: 'Orders', value: 'order' },
  { label: 'Bills', value: 'bill' },
  { label: 'Cash Movements', value: 'cash_movement' },
  { label: 'Daily Closings', value: 'daily_closing' },
  { label: 'Devices', value: 'device' },
  { label: 'Users & Auth', value: 'user' },
  { label: 'Approvals', value: 'approval' },
];

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all'>('today');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // Selected Log Drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Build query params based on filters
  const buildParams = (cursor?: string): AuditQueryParams => {
    const params: AuditQueryParams = {
      limit: 50,
      cursor: cursor || undefined,
      action: actionFilter || undefined,
      entityType: entityTypeFilter || undefined,
      q: searchQuery.trim() || undefined,
    };

    const now = new Date();
    if (datePreset === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      params.from = today.toISOString();
    } else if (datePreset === 'yesterday') {
      const yestStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yestEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
      params.from = yestStart.toISOString();
      params.to = yestEnd.toISOString();
    } else if (datePreset === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.from = past7.toISOString();
    } else if (datePreset === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      params.from = monthStart.toISOString();
    } else if (customFrom || customTo) {
      if (customFrom) params.from = new Date(customFrom).toISOString();
      if (customTo) params.to = new Date(customTo + 'T23:59:59.999Z').toISOString();
    }

    return params;
  };

  const fetchLogs = async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = buildParams(isInitial ? undefined : nextCursor || undefined);
      const res = await auditViewerService.getAuditLogs(params);

      if (isInitial) {
        setLogs(res.entries);
      } else {
        setLogs((prev) => [...prev, ...res.entries]);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter, datePreset, customFrom, customTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(true);
  };

  const handleExportCsv = () => {
    const params = buildParams();
    const exportUrl = auditViewerService.getExportCsvUrl(params);
    window.open(exportUrl, '_blank');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('cancel') || action.includes('void') || action.includes('revoked')) {
      return <Badge variant="danger" size="sm">{formatActionLabel(action)}</Badge>;
    }
    if (action.includes('discount') || action.includes('reopen') || action.includes('reversed')) {
      return <Badge variant="warning" size="sm">{formatActionLabel(action)}</Badge>;
    }
    if (action.includes('grant') || action.includes('performed') || action.includes('created')) {
      return <Badge variant="success" size="sm">{formatActionLabel(action)}</Badge>;
    }
    return <Badge variant="cream" size="sm">{formatActionLabel(action)}</Badge>;
  };

  const formatActionLabel = (action: string): string => {
    const map: Record<string, string> = {
      'orders:cancel': 'Item Cancelled',
      'discount.apply': 'Discount Applied',
      'bill.void': 'Bill Voided',
      'cash.recorded': 'Cash Movement',
      'cash.reversed': 'Cash Reversed',
      'closing.performed': 'Day Closed',
      'closing.reopened': 'Day Reopened',
      'device.registered': 'Terminal Added',
      'device.revoked': 'Terminal Revoked',
      'auth.approval_pin_changed': 'Approval PIN Set',
      'auth.fast_pin_changed': 'Login PIN Set',
      'approvals:grant': 'Override Approved',
    };
    return map[action] || action.replace(/[:._]/g, ' ');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-headline text-brand-ink-900">
              Audit Trail & Governance Log
            </h1>
            <Badge variant="warning" size="sm">
              Partner View
            </Badge>
          </div>
          <p className="text-body-sm text-brand-ink-500 mt-1">
            Immutable log of high-stakes operations: discounts, cancellations, voids, register closings, and approvals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => fetchLogs(true)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Risky Action Quick Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {RISKY_ACTION_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setActionFilter(chip.value)}
            className={`px-3 py-1.5 rounded-full text-caption font-semibold whitespace-nowrap transition-colors ${
              actionFilter === chip.value
                ? 'bg-brand-primary text-brand-ink-950 shadow-soft'
                : 'bg-brand-surface border border-brand-border text-brand-ink-700 hover:bg-brand-surface-card'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-brand-surface rounded-2xl border border-brand-border shadow-soft flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-400" />
            <input
              type="text"
              placeholder="Search by action, actor, or entity ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-body-sm text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
          <Button type="submit" variant="ghost" size="sm">
            Search
          </Button>
        </form>

        {/* Date Presets */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-ink-400" />
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as 'today' | 'yesterday' | '7days' | 'month' | 'all')}
            className="px-3 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-medium"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="all">Custom Range / All</option>
          </select>
          {datePreset === 'all' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900"
                title="From Date"
              />
              <span className="text-caption text-brand-ink-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900"
                title="To Date"
              />
            </div>
          )}
        </div>

        {/* Entity Type Dropdown */}
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-brand-ink-400" />
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-border bg-brand-surface-card text-caption text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-medium"
          >
            {ENTITY_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-body-sm">
          {error}
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2">
            <Spinner size="lg" variant="gold" />
            <span className="text-caption text-brand-ink-400">Loading audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-brand-ink-500">
            No audit records match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border text-caption font-semibold text-brand-ink-500 bg-brand-surface-card/60">
                  <th className="py-3 px-5">Timestamp (IST)</th>
                  <th className="py-3 px-5">Action</th>
                  <th className="py-3 px-5">Actor</th>
                  <th className="py-3 px-5">Entity</th>
                  <th className="py-3 px-5">Summary / Note</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-body-sm">
                {logs.map((entry) => {
                  const dateStr = new Date(entry.createdAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  // Extract human friendly summary from metadata
                  const meta = entry.metadata || {};
                  const reason = meta.reason ? `Reason: ${meta.reason}` : '';
                  const amount = meta.amount ? `₹${((meta.amount as number) / 100).toFixed(2)}` : '';
                  const summary = [amount, reason].filter(Boolean).join(' • ') || '—';

                  return (
                    <tr
                      key={entry._id}
                      className="hover:bg-brand-surface-card/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-3.5 px-5 font-mono text-caption text-brand-ink-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-5">
                        {getActionBadge(entry.action)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-brand-ink-900">
                          {entry.actorId?.name || entry.actorName || 'System'}
                        </div>
                        <div className="text-[11px] text-brand-ink-400 font-mono">
                          {entry.actorId?.role ? `@${entry.actorId.role}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-mono text-caption bg-brand-surface-card px-2 py-0.5 rounded-lg border border-brand-border">
                          {entry.entityType}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-brand-ink-700 max-w-xs truncate">
                        {summary}
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                          title="View metadata payload"
                        >
                          <ChevronRight className="w-4 h-4 text-brand-ink-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cursor Pagination "Load More" */}
        {hasMore && (
          <div className="p-4 border-t border-brand-border flex justify-center bg-brand-surface-card/30">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchLogs(false)}
              isLoading={loadingMore}
            >
              Load More Entries
            </Button>
          </div>
        )}
      </div>

      {/* METADATA SIDE DRAWER / MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white h-full w-full max-w-lg shadow-2xl border-l border-brand-border flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-surface-card">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-primary" />
                <h3 className="font-heading font-semibold text-body text-brand-ink-900">
                  Audit Entry Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 text-brand-ink-400 hover:text-brand-ink-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <span className="text-caption text-brand-ink-400 font-medium">Action</span>
                <div className="mt-1">{getActionBadge(selectedEntry.action)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-brand-surface-card border border-brand-border text-caption">
                <div>
                  <span className="text-brand-ink-400">Timestamp (IST)</span>
                  <div className="font-mono font-medium text-brand-ink-900 mt-0.5">
                    {new Date(selectedEntry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
                <div>
                  <span className="text-brand-ink-400">Actor</span>
                  <div className="font-medium text-brand-ink-900 mt-0.5">
                    {selectedEntry.actorId?.name || selectedEntry.actorName || 'System'}
                  </div>
                </div>
                <div>
                  <span className="text-brand-ink-400">Entity Type</span>
                  <div className="font-mono text-brand-ink-900 mt-0.5">
                    {selectedEntry.entityType}
                  </div>
                </div>
                <div>
                  <span className="text-brand-ink-400">Entity ID</span>
                  <div className="font-mono text-brand-ink-900 mt-0.5 truncate" title={selectedEntry.entityId}>
                    {selectedEntry.entityId || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-brand-ink-400">IP Address</span>
                  <div className="font-mono text-brand-ink-900 mt-0.5">
                    {selectedEntry.ip || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-brand-ink-400">User Agent</span>
                  <div className="text-brand-ink-900 mt-0.5 truncate" title={selectedEntry.userAgent}>
                    {selectedEntry.userAgent || '—'}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-caption text-brand-ink-500 font-semibold uppercase tracking-wider block mb-2">
                  Captured Metadata Payload
                </span>
                <pre className="p-4 bg-brand-ink-950 text-brand-cream-100 rounded-2xl text-caption font-mono overflow-x-auto max-h-96">
                  {JSON.stringify(selectedEntry.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-brand-border bg-brand-surface-card flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedEntry(null)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
