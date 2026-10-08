import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { FoodTypeIndicator } from '@/components/menu/FoodTypeIndicator';
import { AvailabilityToggle } from '@/components/menu/AvailabilityToggle';
import { CategoryModal, CategoryData } from '@/components/menu/CategoryModal';
import { MenuItemModal, MenuItemData } from '@/components/menu/MenuItemModal';
import { PriceHistoryModal } from '@/components/menu/PriceHistoryModal';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  History,
  Star,
  Clock,
  FolderPlus,
} from 'lucide-react';

export const MenuManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const canWrite = hasPermission(user?.permissions, 'menu:write');
  const canDelete = hasPermission(user?.permissions, 'menu:delete');

  // Filters & Search
  const [activeTab, setActiveTab] = useState('items');
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');

  // Modals state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ id: string; name: string } | null>(null);

  // 1. Fetch Categories
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery<{ success: boolean; data: CategoryData[] }>({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      return apiClient.get<{ success: boolean; data: CategoryData[] }>('/menu/categories');
    },
  });

  const categories = categoriesData?.data || [];

  // 2. Fetch Menu Items
  const {
    data: itemsData,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useQuery<{ success: boolean; data: MenuItemData[] }>({
    queryKey: ['menu-items', selectedCategoryFilter, foodTypeFilter, availabilityFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategoryFilter) params.append('category', selectedCategoryFilter);
      if (foodTypeFilter) params.append('foodType', foodTypeFilter);
      if (availabilityFilter) params.append('isAvailable', availabilityFilter);
      if (search) params.append('search', search);

      return apiClient.get<{ success: boolean; data: MenuItemData[] }>(
        `/menu/items?${params.toString()}`
      );
    },
  });

  const items = itemsData?.data || [];

  // Archive Item Mutation
  const archiveItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/menu/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ type: 'success', title: 'Item Archived', message: 'Menu item moved to archive.' });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Archive Failed', message: err.message });
    },
  });

  // Archive Category Mutation
  const archiveCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/menu/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({ type: 'success', title: 'Category Archived', message: 'Category moved to archive.' });
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Archive Blocked', message: err.message });
    },
  });

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold text-brand-green-950 font-sans">
            Menu Management
          </h1>
          <p className="text-small text-brand-ink-500 font-sans mt-0.5">
            Configure dishes, beverage recipes, portion sizes, prices in paise, and real-time stock availability.
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FolderPlus className="h-4 w-4" />}
              onClick={() => {
                setEditingCategory(null);
                setCategoryModalOpen(true);
              }}
            >
              New Category
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingItem(null);
                setItemModalOpen(true);
              }}
            >
              Add Menu Item
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'items', label: `Menu Items (${items.length})` },
          { id: 'categories', label: `Categories (${categories.length})` },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pill"
      />

      {/* ============================================================== */}
      {/* TAB 1: MENU ITEMS */}
      {/* ============================================================== */}
      {activeTab === 'items' && (
        <div className="space-y-4 pt-2">
          {/* Filters Bar */}
          <Card variant="white">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:flex-1">
                <Input
                  placeholder="Search item by name or ingredients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="w-40">
                  <Select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    options={[
                      { value: '', label: 'All Categories' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>

                <div className="w-36">
                  <Select
                    value={foodTypeFilter}
                    onChange={(e) => setFoodTypeFilter(e.target.value)}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'veg', label: 'Veg' },
                      { value: 'non_veg', label: 'Non-Veg' },
                      { value: 'egg', label: 'Egg' },
                    ]}
                  />
                </div>

                <div className="w-36">
                  <Select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    options={[
                      { value: '', label: 'All Stock' },
                      { value: 'true', label: 'In Stock' },
                      { value: 'false', label: 'Out of Stock' },
                    ]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Content */}
          {itemsLoading && (
            <Card variant="white">
              <CardContent className="p-6 space-y-4">
                <Skeleton variant="rect" className="h-16 w-full" />
                <Skeleton variant="rect" className="h-16 w-full" />
                <Skeleton variant="rect" className="h-16 w-full" />
              </CardContent>
            </Card>
          )}

          {itemsError && (
            <ErrorState
              title="Failed to Load Menu Items"
              message="Could not retrieve the menu directory."
              onRetry={() => refetchItems()}
            />
          )}

          {!itemsLoading && !itemsError && items.length === 0 && (
            <EmptyState
              title="No Menu Items Found"
              description={
                search || selectedCategoryFilter || foodTypeFilter
                  ? 'No items match your active filters.'
                  : 'Add your first menu item or seed the cafe catalog.'
              }
              action={
                canWrite ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingItem(null);
                      setItemModalOpen(true);
                    }}
                  >
                    Add Menu Item
                  </Button>
                ) : undefined
              }
            />
          )}

          {!itemsLoading && !itemsError && items.length > 0 && (
            <Card variant="white" className="overflow-x-auto">
              <table className="w-full text-left text-small border-collapse">
                <thead>
                  <tr className="border-b border-brand-cream-300 bg-brand-cream-50/70 text-brand-ink-700 font-semibold">
                    <th className="py-3 px-4">Item & Dietary</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price (Paise &rarr; ₹)</th>
                    <th className="py-3 px-4">Stock Status</th>
                    <th className="py-3 px-4">Tags & Prep</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-200">
                  {items.map((item) => {
                    const categoryName =
                      typeof item.category === 'object' ? item.category.name : 'Unknown';

                    const hasMultipleVariants = item.variants && item.variants.length > 0;

                    return (
                      <tr key={item.id} className="hover:bg-brand-cream-50/50 transition-colors">
                        {/* Item Photo + Name + Type */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-card-sm overflow-hidden bg-brand-cream-100 border border-brand-cream-300 shrink-0 flex items-center justify-center">
                              {item.image?.thumbnail ? (
                                <img
                                  src={item.image.thumbnail}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FoodTypeIndicator type={item.foodType} size="sm" />
                              )}
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <FoodTypeIndicator type={item.foodType} size="sm" />
                                <span className="font-semibold text-brand-green-950">
                                  {item.name}
                                </span>
                                {item.isFeatured && (
                                  <Star className="h-3.5 w-3.5 fill-brand-gold-500 text-brand-gold-500" />
                                )}
                              </div>
                              {item.description && (
                                <p className="text-caption text-brand-ink-500 line-clamp-1 max-w-sm">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 font-medium text-brand-ink-700">
                          {categoryName}
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-brand-green-900">
                              {hasMultipleVariants
                                ? `From ${formatPaiseToRupees(item.basePrice)}`
                                : formatPaiseToRupees(item.basePrice)}
                            </span>
                            {hasMultipleVariants && (
                              <Badge variant="cream" size="sm" className="text-[10px]">
                                {item.variants.length} Sizes
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryItem({ id: item.id, name: item.name });
                                setHistoryModalOpen(true);
                              }}
                              className="p-1 text-brand-ink-400 hover:text-brand-green-900 rounded transition-colors"
                              title="Inspect price history"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] text-brand-ink-400 font-mono">
                            {item.basePrice} paise
                          </span>
                        </td>

                        {/* Stock Availability (1-Tap optimistic toggle) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <AvailabilityToggle
                              itemId={item.id}
                              itemName={item.name}
                              isAvailable={item.isAvailable}
                              queryKey={['menu-items', selectedCategoryFilter, foodTypeFilter, availabilityFilter, search]}
                            />
                            <span
                              className={`text-caption font-medium ${
                                item.isAvailable ? 'text-semantic-success' : 'text-brand-ink-500'
                              }`}
                            >
                              {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </td>

                        {/* Tags & Prep Time */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.tags?.map((tag) => (
                              <Badge key={tag} variant="gold" size="sm" className="text-[10px]">
                                {tag.replace('_', ' ')}
                              </Badge>
                            ))}
                            {item.preparationMinutes ? (
                              <span className="text-[11px] text-brand-ink-500 flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {item.preparationMinutes}m
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemModalOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Edit item details"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Archive menu item "${item.name}"?`)) {
                                    archiveItemMutation.mutate(item.id);
                                  }
                                }}
                                className="h-8 w-8 p-0 text-semantic-danger hover:bg-semantic-danger-bg"
                                title="Archive item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CATEGORIES */}
      {/* ============================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-4 pt-2">
          {categoriesLoading && (
            <Card variant="white">
              <CardContent className="p-6 space-y-4">
                <Skeleton variant="rect" className="h-16 w-full" />
                <Skeleton variant="rect" className="h-16 w-full" />
              </CardContent>
            </Card>
          )}

          {categoriesError && (
            <ErrorState
              title="Failed to Load Categories"
              message="Could not retrieve menu categories."
              onRetry={() => refetchCategories()}
            />
          )}

          {!categoriesLoading && !categoriesError && categories.length === 0 && (
            <EmptyState
              title="No Categories Found"
              description="Create a category to group cafe drinks and foods."
              action={
                canWrite ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryModalOpen(true);
                    }}
                  >
                    Add Category
                  </Button>
                ) : undefined
              }
            />
          )}

          {!categoriesLoading && !categoriesError && categories.length > 0 && (
            <Card variant="white" className="overflow-x-auto">
              <table className="w-full text-left text-small border-collapse">
                <thead>
                  <tr className="border-b border-brand-cream-300 bg-brand-cream-50/70 text-brand-ink-700 font-semibold">
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Sort Order</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-200">
                  {categories.map((cat) => {
                    const hasItems = (cat.itemCount || 0) > 0;

                    return (
                      <tr key={cat.id} className="hover:bg-brand-cream-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-brand-green-950">
                          {cat.name}
                          {cat.description && (
                            <p className="text-caption text-brand-ink-500 font-normal">
                              {cat.description}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-caption text-brand-ink-500">
                          /{cat.slug}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant="cream" size="sm">
                            {cat.itemCount || 0} active items
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-caption text-brand-ink-700">
                          #{cat.sortOrder}
                        </td>

                        <td className="py-3.5 px-4">
                          {cat.isActive ? (
                            <Badge variant="success" size="sm" dot>
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm" dot>
                              Disabled
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setCategoryModalOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Edit category"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={hasItems}
                                onClick={() => {
                                  if (hasItems) {
                                    toast({
                                      type: 'warning',
                                      title: 'Archive Protected',
                                      message: `Cannot archive "${cat.name}" because it contains active items. Reassign or archive items first.`,
                                    });
                                    return;
                                  }
                                  if (confirm(`Archive category "${cat.name}"?`)) {
                                    archiveCategoryMutation.mutate(cat.id);
                                  }
                                }}
                                className="h-8 w-8 p-0 text-semantic-danger hover:bg-semantic-danger-bg disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  hasItems
                                    ? 'Cannot archive category with active items'
                                    : 'Archive category'
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        category={editingCategory}
      />

      <MenuItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        item={editingItem}
        categories={categories}
      />

      <PriceHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        itemId={historyItem?.id}
        itemName={historyItem?.name}
      />
    </div>
  );
};
