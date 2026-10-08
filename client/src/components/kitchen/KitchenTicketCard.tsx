import React from 'react';
import { Clock, AlertTriangle, Undo2, Play, CheckCircle2, MessageSquare } from 'lucide-react';
import { kitchenSettings } from '@/config/kitchenSettings';

export interface KitchenItem {
  lineId: string;
  menuItemId?: string;
  name: string;
  variant?: string;
  qty: number;
  note?: string;
  foodType: 'veg' | 'non_veg' | 'egg';
  status: 'active' | 'cancelled';
}

export interface KitchenKot {
  kotId: string;
  kotNo: string;
  orderId: string;
  orderNo: string;
  orderType: 'dine_in' | 'takeaway';
  tableNumber: number | null;
  tableName?: string | null;
  customerName?: string | null;
  source?: 'staff' | 'customer';
  zone?: string | null;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';
  sentAt?: string;
  startedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  timestamps: {
    sentAt: string;
    receivedAt: string;
    startedAt: string | null;
    readyAt: string | null;
    servedAt: string | null;
  };
  items: KitchenItem[];
}

export interface KitchenBoardApiResponse {
  serverTime: string;
  activeKots: KitchenKot[];
  recentlyServedKots: KitchenKot[];
}

export interface KitchenTicketCardProps {
  kot: KitchenKot;
  clockOffsetMs?: number;
  nowMs?: number;
  canUpdate?: boolean;
  onStatusChange?: (kotId: string, to: 'preparing' | 'ready', expectedFrom: 'new' | 'preparing' | 'ready') => void;
  isPending?: boolean;
  lastActionAt?: number | null;
  lastActionFrom?: 'new' | 'preparing' | 'ready' | null;
  onAction?: (kotId: string, to: 'preparing' | 'ready') => void;
  onUndo?: (kotId: string) => void;
}

