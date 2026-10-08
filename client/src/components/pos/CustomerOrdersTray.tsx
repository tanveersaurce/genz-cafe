import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Phone, Smartphone } from 'lucide-react';
import { customerOrderService, PendingCustomerOrder } from '../../services/customerOrderService';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const CustomerOrdersTray: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: pendingOrders = [] } = useQuery<PendingCustomerOrder[]>({
    queryKey: ['pending-customer-orders'],
    queryFn: () => customerOrderService.getPending(),
    refetchInterval: 10000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (submissionId: string) => customerOrderService.acknowledge(submissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-customer-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
    },
  });

  if (pendingOrders.length === 0) {
    return null;
  }

  const getAgeMinutes = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  return (
    <div className="mb-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-amber-500/20">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <div className="p-1 rounded-md bg-amber-500 text-white animate-bounce">
            <Smartphone className="w-4 h-4" />
          </div>
          <span>Customer Orders ({pendingOrders.length} unacknowledged)</span>
        </div>
        <span className="text-xs text-amber-800/80 font-medium">
          Customer orders reach the kitchen automatically
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pendingOrders.map((order) => {
          const age = getAgeMinutes(order.createdAt);
          return (
            <div
              key={order.submissionId}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-300/80 shadow-sm gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-brand-green-900 text-brand-gold-400 font-mono font-black text-sm">
                    T{order.tableNumber}
                  </span>
                  <span className="font-bold text-sm text-brand-ink-900 truncate">
                    {order.customerName}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-brand-ink-500 font-medium">
                  <span>{order.itemCount} items</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {age}m ago
                  </span>
                  {order.customerPhone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-brand-ink-700">
                        <Phone className="w-3 h-3" /> {order.customerPhone}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={
                    order.kotStatus === 'ready'
                      ? 'success'
                      : order.kotStatus === 'preparing'
                        ? 'gold'
                        : 'cream'
                  }
                  size="sm"
                >
                  {order.kotStatus}
                </Badge>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-brand-green-900 text-brand-gold-400 hover:bg-brand-green-950 font-bold text-xs h-8 px-2.5"
                  disabled={acknowledgeMutation.isPending}
                  onClick={() => acknowledgeMutation.mutate(order.submissionId)}
                  title="Acknowledge order for all staff"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Got it
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
