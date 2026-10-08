import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Sparkles,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { SeoHead } from '@/components/common/SeoHead';
import { publicQrService } from '@/services/publicQrService';
import {
  mapKotStatusToCustomerStatus,
  KotStatus,
} from '@/lib/customerStatusMapper';
import { ApiClientError } from '@/lib/apiClient';

interface StepConfig {
  status: KotStatus;
  label: string;
  subtext: string;
  icon: React.ElementType;
}

const ORDER_STEPS: StepConfig[] = [
  {
    status: 'new',
    label: 'Order received',
    subtext: 'Ticket printed in the kitchen',
    icon: CheckCircle2,
  },
  {
    status: 'preparing',
    label: 'Being prepared',
    subtext: 'Chefs are handcrafting your items',
    icon: Clock,
  },
  {
    status: 'ready',
    label: 'Ready, on its way to your table',
    subtext: 'Plated and heading to your table',
    icon: UtensilsCrossed,
  },
  {
    status: 'served',
    label: 'Served. Enjoy!',
    subtext: 'Delivered to your table',
    icon: Sparkles,
  },
];

const STEP_ORDER: Record<KotStatus, number> = {
  new: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  cancelled: -1,
};

export const OrderStatusPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const [remainingUndoSeconds, setRemainingUndoSeconds] = useState<number>(0);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Poll status every 10 seconds; pauses when document.hidden, resumes on focus
  const {
    data: orderStatus,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['customer-order-status', token],
    queryFn: async () => {
      if (!token) throw new Error('Missing order status token');
      return publicQrService.getStatus(token);
    },
    enabled: Boolean(token),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.kotStatus === 'cancelled' || data?.kotStatus === 'served') {
        return false;
      }
      return 10000;
    },
    refetchOnWindowFocus: true,
  });

  // Calculate undo countdown
  useEffect(() => {
    if (!orderStatus || !orderStatus.undoUntil || !orderStatus.undoAllowed) {
      setRemainingUndoSeconds(0);
      return;
    }

    const updateTimer = () => {
      const until = new Date(orderStatus.undoUntil).getTime();
      const now = Date.now();
      const diffSecs = Math.max(0, Math.ceil((until - now) / 1000));
      setRemainingUndoSeconds(diffSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [orderStatus]);

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Missing token');
      return publicQrService.cancelOrder(token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-order-status', token] });
      setCancelError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError) {
        setCancelError(err.message);
      } else if (err instanceof Error) {
        setCancelError(err.message);
      } else {
        setCancelError('Could not cancel order. Kitchen may have already started preparation.');
      }
    },
  });

  const handleCancelClick = () => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      cancelMutation.mutate();
    }
  };

  const currentStepIndex = orderStatus ? STEP_ORDER[orderStatus.kotStatus] : 0;
  const isCancelled = orderStatus?.kotStatus === 'cancelled';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <SeoHead
        title="Live Order Status"
        description="Track the real-time status of your Gen-Z Cafe dine-in order."
        canonicalPath={`/order/status/${token || ''}`}
        noindex={true}
      />

      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={orderStatus ? `/menu?table=${orderStatus.tableNumber}` : '/menu'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink-600 hover:text-brand-green-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Menu
        </Link>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 text-xs text-brand-ink-500 hover:text-brand-ink-800 disabled:opacity-50 transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Live updates (10s)</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center space-y-4">
          <Spinner size="lg" variant="gold" />
          <p className="text-sm font-medium text-brand-ink-600">Retrieving order details...</p>
        </div>
      ) : isError || !orderStatus ? (
        <Card variant="cream" className="text-center p-8 space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <CardTitle className="font-serif text-xl text-brand-green-950">
            Order Not Found
          </CardTitle>
          <p className="text-sm text-brand-ink-600 max-w-sm mx-auto">
            {error instanceof Error ? error.message : 'This status link may have expired or is invalid.'}
          </p>
          <Link to="/menu">
            <Button className="bg-brand-green-900 text-brand-gold-400">
              Browse Cafe Menu
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Order Header Card */}
          <Card variant="dark" className="text-brand-cream-100 overflow-hidden shadow-soft">
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-brand-green-800/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="gold" size="sm" className="mb-2">
                    Dine-In &bull; Table {orderStatus.tableNumber}
                  </Badge>
                  <CardTitle className="font-serif font-bold text-2xl text-brand-gold-400">
                    {mapKotStatusToCustomerStatus(orderStatus.kotStatus)}
                  </CardTitle>
                  <p className="text-xs text-brand-cream-200/80 mt-1">
                    Placed at {new Date(orderStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase font-mono text-brand-cream-300">
                    Order Ref
                  </div>
                  <div className="font-mono font-bold text-sm text-brand-gold-300">
                    #{orderStatus.submissionId.slice(-6).toUpperCase()}
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* 60s Undo Window Banner */}
            {orderStatus.undoAllowed && remainingUndoSeconds > 0 && !isCancelled && (
              <div className="p-4 bg-brand-green-900/90 border-b border-brand-green-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-brand-gold-300">
                  <Clock className="h-4 w-4 shrink-0 text-brand-gold-400 animate-pulse" />
                  <span>
                    Need to change something? You can cancel within <strong>{remainingUndoSeconds}s</strong>
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelClick}
                  disabled={cancelMutation.isPending}
                  className="bg-transparent border-red-400 text-red-200 hover:bg-red-950 hover:text-white text-xs h-8 px-3 shrink-0"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                </Button>
              </div>
            )}

            {cancelError && (
              <div className="p-3 bg-red-900/80 text-red-100 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}
          </Card>

          {/* Stepper Visualization */}
          <Card variant="cream" className="p-5 sm:p-6 shadow-soft">
            {isCancelled ? (
              <div className="py-6 text-center space-y-2">
                <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="font-serif font-bold text-lg text-brand-green-950">
                  Order Cancelled
                </h3>
                <p className="text-xs text-brand-ink-500 max-w-sm mx-auto">
                  This order was cancelled and was not prepared by the kitchen. You will not be billed for it.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-xs font-semibold text-brand-ink-600 uppercase tracking-wider">
                  Kitchen Progress
                </div>

                <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-cream-300">
                  {ORDER_STEPS.map((step, index) => {
                    const isCompleted = currentStepIndex > index;
                    const isCurrent = currentStepIndex === index;
                    const IconComponent = step.icon;

                    return (
                      <div key={step.status} className="relative flex items-start gap-4">
                        {/* Step Marker */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-0.5 h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-brand-green-950 text-brand-gold-400 ring-4 ring-brand-gold-400/30 shadow-md'
                              : 'bg-brand-cream-200 text-brand-ink-400 border border-brand-cream-300'
                          }`}
                        >
                          <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </div>

                        {/* Step Label */}
                        <div className="min-w-0">
                          <p
                            className={`font-serif text-sm sm:text-base font-bold ${
                              isCurrent
                                ? 'text-brand-green-950'
                                : isCompleted
                                ? 'text-emerald-800'
                                : 'text-brand-ink-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-xs text-brand-ink-500 mt-0.5">
                            {step.subtext}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Ordered Dishes Summary */}
          <Card variant="cream" className="shadow-soft">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-brand-cream-200 flex flex-row items-center justify-between">
              <CardTitle className="font-serif font-bold text-base text-brand-green-950">
                Dishes in this Order
              </CardTitle>
              <span className="text-xs text-brand-ink-500 font-mono">
                {orderStatus.items.reduce((s, i) => s + i.qty, 0)} items
              </span>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3">
              {orderStatus.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between py-2 border-b border-brand-cream-200/60 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono font-bold text-xs bg-brand-cream-200 text-brand-green-950 h-6 w-6 rounded flex items-center justify-center shrink-0">
                      {item.qty}&times;
                    </span>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-brand-green-950">
                        {item.nameSnapshot}
                      </h4>
                      {item.variantName && (
                        <span className="text-[11px] text-brand-gold-700 bg-brand-gold-50 px-1.5 py-0.2 rounded font-mono inline-block">
                          {item.variantName}
                        </span>
                      )}
                      {item.note && (
                        <p className="text-xs text-brand-ink-500 italic mt-0.5">
                          Note: &ldquo;{item.note}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions Footer */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link
              to={`/menu?table=${orderStatus.tableNumber}`}
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                className="w-full sm:w-auto gap-2 border-brand-green-900 text-brand-green-950 hover:bg-brand-green-50"
              >
                <ShoppingBag className="h-4 w-4" />
                Order More Items
              </Button>
            </Link>

            <span className="text-xs text-brand-ink-400 text-center sm:text-right">
              Freshly crafted by Gen-Z Cafe chefs
            </span>
          </div>
        </>
      )}
    </div>
  );
};
