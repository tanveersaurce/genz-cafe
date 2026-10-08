import React, { useState } from 'react';
import { X, History, Clock, CheckCheck, Eye } from 'lucide-react';
import { KitchenKot } from './KitchenTicketCard';

interface RecallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recentlyServedKots: KitchenKot[];
  clockOffsetMs: number;
  nowMs: number;
}

export const RecallDrawer: React.FC<RecallDrawerProps> = ({
  isOpen,
  onClose,
  recentlyServedKots,
  clockOffsetMs,
  nowMs,
}) => {
  const [selectedKot, setSelectedKot] = useState<KitchenKot | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-stone-900 border-l border-stone-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-bold text-white">Recently Served Tickets (Recall)</h2>
              <p className="text-xs text-stone-400">Past 20 minutes recall history (read-only view)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {recentlyServedKots.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <CheckCheck className="w-10 h-10 text-stone-600 mx-auto mb-2" />
              <p>No recently served tickets in the past 20 minutes.</p>
            </div>
          ) : (
            recentlyServedKots.map((kot) => {
              const serverNowMs = nowMs - clockOffsetMs;
              const servedMs = kot.timestamps?.servedAt
                ? new Date(kot.timestamps.servedAt).getTime()
                : 0;
              const minsAgo = Math.max(0, Math.floor((serverNowMs - servedMs) / 60000));

              return (
                <div
                  key={kot.kotId}
                  className="p-4 rounded-xl border border-stone-800 bg-stone-950/60 hover:border-stone-700 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-white font-mono">
                        {kot.orderType === 'dine_in' ? `T${kot.tableNumber}` : 'TAKEAWAY'}
                      </span>
                      <span className="text-sm font-bold text-stone-300 font-mono">
                        {kot.kotNo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-stone-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Served {minsAgo}m ago</span>
                    </div>
                  </div>

                  <div className="text-sm text-stone-300">
                    <span className="font-semibold">{kot.items.length} items: </span>
                    <span className="text-stone-400">
                      {kot.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedKot(kot)}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Ticket Details</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Modal Detail */}
        {selectedKot && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div>
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-widest">
                    RECALLED TICKET (READ-ONLY)
                  </span>
                  <h3 className="text-2xl font-black text-white mt-2 font-mono">
                    {selectedKot.orderType === 'dine_in' ? `Table ${selectedKot.tableNumber}` : 'Takeaway'} - {selectedKot.kotNo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKot(null)}
                  className="p-2 text-stone-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
                {selectedKot.items.map((item) => (
                  <div
                    key={item.lineId}
                    className="flex items-baseline justify-between py-1.5 border-b border-stone-800/60"
                  >
                    <span className="text-base font-bold text-stone-200">
                      {item.qty}x {item.name} {item.variant && `(${item.variant})`}
                    </span>
                    {item.note && (
                      <span className="text-xs text-amber-400 font-medium">Note: {item.note}</span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-stone-500 pt-2 border-t border-stone-800">
                * Note: Food marked served to customers cannot be moved back to preparing/ready to preserve table billing flow.
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedKot(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-white text-sm font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
