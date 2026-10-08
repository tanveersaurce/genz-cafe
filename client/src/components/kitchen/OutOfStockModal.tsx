import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Check, Ban, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';

interface MenuItemSummary {
  id: string;
  name: string;
  isAvailable: boolean;
  category?: { name: string; slug: string };
  foodType: 'veg' | 'non_veg' | 'egg';
}

interface OutOfStockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OutOfStockModal: React.FC<OutOfStockModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rawItems, isLoading } = useQuery<MenuItemSummary[]>({
    queryKey: ['kitchen', 'menu-items'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: MenuItemSummary[] }>('/menu/items');
        return Array.isArray(res?.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const items = useMemo(() => (Array.isArray(rawItems) ? rawItems : []), [rawItems]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      return apiClient.patch<{ success: boolean; data: { id: string; isAvailable: boolean } }>(
        `/menu/items/${id}/availability`,
        { isAvailable }
      );
    },
    onMutate: async ({ id, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: ['kitchen', 'menu-items'] });
      const previousItems = queryClient.getQueryData<MenuItemSummary[]>(['kitchen', 'menu-items']);

      queryClient.setQueryData<MenuItemSummary[]>(['kitchen', 'menu-items'], (old) => {
        if (!old) return [];
        return old.map((item) => (item.id === id ? { ...item, isAvailable } : item));
      });

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['kitchen', 'menu-items'], context.previousItems);
      }
      toast({
        title: 'Error updating stock',
        message: 'Could not change item availability. Please try again.',
        type: 'error',
      });
    },
    onSuccess: (_res, vars) => {
      toast({
        title: vars.isAvailable ? 'Back in Stock' : 'Marked Out of Stock (86)',
        message: `Item status updated across POS and kitchen.`,
        type: vars.isAvailable ? 'success' : 'info',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'menu-items'] });
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      void queryClient.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const lower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.category?.name.toLowerCase().includes(lower)
    );
  }, [items, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-amber-500" />
              <span>Quick Stock Control (86 Items)</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Instantly toggle item availability across POS and customer menu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-stone-800 bg-stone-900/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Search menu items or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="py-12 flex justify-center text-stone-400 text-sm">
              Loading menu items...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <AlertCircle className="w-8 h-8 text-stone-600 mx-auto mb-2" />
              <p>No items found matching &quot;{search}&quot;</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                  item.isAvailable
                    ? 'bg-stone-950/40 border-stone-800'
                    : 'bg-red-950/20 border-red-900/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      item.foodType === 'veg'
                        ? 'bg-emerald-500'
                        : item.foodType === 'egg'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <h4 className="font-bold text-white text-base">{item.name}</h4>
                    {item.category && (
                      <span className="text-xs text-stone-400">{item.category.name}</span>
                    )}
                  </div>
                </div>

                {/* Big Touch Toggle Button */}
                <button
                  type="button"
                  disabled={toggleMutation.isPending}
                  onClick={() =>
                    toggleMutation.mutate({
                      id: item.id,
                      isAvailable: !item.isAvailable,
                    })
                  }
                  className={`min-h-[48px] px-5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                    item.isAvailable
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-stone-800 hover:bg-stone-700 text-red-400 border border-red-800'
                  }`}
                >
                  {item.isAvailable ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>IN STOCK</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 text-red-400" />
                      <span>OUT OF STOCK</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-800 bg-stone-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
