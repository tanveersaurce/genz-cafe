import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { useRealtime } from '@/lib/realtimeContext';
import { useToast } from '@/components/ui/Toast';

export interface PosReadyKot {
  kotId: string;
  kotNo: string;
  orderId: string;
  orderNo: string;
  orderType: 'dine_in' | 'takeaway';
  tableNumber: number | null;
  tableId: string | null;
  readyAt: string;
  waitingMinutes: number;
  itemCount: number;
}

export const ReadyToServeTray: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refetchIntervalFallback } = useRealtime();

  const canServe = hasPermission(user?.permissions, 'orders:serve');

  const { data: rawReadyKots } = useQuery<PosReadyKot[]>({
    queryKey: ['pos', 'ready'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: PosReadyKot[] }>('/pos/ready');
        return Array.isArray(res?.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    refetchInterval: refetchIntervalFallback,
  });

  const readyKots = Array.isArray(rawReadyKots) ? rawReadyKots : [];

  const serveMutation = useMutation({
    mutationFn: async (kotId: string) => {
      return apiClient.post<{ success: boolean; data: { idempotent: boolean } }>(
        `/pos/kots/${kotId}/served`
      );
    },
    onSuccess: () => {
      toast({
        title: 'Food Served',
        message: 'Ticket marked as served to the table.',
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'ready'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'tables'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Could not mark served',
        message: err instanceof Error ? err.message : 'Please try again',
        type: 'error',
      });
    },
  });

  if (readyKots.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-950/40 border border-amber-600/60 rounded-2xl p-4 shadow-lg mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-stone-950 animate-bounce">
            <Bell className="w-5 h-5 fill-stone-950" />
          </div>
          <div>
            <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
              <span>FOOD READY FOR PICKUP</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-xs font-mono font-bold">
                {readyKots.length}
              </span>
            </h3>
            <p className="text-xs text-amber-200/80">
              Kitchen has prepared the following order tickets. Please serve to tables immediately.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {readyKots.map((kot) => (
          <div
            key={kot.kotId}
            className="p-3.5 rounded-xl bg-stone-900 border border-amber-500/40 shadow flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-2xl font-black text-white font-mono">
                  {kot.orderType === 'dine_in' ? `Table ${kot.tableNumber}` : 'Takeaway'}
                </span>
                <div className="text-xs font-mono text-stone-400 mt-0.5">
                  {kot.kotNo} • Order #{kot.orderNo}
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{kot.waitingMinutes}m</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-stone-800">
              <span className="text-xs text-stone-400 font-medium">
                {kot.itemCount} item{kot.itemCount === 1 ? '' : 's'}
              </span>

              {canServe && (
                <button
                  type="button"
                  disabled={serveMutation.isPending}
                  onClick={() => serveMutation.mutate(kot.kotId)}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SERVED</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
