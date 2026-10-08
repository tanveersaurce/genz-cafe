import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Clock,
  Flame,
  UtensilsCrossed,
  SlidersHorizontal,
  Info,
  ShoppingBag,
  Plus,
  Minus,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeoHead } from '@/components/common/SeoHead';
import { FoodTypeIndicator, FoodType } from '@/components/menu/FoodTypeIndicator';
import { CustomerCartSheet, CartItem } from '@/components/menu/CustomerCartSheet';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import { siteConfig } from '@/config/siteConfig';
import { publicQrService } from '@/services/publicQrService';
import { qrOrderingSettings } from '@/config/qrOrderingSettings';

interface PublicMenuItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  foodType: FoodType;
  basePrice: number; // in paise
  variants: Array<{ name: string; price: number; isDefault: boolean }>;
  gstRate: number;
  image?: { full: string; thumbnail: string };
  tags: string[];
  isFeatured: boolean;
  isAvailable: boolean;
  preparationMinutes?: number;
  sortOrder: number;
}

interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

interface PublicMenuResponse {
  success: boolean;
  data: {
    categories: PublicCategory[];
    totalItems: number;
  };
}

export const MenuPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Validate ?table=N (valid range: 1 to 99) and token ?t=
  const rawTableParam = searchParams.get('table');
  const qrTokenParam = searchParams.get('t') || '';

  const tableNumber = useMemo(() => {
    if (!rawTableParam) return null;
    const parsed = parseInt(rawTableParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 99) {
      return parsed;
    }
    return null;
  }, [rawTableParam]);

  // QR Ordering Context Query
  const { data: qrContext } = useQuery({
    queryKey: ['public-qr-context', tableNumber, qrTokenParam],
    queryFn: async () => {
      if (tableNumber === null) return null;
      return publicQrService.getContext(tableNumber, qrTokenParam || undefined);
    },
    enabled: tableNumber !== null,
    staleTime: 10 * 1000,
    refetchInterval: 20 * 1000,
  });

  const orderingEnabled = Boolean(tableNumber !== null && qrContext?.orderingEnabled);

  // Cart State (Persisted in sessionStorage per table)
  const cartStorageKey = tableNumber ? `genz_qr_cart_table_${tableNumber}` : 'genz_qr_cart';
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(cartStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
    } catch {
      // ignore storage errors
    }
  }, [cartItems, cartStorageKey]);

  // Selected variant map: itemId -> variantName
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Cart drawer open state
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Check if there is an active order in session
  const [lastStatusToken, setLastStatusToken] = useState<string | null>(() => {
    return sessionStorage.getItem('genz_last_status_token');
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non_veg' | 'egg'>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  const { data, isLoading, isError, refetch } = useQuery<PublicMenuResponse>({
    queryKey: ['public-menu'],
    queryFn: async () => {
      return apiClient.get<PublicMenuResponse>('/public/menu');
    },
    staleTime: 30 * 1000,
  });

  const categories = useMemo(() => data?.data?.categories || [], [data?.data?.categories]);

  // Cart helper functions
  const handleAddToCart = (item: PublicMenuItem) => {
    if (!orderingEnabled || !item.isAvailable) return;

    const hasVariants = item.variants && item.variants.length > 0;
    const defaultVariant = item.variants?.find((v) => v.isDefault) || item.variants?.[0];
    const currentVariantName = hasVariants
      ? selectedVariants[item.id] || defaultVariant?.name
      : undefined;

    const variantObj = hasVariants
      ? item.variants.find((v) => v.name === currentVariantName) || defaultVariant
      : undefined;

    const itemPrice = variantObj ? variantObj.price : item.basePrice;
    const key = `${item.id}${currentVariantName ? `:${currentVariantName}` : ''}`;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (existing.qty >= qrOrderingSettings.maxQtyPerLine) return prev;
        return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      }
      if (prev.length >= qrOrderingSettings.maxLinesPerSubmission) return prev;
      return [
        ...prev,
        {
          key,
          menuItemId: item.id,
          name: item.name,
          variantName: currentVariantName,
          price: itemPrice,
          gstRate: item.gstRate,
          qty: 1,
        },
      ];
    });
  };

  const handleUpdateQty = (key: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.key === key) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: Math.min(newQty, qrOrderingSettings.maxQtyPerLine) } : null;
          }
          return item;
        })
        .filter((i): i is CartItem => i !== null)
    );
  };

  const handleUpdateNote = (key: string, note: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, note } : item))
    );
  };

  const handleRemoveItem = (key: string) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleClearCart = () => {
    setCartItems([]);
    sessionStorage.removeItem(cartStorageKey);
  };

  const handleOrderSuccess = (statusToken: string) => {
    setIsCartOpen(false);
    sessionStorage.setItem('genz_last_status_token', statusToken);
    setLastStatusToken(statusToken);
    navigate(`/order/status/${encodeURIComponent(statusToken)}`);
  };

  const cartTotalQty = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const cartTotalPaise = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);

  // Flatten and filter items
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        const matchingItems = cat.items.filter((item) => {
          if (dietaryFilter !== 'all' && item.foodType !== dietaryFilter) {
            return false;
          }

          if (inStockOnly && !item.isAvailable) {
            return false;
          }

          if (q) {
            const nameMatch = item.name.toLowerCase().includes(q);
            const descMatch = item.description?.toLowerCase().includes(q) || false;
            const tagMatch = item.tags.some((t) => t.toLowerCase().includes(q));
            if (!nameMatch && !descMatch && !tagMatch) {
              return false;
            }
          }

          return true;
        });

        return {
          ...cat,
          items: matchingItems,
        };
      })
      .filter((cat) => {
        if (activeCategoryId !== 'all' && cat.id !== activeCategoryId) {
          return false;
        }
        return cat.items.length > 0;
      });
  }, [categories, activeCategoryId, searchQuery, dietaryFilter, inStockOnly]);

  const totalDisplayedItems = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 pb-28">
      <SeoHead
        title="Menu"
        description={`Explore the complete ${siteConfig.name} menu: artisanal coffees, cold brews, loaded burgers, gourmet pizzas, and fresh desserts.`}
        canonicalPath="/menu"
      />

      {/* Table & Ordering Status Banners */}
      {tableNumber !== null && (
        <div className="space-y-3">
          {orderingEnabled ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-card bg-brand-green-950 border border-brand-gold-500/50 p-4 text-brand-cream-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft animate-in fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-brand-gold-500 text-brand-ink-900 flex items-center justify-center font-bold text-lg font-mono">
                  {tableNumber}
                </div>
                <div>
                  <p className="font-serif font-bold text-brand-gold-400 text-body">
                    Dining at Table {tableNumber} • Live Ordering Active
                  </p>
                  <p className="text-caption text-brand-cream-100/80">
                    Add dishes below to send directly to our kitchen. When ready, view your cart to submit!
                  </p>
                </div>
              </div>
              <Badge variant="gold" size="sm" className="self-start sm:self-center">
                Self-Order Ready
              </Badge>
            </div>
          ) : qrContext?.reason === 'paused' ? (
            <div className="rounded-card bg-amber-50 border border-amber-300 p-4 text-amber-900 flex items-start gap-3 shadow-soft">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-serif font-bold text-amber-950">Self-Ordering Temporarily Paused</p>
                <p className="text-sm mt-0.5">
                  {qrContext.pauseMessage ||
                    'Our kitchen is catching up with orders. Please order with your server.'}
                </p>
              </div>
            </div>
          ) : qrContext?.reason === 'closed' || qrContext?.reason === 'cutoff' ? (
            <div className="rounded-card bg-stone-100 border border-stone-300 p-4 text-stone-900 flex items-start gap-3 shadow-soft">
              <Clock className="h-5 w-5 text-stone-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-serif font-bold text-stone-950">Kitchen Closed for Self-Ordering</p>
                <p className="text-sm mt-0.5">
                  Self-ordering closes 15 minutes before closing time. Please speak with cafe staff.
                </p>
              </div>
            </div>
          ) : qrContext?.reason === 'billed' ? (
            <div className="rounded-card bg-blue-50 border border-blue-300 p-4 text-blue-900 flex items-start gap-3 shadow-soft">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-serif font-bold text-blue-950">Table Bill Generated</p>
                <p className="text-sm mt-0.5">
                  Your table&apos;s bill has already been created. Please call our staff to add additional items.
                </p>
              </div>
            </div>
          ) : qrContext?.reason === 'invalid_token' ? (
            <div className="rounded-card bg-red-50 border border-red-300 p-4 text-red-900 flex items-start gap-3 shadow-soft">
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-serif font-bold text-red-950">Table QR Code Expired</p>
                <p className="text-sm mt-0.5">
                  This QR code is no longer valid. Please scan the current QR code on your table to self-order.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-card bg-brand-green-900 border border-brand-gold-500/50 p-4 text-brand-cream-100 flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-gold-500 text-brand-ink-900 flex items-center justify-center font-bold text-lg font-mono">
                  {tableNumber}
                </div>
                <div>
                  <p className="font-serif font-bold text-brand-gold-400 text-body">
                    Dining at Table {tableNumber}
                  </p>
                  <p className="text-caption text-brand-cream-100/80">
                    Browse our live menu. Order with your friendly server or at the main counter.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick link to active order if present */}
          {lastStatusToken && (
            <div className="p-3 bg-brand-cream-200 border border-brand-cream-300 rounded-xl flex items-center justify-between text-xs text-brand-ink-800">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>You have an ongoing order placed from this device.</span>
              </div>
              <Link
                to={`/order/status/${encodeURIComponent(lastStatusToken)}`}
                className="font-bold text-brand-green-950 hover:underline flex items-center gap-1"
              >
                Track Live Status
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <SectionHeading
        subtitle="Fresh Handcrafted Food & Drinks"
        title="Our Cafe Menu"
        align="center"
        className="mb-2"
      />

      {/* Controls: Search, Dietary Filters, and Stock Toggle */}
      <div className="bg-brand-cream-200 border border-brand-cream-300 rounded-card p-4 sm:p-5 space-y-4 shadow-soft">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, or tags (e.g. cold brew, burger)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-card-sm border border-brand-cream-300 bg-white text-body text-brand-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-gold-500 placeholder:text-brand-ink-400 text-small"
              aria-label="Search menu items"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-small font-medium text-brand-ink-800 shrink-0 px-2">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-brand-cream-300 text-brand-green-800 focus:ring-brand-gold-500 h-4 w-4 accent-brand-green-800"
            />
            <span>Show In-Stock Only</span>
          </label>
        </div>

        {/* Dietary Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-cream-300/60">
          <span className="text-caption font-semibold text-brand-ink-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            Dietary:
          </span>

          <button
            type="button"
            onClick={() => setDietaryFilter('all')}
            className={`px-3 py-1 rounded-pill text-caption font-semibold transition-colors ${
              dietaryFilter === 'all'
                ? 'bg-brand-green-950 text-brand-gold-400'
                : 'bg-white/80 text-brand-ink-700 hover:bg-white'
            }`}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setDietaryFilter('veg')}
            className={`px-3 py-1 rounded-pill text-caption font-semibold transition-colors flex items-center gap-1.5 ${
              dietaryFilter === 'veg'
                ? 'bg-brand-green-950 text-brand-gold-400'
                : 'bg-white/80 text-brand-ink-700 hover:bg-white'
            }`}
          >
            <FoodTypeIndicator type="veg" size="sm" />
            <span>Pure Veg</span>
          </button>

          <button
            type="button"
            onClick={() => setDietaryFilter('non_veg')}
            className={`px-3 py-1 rounded-pill text-caption font-semibold transition-colors flex items-center gap-1.5 ${
              dietaryFilter === 'non_veg'
                ? 'bg-brand-green-950 text-brand-gold-400'
                : 'bg-white/80 text-brand-ink-700 hover:bg-white'
            }`}
          >
            <FoodTypeIndicator type="non_veg" size="sm" />
            <span>Non-Veg</span>
          </button>

          <button
            type="button"
            onClick={() => setDietaryFilter('egg')}
            className={`px-3 py-1 rounded-pill text-caption font-semibold transition-colors flex items-center gap-1.5 ${
              dietaryFilter === 'egg'
                ? 'bg-brand-green-950 text-brand-gold-400'
                : 'bg-white/80 text-brand-ink-700 hover:bg-white'
            }`}
          >
            <FoodTypeIndicator type="egg" size="sm" />
            <span>Contains Egg</span>
          </button>
        </div>
      </div>

      {/* Sticky Category Pills Navigation */}
      {!isLoading && !isError && categories.length > 0 && (
        <div className="sticky top-20 z-30 bg-brand-cream-100/95 backdrop-blur py-3 border-y border-brand-cream-300">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategoryId('all')}
              className={`px-4 py-1.5 rounded-pill text-small font-semibold shrink-0 transition-all ${
                activeCategoryId === 'all'
                  ? 'bg-brand-green-800 text-brand-gold-500 shadow-soft'
                  : 'bg-brand-cream-200 text-brand-ink-700 hover:bg-brand-cream-300'
              }`}
            >
              All Categories
            </button>

            {categories.map((category) => {
              const isSelected = activeCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`px-4 py-1.5 rounded-pill text-small font-semibold shrink-0 transition-all ${
                    isSelected
                      ? 'bg-brand-green-800 text-brand-gold-500 shadow-soft'
                      : 'bg-brand-cream-200 text-brand-ink-700 hover:bg-brand-cream-300'
                  }`}
                >
                  {category.name}
                  <span className="ml-1.5 text-[11px] opacity-75">
                    ({category.items.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="rect" className="h-64 rounded-card" />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <EmptyState
          title="Menu Temporarily Unavailable"
          description="We are having difficulty reaching the live menu service. Please refresh or check back shortly."
          action={
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-brand-gold-500 text-brand-ink-900 font-semibold rounded-card-sm text-small hover:bg-brand-gold-600 transition-colors"
            >
              Retry Loading Menu
            </button>
          }
        />
      )}

      {/* Empty State when filters yield no results */}
      {!isLoading && !isError && totalDisplayedItems === 0 && (
        <EmptyState
          icon={<UtensilsCrossed className="h-10 w-10 text-brand-ink-400" />}
          title="No Dishes Found"
          description="No items match your active filters or search terms. Try clearing your search query or dietary filters."
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setDietaryFilter('all');
                setInStockOnly(false);
                setActiveCategoryId('all');
              }}
              className="px-4 py-2 bg-brand-green-800 text-brand-cream-100 font-semibold rounded-card-sm text-small hover:bg-brand-green-700 transition-colors"
            >
              Reset Filters
            </button>
          }
        />
      )}

      {/* Categorized Menu Sections */}
      {!isLoading && !isError && totalDisplayedItems > 0 && (
        <div className="space-y-12">
          {filteredCategories.map((category) => (
            <section key={category.id} id={`cat-${category.slug}`} className="space-y-6">
              <div className="border-b border-brand-cream-300 pb-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-2xl font-bold text-brand-green-950">
                    {category.name}
                  </h2>
                  <span className="text-caption text-brand-ink-500 font-medium">
                    {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {category.description && (
                  <p className="text-small text-brand-ink-600 mt-1">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.items.map((item) => {
                  const hasVariants = item.variants && item.variants.length > 0;
                  const defaultVariant =
                    item.variants?.find((v) => v.isDefault) || item.variants?.[0];
                  const currentVariantName = hasVariants
                    ? selectedVariants[item.id] || defaultVariant?.name
                    : undefined;
                  const selectedVariantObj = hasVariants
                    ? item.variants.find((v) => v.name === currentVariantName) || defaultVariant
                    : undefined;

                  const displayPrice = selectedVariantObj
                    ? selectedVariantObj.price
                    : item.basePrice;

                  const cartKey = `${item.id}${currentVariantName ? `:${currentVariantName}` : ''}`;
                  const cartEntry = cartItems.find((ci) => ci.key === cartKey);

                  return (
                    <Card
                      key={item.id}
                      variant="cream"
                      className={`flex flex-col justify-between transition-transform duration-fast hover:-translate-y-1 ${
                        !item.isAvailable
                          ? 'opacity-70 bg-brand-cream-200/50 border-brand-cream-300'
                          : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        {/* Food Photo if available */}
                        {item.image?.thumbnail && (
                          <div className="h-44 w-full rounded-card-sm overflow-hidden mb-3 bg-brand-cream-300">
                            <img
                              src={item.image.thumbnail}
                              alt={item.name}
                              width={400}
                              height={176}
                              className={`h-full w-full object-cover ${
                                !item.isAvailable ? 'grayscale' : ''
                              }`}
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FoodTypeIndicator type={item.foodType} size="sm" />
                              <CardTitle className="text-body font-semibold text-brand-green-950 font-serif">
                                {item.name}
                              </CardTitle>
                            </div>
                          </div>

                          {/* Price */}
                          <Badge variant="gold" size="md" className="font-mono shrink-0">
                            {formatPaiseToRupees(displayPrice)}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-0">
                        {item.description && (
                          <p className="text-small text-brand-ink-600 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Variants Selector */}
                        {hasVariants && (
                          <div className="space-y-1.5 pt-1 border-t border-brand-cream-300/60">
                            <span className="text-[11px] font-semibold text-brand-ink-500 uppercase tracking-wider block">
                              Options / Sizes:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.variants.map((v) => {
                                const isCurrent = (currentVariantName || defaultVariant?.name) === v.name;
                                return (
                                  <button
                                    key={v.name}
                                    type="button"
                                    onClick={() =>
                                      setSelectedVariants((prev) => ({
                                        ...prev,
                                        [item.id]: v.name,
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors ${
                                      isCurrent
                                        ? 'bg-brand-green-900 text-brand-gold-400 border-brand-green-900 shadow-xs'
                                        : 'bg-white text-brand-ink-700 border-brand-cream-300 hover:bg-brand-cream-100'
                                    }`}
                                  >
                                    {v.name} &bull; {formatPaiseToRupees(v.price)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Badges / Status */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          {!item.isAvailable ? (
                            <Badge variant="danger" size="sm" dot>
                              Temporarily Sold Out
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Available Now
                            </Badge>
                          )}

                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="cream" size="sm">
                              {tag.replace('_', ' ')}
                            </Badge>
                          ))}

                          {item.isFeatured && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-gold-600"
                              title="Chef Signature"
                            >
                              <Flame className="h-3 w-3" />
                              Featured
                            </span>
                          )}

                          {item.preparationMinutes && (
                            <span className="text-[11px] text-brand-ink-400 ml-auto flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {item.preparationMinutes} min
                            </span>
                          )}
                        </div>

                        {/* Self-Ordering Add Button / Stepper (>= 44px tap target) */}
                        {orderingEnabled && item.isAvailable && (
                          <div className="pt-3 border-t border-brand-cream-200">
                            {cartEntry ? (
                              <div className="flex items-center justify-between bg-brand-green-900 text-brand-cream-100 rounded-xl p-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(cartKey, -1)}
                                  aria-label={`Decrease ${item.name}`}
                                  className="h-11 w-11 rounded-lg bg-brand-green-800 text-brand-gold-400 flex items-center justify-center hover:bg-brand-green-700 active:scale-95 transition-transform"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="font-mono font-bold text-sm text-brand-gold-400 px-3">
                                  {cartEntry.qty} in order
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(cartKey, 1)}
                                  disabled={cartEntry.qty >= qrOrderingSettings.maxQtyPerLine}
                                  aria-label={`Increase ${item.name}`}
                                  className="h-11 w-11 rounded-lg bg-brand-gold-500 text-brand-ink-950 flex items-center justify-center hover:bg-brand-gold-400 disabled:opacity-40 active:scale-95 transition-transform"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => handleAddToCart(item)}
                                className="w-full min-h-[44px] bg-brand-green-900 hover:bg-brand-green-800 text-brand-gold-400 font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-transform"
                              >
                                <Plus className="h-4 w-4" />
                                Add to Order
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pricing & Freshness Disclaimer */}
      <div className="pt-8 border-t border-brand-cream-300 flex items-start gap-3 text-caption text-brand-ink-500">
        <Info className="h-4 w-4 shrink-0 text-brand-ink-400 mt-0.5" />
        <p>
          Prices are inclusive of applicable taxes unless specified. Items and availability are subject to daily kitchen freshness. Please inform your server of any food allergies or specific dietary preferences prior to ordering.
        </p>
      </div>

      {/* Floating Bottom Cart Bar when customer has items in cart */}
      {orderingEnabled && cartTotalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none">
          <div className="max-w-content mx-auto flex items-center justify-between p-3.5 sm:p-4 bg-brand-green-950 text-white rounded-2xl shadow-2xl border border-brand-gold-500/50 pointer-events-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-brand-gold-500 text-brand-ink-950 flex items-center justify-center font-bold">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif font-bold text-sm text-brand-gold-400">
                  {cartTotalQty} {cartTotalQty === 1 ? 'item' : 'items'} selected
                </div>
                <div className="font-mono text-xs text-brand-cream-200">
                  Est. Total: {formatPaiseToRupees(cartTotalPaise)}
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-ink-950 font-bold px-5 py-2.5 rounded-xl shadow-soft min-h-[44px] flex items-center gap-2"
            >
              Review &amp; Send
            </Button>
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Cart Drawer */}
      {tableNumber !== null && (
        <CustomerCartSheet
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          tableNumber={tableNumber}
          token={qrTokenParam}
          items={cartItems}
          onUpdateQty={handleUpdateQty}
          onUpdateNote={handleUpdateNote}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  );
};
