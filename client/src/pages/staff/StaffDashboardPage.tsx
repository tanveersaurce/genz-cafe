import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Server, RefreshCw, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { financeService } from '@/services/financeService';
import { formatPrice } from '@/lib/formatPrice';

export const StaffDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const canViewFinance = hasPermission(user?.permissions, 'finance:view');
  const {
    data: health,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['backend-health'],
    queryFn: () => apiClient.checkHealth(),
    retry: 1,
  });

  const { data: pnl } = useQuery({
    queryKey: ['month-pnl-summary'],
    queryFn: () => financeService.getPnl(),
    enabled: canViewFinance,
  });

  return (
    <div className="space-y-8 text-left max-w-6xl mx-auto">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-brand-green-950 font-sans tracking-tight">
            Staff Overview Dashboard
          </h1>
          <p className="text-small text-brand-ink-500 font-sans mt-0.5">
            Operational center for Gen-Z Cafe partners and staff.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />}
        >
          Refresh Status
        </Button>
      </div>

      {/* Backend API Health Verification Card */}
      <Card variant="white" className="border-l-4 border-l-brand-green-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="h-5 w-5 text-brand-green-800" />
              <CardTitle className="text-h4 font-sans font-semibold">
                Backend Connection Live Check
              </CardTitle>
            </div>
            {isLoading ? (
              <Badge variant="cream" size="sm" dot>
                Checking API...
              </Badge>
            ) : health?.status === 'ok' ? (
              <Badge variant="success" size="sm" dot>
                API Online (200 OK)
              </Badge>
            ) : (
              <Badge variant="danger" size="sm" dot>
                API Disconnected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-3 py-2 text-small text-brand-ink-500">
              <Spinner size="sm" variant="green" />
              <span>Pinging Express /api/health endpoint...</span>
            </div>
          )}

          {isError && (
            <div className="text-small text-semantic-danger">
              <p className="font-semibold">Unable to connect to server:</p>
              <p className="text-caption font-mono mt-1">
                {error instanceof Error ? error.message : 'Network error'}
              </p>
            </div>
          )}

          {health && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono text-small">
              <div className="p-3 rounded-card-sm bg-brand-cream-50 border border-brand-cream-300">
                <span className="text-caption font-sans text-brand-ink-500 block mb-1">Status</span>
                <span className="font-semibold text-semantic-success">{health.status.toUpperCase()}</span>
              </div>
              <div className="p-3 rounded-card-sm bg-brand-cream-50 border border-brand-cream-300">
                <span className="text-caption font-sans text-brand-ink-500 block mb-1">Uptime</span>
                <span className="font-semibold text-brand-green-900">{Math.round(health.uptime)} seconds</span>
              </div>
              <div className="p-3 rounded-card-sm bg-brand-cream-50 border border-brand-cream-300">
                <span className="text-caption font-sans text-brand-ink-500 block mb-1">Server Timestamp</span>
                <span className="text-caption text-brand-ink-700 truncate block">{health.timestamp}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational Metrics Placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: "Today's Orders", value: '42', note: 'Phase 2: Live POS Sync' },
          { title: 'Gross Revenue', value: '₹18,450', note: 'Phase 2: Shift Analytics' },
          { title: 'Active Tables', value: '7 / 12', note: 'Phase 2: Floor Map' },
          { title: 'Kitchen Queue', value: '3 Pending', note: 'Phase 2: Live KDS' },
        ].map((stat, i) => (
          <Card key={i} variant="cream">
            <CardHeader>
              <span className="text-caption font-medium text-brand-ink-500 uppercase tracking-wider font-sans">
                {stat.title}
              </span>
              <div className="text-3xl font-bold font-sans text-brand-green-950 mt-1">
                {stat.value}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-caption text-brand-green-700 font-medium font-sans">
                {stat.note}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canViewFinance && pnl && (
        <Card variant="white" className="border-l-4 border-l-brand-gold-500 shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold text-brand-ink-500 uppercase tracking-wider font-sans">
                Month Profit So Far
              </span>
              <div className="flex items-center gap-1 text-caption text-brand-green-800 font-semibold">
                <TrendingUp className="w-4 h-4 text-brand-gold-600" />
                <span>{(pnl.grossMarginBasisPoints / 100).toFixed(1)}% Gross Margin</span>
              </div>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <span
                className={`text-3xl font-bold font-sans ${
                  pnl.netProfit >= 0 ? 'text-brand-green-950' : 'text-semantic-danger'
                }`}
              >
                {pnl.netProfit >= 0 ? '+' : '-'}
                {formatPrice(Math.abs(pnl.netProfit))}
              </span>
              <span className="text-small text-brand-ink-500">
                Net Revenue: {formatPrice(pnl.revenue.netRevenue)} • Direct Costs: {formatPrice(pnl.directCosts.total)}
              </span>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};
