import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';

interface AvailabilityToggleProps {
  itemId: string;
  itemName: string;
  isAvailable: boolean;
  queryKey?: readonly unknown[];
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const AvailabilityToggle: React.FC<AvailabilityToggleProps> = ({
  itemId,
  itemName,
  isAvailable,
  queryKey = ['menu-items'],
  size = 'md',
  disabled = false,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const canToggle = hasPermission(user?.permissions, 'menu:availability') && !disabled;

  const mutation = useMutation({
    mutationFn: async (newStatus: boolean) => {
      return apiClient.patch<{ success: boolean; data: { id: string; isAvailable: boolean } }>(
        `/menu/items/${itemId}/availability`,
        { isAvailable: newStatus }
      );
    },
    // Optimistic Update
    onMutate: async (newStatus: boolean) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update list in cache if present
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const cache = old as { data?: Array<{ id: string; isAvailable: boolean }> };
        if (Array.isArray(cache.data)) {
          return {
            ...cache,
            data: cache.data.map((item) =>
              item.id === itemId ? { ...item, isAvailable: newStatus } : item
            ),
          };
        }
        return old;
      });

      return { previousData };
    },
    onError: (_err, _newStatus, context?: { previousData?: unknown }) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast({
        type: 'error',
        title: 'Update Failed',
        message: `Could not update availability for "${itemName}". Rolling back.`,
      });
    },
    onSuccess: (data) => {
      const statusText = data.data.isAvailable ? 'In Stock' : 'Marked Out of Stock';
      toast({
        type: data.data.isAvailable ? 'success' : 'info',
        title: 'Availability Updated',
        message: `"${itemName}" is now ${statusText.toLowerCase()}.`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleToggle = () => {
    if (!canToggle || mutation.isPending) return;
    mutation.mutate(!isAvailable);
  };

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isAvailable}
      aria-label={`Toggle availability for ${itemName}`}
      disabled={!canToggle || mutation.isPending}
      onClick={handleToggle}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold-500 focus:ring-offset-2',
        isSmall ? 'h-5 w-9' : 'h-6 w-11',
        isAvailable ? 'bg-semantic-success' : 'bg-brand-ink-400',
        (!canToggle || mutation.isPending) && 'opacity-60 cursor-not-allowed'
      )}
      title={
        !canToggle
          ? 'Requires menu:availability permission to change'
          : isAvailable
            ? 'Available / In Stock'
            : 'Out of Stock'
      }
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow-sm transition-transform',
          isSmall
            ? cn('h-3.5 w-3.5', isAvailable ? 'translate-x-4' : 'translate-x-1')
            : cn('h-4 w-4', isAvailable ? 'translate-x-6' : 'translate-x-1'),
          mutation.isPending && 'animate-pulse'
        )}
      />
    </button>
  );
};
