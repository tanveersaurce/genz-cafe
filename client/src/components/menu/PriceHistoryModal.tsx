import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceHistoryEntry {
  id: string;
  itemId: string;
  variantName?: string | null;
  oldPrice: number;
  newPrice: number;
  changedBy: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  changedAt: string;
}

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId?: string | null;
  itemName?: string;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
}) => {
  const { data, isLoading, isError } = useQuery<{ success: boolean; data: PriceHistoryEntry[] }>({
    queryKey: ['price-history', itemId],
    queryFn: async () => {
      return apiClient.get<{ success: boolean; data: PriceHistoryEntry[] }>(
        `/menu/items/${itemId}/price-history`
      );
    },
    enabled: !!itemId && isOpen,
  });

  const history = data?.data || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Price Change Audit History"
      description={itemName ? `Append-only price records for "${itemName}"` : ''}
    >
      <div className="space-y-4 pt-2">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton variant="rect" className="h-12 w-full" />
            <Skeleton variant="rect" className="h-12 w-full" />
            <Skeleton variant="rect" className="h-12 w-full" />
          </div>
        )}

        {isError && (
          <div className="p-3 text-small text-semantic-danger bg-semantic-danger-bg rounded-card-sm">
            Failed to retrieve price change logs.
          </div>
        )}

        {!isLoading && !isError && history.length === 0 && (
          <EmptyState
            title="No Price Adjustments Logged"
            description="This menu item has maintained its initial creation pricing."
          />
        )}

        {!isLoading && !isError && history.length > 0 && (
          <div className="divide-y divide-brand-cream-300 max-h-96 overflow-y-auto">
            {history.map((entry) => {
              const isIncrease = entry.newPrice > entry.oldPrice;
              const dateStr = new Date(entry.changedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div key={entry.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-small text-brand-green-950">
                        {entry.variantName ? `${entry.variantName} Variant` : 'Base Price'}
                      </span>
                      {entry.oldPrice === 0 ? (
                        <Badge variant="green" size="sm">Initial Setup</Badge>
                      ) : isIncrease ? (
                        <Badge variant="danger" size="sm" className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Price Increase
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Price Reduction
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-brand-ink-500">
                      Modified by{' '}
                      <strong className="text-brand-ink-700">
                        {entry.changedBy?.name || 'Admin'}
                      </strong>{' '}
                      ({entry.changedBy?.role}) on {dateStr}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-small font-semibold text-brand-green-900">
                      {formatPaiseToRupees(entry.newPrice)}
                    </div>
                    {entry.oldPrice > 0 && (
                      <div className="font-mono text-caption text-brand-ink-400 line-through">
                        {formatPaiseToRupees(entry.oldPrice)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