export const KitchenTicketCard: React.FC<KitchenTicketCardProps> = ({
  kot,
  clockOffsetMs = 0,
  nowMs = Date.now(),
  canUpdate = true,
  onStatusChange,
  isPending = false,
  lastActionAt,
  lastActionFrom,
  onAction,
  onUndo,
}) => {
  const handleStatusChange = (
    kotId: string,
    to: 'preparing' | 'ready',
    expectedFrom: 'new' | 'preparing' | 'ready'
  ) => {
    if (onStatusChange) {
      onStatusChange(kotId, to, expectedFrom);
    } else if (onAction) {
      onAction(kotId, to);
    }
  };

  const handleUndo = () => {
    if (onUndo) {
      onUndo(kot.kotId);
    } else if (onStatusChange && lastActionFrom) {
      onStatusChange(kot.kotId, lastActionFrom as 'preparing' | 'ready', kot.status as 'new' | 'preparing' | 'ready');
    }
  };

  // Clock skew calculation: server time equivalent = nowMs - clockOffsetMs
  const serverNowMs = nowMs - clockOffsetMs;
  const receivedIso = kot.timestamps?.receivedAt || kot.timestamps?.sentAt || kot.sentAt || new Date().toISOString();
  const receivedMs = new Date(receivedIso).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((serverNowMs - receivedMs) / 60000));

  const isWarning = elapsedMinutes >= kitchenSettings.warningThresholdMinutes && elapsedMinutes < kitchenSettings.urgentThresholdMinutes;
  const isUrgent = elapsedMinutes >= kitchenSettings.urgentThresholdMinutes;

  const hasCancelledItems = kot.items.some((i) => i.status === 'cancelled');

  // Can undo if within 30 seconds of an action
  const canUndoRecent =
    lastActionAt &&
    serverNowMs - lastActionAt <= kitchenSettings.undoWindowSeconds * 1000 &&
    lastActionFrom;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden ${
        isUrgent
          ? 'border-red-600 bg-stone-900 shadow-lg shadow-red-950/40 ring-2 ring-red-500/50'
          : isWarning
            ? 'border-amber-600/80 bg-stone-900 shadow-md shadow-amber-950/30'
            : 'border-stone-800 bg-stone-900/90 shadow-sm'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          isUrgent
            ? 'bg-red-950/60 border-red-800/80'
            : isWarning
              ? 'bg-amber-950/40 border-amber-800/60'
              : 'bg-stone-800/60 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                {kot.orderType === 'dine_in' ? `T${kot.tableNumber}` : 'TAKEAWAY'}
              </span>
              {kot.customerName && (
                <span className="text-base font-bold text-amber-400 font-sans truncate max-w-[130px]">
                  {kot.customerName}
                </span>
              )}
            </div>
            {kot.source === 'customer' && (
              <span className="text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded w-fit mt-0.5">
                CUSTOMER ORDER
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-stone-200 font-mono tracking-wide">
              {kot.kotNo}
            </span>
            <span className="text-xs text-stone-400">Order #{kot.orderNo}</span>
          </div>
        </div>

        {/* Age Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold font-mono ${
              isUrgent
                ? 'bg-red-500 text-white animate-pulse'
                : isWarning
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{elapsedMinutes}m</span>
          </div>
          {isUrgent && (
            <span className="text-xs font-black px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
              URGENT
            </span>
          )}
          {isWarning && !isUrgent && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-stone-950 uppercase tracking-wider">
              WAITING
            </span>
          )}
        </div>
      </div>

      {/* Cancelled Item Alert Banner */}
      {hasCancelledItems && (
        <div className="bg-red-950/80 border-b border-red-800/80 px-4 py-1.5 flex items-center gap-2 text-red-200 text-xs font-bold uppercase tracking-wider animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Item Cancelled Alert</span>
        </div>
      )}

      {/* Items List (Scrollable for 20+ lines) */}
      <div className="p-4 flex-1 space-y-3 max-h-[460px] overflow-y-auto">
        {kot.items.map((item) => {
          const isCancelled = item.status === 'cancelled';
          return (
            <div
              key={item.lineId}
              className={`flex items-start justify-between pb-3 border-b border-stone-800/80 last:border-0 ${
                isCancelled ? 'line-through opacity-50 bg-red-950/20 p-2 rounded-lg' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Food Type Indicator */}
                <span
                  className={`inline-block w-4 h-4 rounded-sm border shrink-0 mt-1 flex items-center justify-center ${
                    item.foodType === 'veg'
                      ? 'border-emerald-500 bg-emerald-950/30'
                      : item.foodType === 'egg'
                        ? 'border-amber-500 bg-amber-950/30'
                        : 'border-red-500 bg-red-950/30'
                  }`}
                  title={item.foodType}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.foodType === 'veg'
                        ? 'bg-emerald-500'
                        : item.foodType === 'egg'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  />
                </span>

                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white leading-tight">
                      {item.name}
                    </span>
                    {item.variant && (
                      <span className="text-sm font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded">
                        {item.variant}
                      </span>
                    )}
                  </div>

                  {/* Preparation Special Note */}
                  {item.note && (
                    <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold">
                      <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{item.note}</span>
                    </div>
                  )}

                  {isCancelled && (
                    <span className="mt-1 inline-block text-xs font-black text-red-400 uppercase tracking-widest">
                      CANCELLED
                    </span>
                  )}
                </div>
              </div>

              {/* Large Quantity Badge */}
              <div className="flex items-center justify-center min-w-[44px] h-[44px] rounded-xl bg-stone-800 border border-stone-700 text-2xl font-black text-white shrink-0 ml-3">
                {item.qty}
              </div>
            </div>
          );
        })}
      </div>

      {/* Large Touch Interaction Buttons (>= 56px height) */}
      {canUpdate && (
        <div className="p-3 bg-stone-950/80 border-t border-stone-800 flex gap-2">
          {kot.status === 'new' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(kot.kotId, 'preparing', 'new')}
              className="flex-1 min-h-[56px] rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-lg flex items-center justify-center gap-2 shadow transition-all active:scale-95 disabled:opacity-50"
            >
              <Play className="w-6 h-6 fill-stone-950" />
              <span>START PREPARING</span>
            </button>
          )}

          {kot.status === 'preparing' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(kot.kotId, 'ready', 'preparing')}
              className="flex-1 min-h-[56px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-lg flex items-center justify-center gap-2 shadow transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>MARK READY</span>
            </button>
          )}

          {kot.status === 'ready' && (
            <div className="w-full flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(kot.kotId, 'preparing', 'ready')}
                className="flex-1 min-h-[56px] rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 border border-amber-500/40 font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                title="Kitchen bump back (undo ready status)"
              >
                <Undo2 className="w-5 h-5" />
                <span>BUMP BACK TO PREPARING</span>
              </button>
            </div>
          )}

          {/* Quick Undo window within 30s after recent action */}
          {canUndoRecent && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleUndo}
              className="min-h-[56px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-600 font-bold text-sm flex items-center gap-1.5 transition-all"
            >
              <Undo2 className="w-4 h-4" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
