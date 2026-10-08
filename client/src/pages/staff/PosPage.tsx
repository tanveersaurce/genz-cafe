import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Minus,
  Trash2,
  Send,
  Receipt,
  ArrowLeft,
  Search,
  Clock,
  Printer,
  Share2,
  RefreshCw,
  ShoppingBag,
  Percent,
  CheckCircle,
  MoveRight,
  Smartphone,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { posService } from '../../services/posService';
import {
  PosTable,
  PosOrder,
  PosBill,
  PosPayment,
  PosOrderItem,
  OrderDetailResponse,
  MenuItem,
  MenuItemVariant,
} from '../../types/pos';
import { formatPrice } from '../../lib/formatPrice';
import { useAuth } from '../../lib/authContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FoodTypeIndicator } from '../../components/menu/FoodTypeIndicator';
import { ThermalReceipt } from '../../components/pos/ThermalReceipt';
import { KotSlip } from '../../components/pos/KotSlip';
import { CancelReasonModal } from '../../components/pos/CancelReasonModal';
import { ReadyToServeTray } from '../../components/pos/ReadyToServeTray';
import { CustomerOrdersTray } from '../../components/pos/CustomerOrdersTray';
import { settingsService } from '../../services/settingsService';
import { hasPermission } from '../../lib/permissions';
import { useRealtime } from '../../lib/realtimeContext';
import { useToast } from '../../components/ui/Toast';
import { apiClient } from '../../lib/apiClient';

interface DraftLine {
  id: string; // client local uuid
  menuItemId: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  gstRate: number;
  foodType: 'veg' | 'non_veg' | 'egg';
  qty: number;
  note: string;
}

export const PosPage: React.FC = () => {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const queryClient = useQueryClient();
  const { refetchIntervalFallback } = useRealtime();

  // Active view: 'tables' | 'order' | 'billing'
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showTakeawayModal, setShowTakeawayModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [cancellingLineId, setCancellingLineId] = useState<string | null>(null);

  // QR Ordering Settings & Kill Switch
  const [showQrPauseModal, setShowQrPauseModal] = useState(false);
  const [pauseMessageInput, setPauseMessageInput] = useState('');

  const { data: qrSetting } = useQuery({
    queryKey: ['qr-ordering-setting'],
    queryFn: () => settingsService.getQrOrderingStatus(),
    refetchInterval: 10000,
  });

  const updateQrSettingMutation = useMutation({
    mutationFn: (variables: { enabled: boolean; message?: string }) =>
      settingsService.updateQrOrderingStatus(variables.enabled, variables.message),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['qr-ordering-setting'] });
      showToast({
        title: data.enabled ? 'QR Ordering Resumed' : 'QR Ordering Paused',
        message: data.enabled
          ? 'Dine-in customers can now place orders from their phones.'
          : 'Customer table self-ordering is now paused.',
        type: data.enabled ? 'success' : 'info',
      });
      setShowQrPauseModal(false);
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not update QR ordering status.')
        : 'Could not update QR ordering status.';
      showToast({
        title: 'Update Failed',
        message: msg,
        type: 'error',
      });
    },
  });

  const canPauseQr = hasPermission(user?.permissions, 'qr:pause') || hasPermission(user?.permissions, 'settings:manage');
  const canResumeQr = hasPermission(user?.permissions, 'settings:manage');

  // New Takeaway Form state
  const [takeawayName, setTakeawayName] = useState('');
  const [takeawayPhone, setTakeawayPhone] = useState('');

  // Local draft lines (unsent items in memory before dispatching)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  // Search & category filter in order menu
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiet, setSelectedDiet] = useState<string>('all');

  // Variant selector modal
  const [activeItemForVariant, setActiveItemForVariant] = useState<MenuItem | null>(null);
  const [selectedVariantName, setSelectedVariantName] = useState<string>('');
  const [variantItemNote, setVariantItemNote] = useState('');

  // Discount form
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [discountReason, setDiscountReason] = useState<string>('');

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [cashTenderedRupees, setCashTenderedRupees] = useState<string>('');

  // Print slip state
  const [printBillData, setPrintBillData] = useState<PosBill | null>(null);
  const [printKotData, setPrintKotData] = useState<{
    order: PosOrder;
    kotNo: string;
    items: PosOrderItem[];
  } | null>(null);

  const printContainerRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef<boolean>(false);

  // Check role capabilities
  const canDiscount = user?.role === 'partner' || user?.role === 'manager';
  const canBill = user?.role === 'partner' || user?.role === 'manager' || user?.role === 'cashier';
  const canCancelSent = user?.role === 'partner' || user?.role === 'manager';

  // 1. Fetch live table map with realtime-aware polling (60s when connected, 10s fallback)
  const { data: tables = [], isLoading: isLoadingTables, refetch: refetchTables } = useQuery<PosTable[]>({
    queryKey: ['pos-tables'],
    queryFn: posService.getLiveTables,
    refetchInterval: refetchIntervalFallback,
  });

  // 2. Fetch full menu catalog for item picking
  const { data: menuData } = useQuery<{ categories: Array<{ id: string; name: string }>; items: MenuItem[] }>({
    queryKey: ['pos-menu-catalog'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { categories: Array<{ id: string; name: string }>; items: MenuItem[] } }>('/menu');
      return res.data;
    },
    staleTime: 60000,
  });

  // 3. Fetch active order details
  const {
    data: activeOrderData,
    refetch: refetchActiveOrder,
  } = useQuery<OrderDetailResponse>({
    queryKey: ['pos-active-order', activeOrderId],
    queryFn: () => posService.getOrderById(activeOrderId!),
    enabled: !!activeOrderId,
    refetchInterval: activeOrderId ? refetchIntervalFallback : false,
  });

  const activeOrder = activeOrderData?.order;

  // 4. Fetch bill details if order is billed
  const { data: activeBillData, refetch: refetchBill } = useQuery<{
    bill: PosBill;
    payments: PosPayment[];
    totalPaidPaise: number;
    balancePaise: number;
  }>({
    queryKey: ['pos-bill', activeOrder?.billId],
    queryFn: () => posService.getBillById(activeOrder!.billId!),
    enabled: !!activeOrder?.billId,
  });

  // Keep payment amount synced with remaining balance
  useEffect(() => {
    if (activeBillData) {
      setPaymentAmountRupees((activeBillData.balancePaise / 100).toString());
      setCashTenderedRupees((activeBillData.balancePaise / 100).toString());
    }
  }, [activeBillData]);

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: posService.createOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
      setActiveOrderId(data.order.id);
      setShowTakeawayModal(false);
      setDraftLines([]);
      showToast({ title: 'Order opened', message: `Order ${data.order.orderNo} initialized.`, type: 'success' });
    },
    onError: (err: Error & { response?: { data?: { error?: { details?: { existingOrderId?: string } } } } }) => {
      const details = err.response?.data?.error?.details;
      if (details?.existingOrderId) {
        setActiveOrderId(details.existingOrderId);
        showToast({ title: 'Existing Order', message: 'Table already has an open order. Loaded active ticket.', type: 'info' });
      } else {
        showToast({ title: 'Error opening order', message: err.message, type: 'error' });
      }
    },
  });

  const addItemsMutation = useMutation({
    mutationFn: (vars: {
      orderId: string;
      items: Array<{ menuItemId: string; variantName?: string; qty: number; note?: string }>;
      idempotencyKey: string;
    }) =>
      posService.addItems(vars.orderId, { items: vars.items, idempotencyKey: vars.idempotencyKey }),
    onSuccess: () => {
      setDraftLines([]);
      refetchActiveOrder();
      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
    },
    onError: (err: Error) => {
      showToast({ title: 'Failed adding items', message: err.message, type: 'error' });
    },
  });

  const sendKotMutation = useMutation({
    mutationFn: (orderId: string) => posService.sendKot(orderId),
    onSuccess: (data) => {
      refetchActiveOrder();
      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
      showToast({ title: 'KOT Dispatched', message: `${data.kot.kotNo} sent to kitchen.`, type: 'success' });

      // Automatically prepare printable KOT slip
      const sentItems = data.order.items.filter((i) => i.kotId === data.kot.kotId);
      setPrintKotData({
        order: data.order,
        kotNo: data.kot.kotNo,
        items: sentItems,
      });
    },
    onError: (err: Error) => {
      showToast({ title: 'KOT dispatch failed', message: err.message, type: 'error' });
    },
  });

  const generateBillMutation = useMutation({
    mutationFn: (orderId: string) => posService.generateBill(orderId),
    onSuccess: (data) => {
      refetchActiveOrder();
      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
      showToast({ title: 'Bill Generated', message: `Tax Invoice ${data.bill.invoiceNo} issued.`, type: 'success' });
      setPrintBillData(data.bill);
    },
    onError: (err: Error) => {
      showToast({ title: 'Bill generation failed', message: err.message, type: 'error' });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (vars: {
      billId: string;
      method: 'cash' | 'upi' | 'card' | 'other';
      amount: number;
      reference?: string;
      idempotencyKey?: string;
    }) =>
      posService.recordPayment(vars.billId, {
        method: vars.method,
        amount: vars.amount,
        reference: vars.reference,
        idempotencyKey: vars.idempotencyKey,
      }),
    onSuccess: (data) => {
      refetchBill();
      refetchActiveOrder();
      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
      if (data.isFullyPaid) {
        showToast({ title: 'Payment Complete', message: 'Bill is fully paid! Table is now free.', type: 'success' });
        setPrintBillData(data.bill);
      } else {
        showToast({ title: 'Payment Recorded', message: `Recorded partial payment of ${formatPrice(data.payment.amount)}.`, type: 'info' });
      }
    },
    onError: (err: Error) => {
      showToast({ title: 'Payment failed', message: err.message, type: 'error' });
    },
  });

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    if (!menuData?.items) return [];
    return menuData.items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedDiet !== 'all' && item.foodType !== selectedDiet) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [menuData, selectedCategory, selectedDiet, searchQuery]);

  // Handler: Tap table on map
  const handleTableClick = (table: PosTable) => {
    if (table.openOrder) {
      setActiveOrderId(table.openOrder.orderId);
    } else {
      // Free or Reserved Soon: Open order
      createOrderMutation.mutate({
        type: 'dine_in',
        tableId: table.tableId,
      });
    }
  };

  // Handler: Add item from catalog to draft
  const handleItemSelect = (item: MenuItem) => {
    if (!item.isAvailable) return;

    if (item.variants && item.variants.length > 0) {
      setActiveItemForVariant(item);
      const defaultVar = item.variants.find((v: MenuItemVariant) => v.isDefault) || item.variants[0];
      setSelectedVariantName(defaultVar?.name || '');
      setVariantItemNote('');
      return;
    }

    // Direct single-price item
    addDraftLine({
      id: crypto.randomUUID(),
      menuItemId: item.id || item._id || '',
      name: item.name,
      unitPrice: item.basePrice,
      gstRate: item.gstRate,
      foodType: item.foodType,
      qty: 1,
      note: '',
    });
  };

  const handleConfirmVariant = () => {
    if (!activeItemForVariant) return;
    const variant = activeItemForVariant.variants.find((v: MenuItemVariant) => v.name === selectedVariantName);
    const unitPrice = variant ? variant.price : activeItemForVariant.basePrice;

    addDraftLine({
      id: crypto.randomUUID(),
      menuItemId: activeItemForVariant.id || activeItemForVariant._id || '',
      name: activeItemForVariant.name,
      variantName: selectedVariantName,
      unitPrice,
      gstRate: activeItemForVariant.gstRate,
      foodType: activeItemForVariant.foodType,
      qty: 1,
      note: variantItemNote.trim(),
    });

    setActiveItemForVariant(null);
  };

  const addDraftLine = (newLine: DraftLine) => {
    setDraftLines((prev) => {
      const existingIdx = prev.findIndex(
        (p) => p.menuItemId === newLine.menuItemId && p.variantName === newLine.variantName && p.note === newLine.note
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const item = copy[existingIdx]!;
        copy[existingIdx] = { ...item, qty: item.qty + 1 };
        return copy;
      }
      return [...prev, newLine];
    });
  };

  const updateDraftQty = (id: string, delta: number) => {
    setDraftLines((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  // Dispatch Draft Items to Server and Send to Kitchen
  const handleSendToKitchen = async () => {
    if (!activeOrderId) return;
    if (isSendingRef.current || addItemsMutation.isPending || sendKotMutation.isPending) return;

    isSendingRef.current = true;
    try {
      if (draftLines.length > 0) {
        // Step 1: Append draft lines with client idempotency key
        const idempotencyKey = crypto.randomUUID();
        await addItemsMutation.mutateAsync({
          orderId: activeOrderId,
          items: draftLines.map((l) => ({
            menuItemId: l.menuItemId,
            variantName: l.variantName,
            qty: l.qty,
            note: l.note || undefined,
          })),
          idempotencyKey,
        });
      }

      // Step 2: Send KOT
      await sendKotMutation.mutateAsync(activeOrderId);
    } catch {
      // Handled in mutation onError
    } finally {
      isSendingRef.current = false;
    }
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp bill text summary
  const handleWhatsAppShare = () => {
    if (!activeBillData) return;
    const bill = activeBillData.bill;
    const text = encodeURIComponent(
      `*Gen-Z Cafe - Tax Invoice ${bill.invoiceNo}*\n` +
      `Order: ${bill.orderNo} | Table #${bill.tableNumber || 'Takeaway'}\n` +
      `Date: ${new Date(bill.generatedAt).toLocaleDateString('en-IN')}\n\n` +
      bill.items.map((i) => `• ${i.name} x${i.qty} = ₹${(i.grossAmount / 100).toFixed(2)}`).join('\n') +
      `\n\n*Total: ₹${(bill.totals.grandTotal / 100).toFixed(2)}*\n` +
      `Thank you for visiting Gen-Z Cafe! Good Food • Good Vibes.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Calculate cash change
  const cashChangeDue = useMemo(() => {
    const tendered = parseFloat(cashTenderedRupees) || 0;
    const required = parseFloat(paymentAmountRupees) || 0;
    return Math.max(0, Math.round((tendered - required) * 100));
  }, [cashTenderedRupees, paymentAmountRupees]);

  // Unsent draft warning before leaving
  const handleBackToTables = () => {
    if (draftLines.length > 0) {
      if (!window.confirm('You have unsent items in your draft. Leaving will discard unsent draft items. Proceed?')) {
        return;
      }
    }
    setActiveOrderId(null);
    setDraftLines([]);
    setPrintBillData(null);
    setPrintKotData(null);
  };

  // -------------------------------------------------------------
  // VIEW 1: TABLE MAP SCREEN
  // -------------------------------------------------------------
  if (!activeOrderId) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-display-sm text-brand-green-950 font-serif">POS Station & Table Map</h1>
            <p className="text-body-sm text-brand-ink-900/70">
              Real-time table status with running orders, instant seating, and billing desk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* QR Ordering Status Indicator & Control */}
            <div className="flex items-center gap-2 bg-brand-cream-100 px-3 py-1.5 rounded-lg border border-brand-cream-300">
              <span className="text-caption font-semibold text-brand-green-950">QR Orders:</span>
              <Badge
                variant={qrSetting?.enabled ? 'success' : 'warning'}
                size="sm"
                className="font-mono font-bold"
              >
                {qrSetting?.enabled ? 'LIVE' : 'PAUSED'}
              </Badge>
              {qrSetting?.enabled ? (
                canPauseQr && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPauseMessageInput(qrSetting?.pauseMessage || '');
                      setShowQrPauseModal(true);
                    }}
                    className="gap-1 text-amber-800 border-amber-300 hover:bg-amber-50 h-7 text-xs px-2"
                  >
                    <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                    Pause
                  </Button>
                )
              ) : (
                canResumeQr && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateQrSettingMutation.isPending}
                    onClick={() => updateQrSettingMutation.mutate({ enabled: true })}
                    className="gap-1 text-emerald-800 border-emerald-300 hover:bg-emerald-50 h-7 text-xs px-2"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Resume
                  </Button>
                )
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTables()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowTakeawayModal(true)}
              className="gap-2 min-h-[48px] px-5"
            >
              <ShoppingBag className="h-5 w-5" />
              New Takeaway Order
            </Button>
          </div>
        </div>

        {/* Customer Self-Orders Tray */}
        <CustomerOrdersTray />

        {/* Ready to Serve Pickup Tray */}
        <ReadyToServeTray />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 items-center bg-brand-cream-100 p-3 rounded-xl mb-6 text-caption border border-brand-cream-300">
          <span className="font-semibold text-brand-green-950">Table Status:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-cream-300 border border-brand-green-700/30" />
            <span>Free (Open)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-gold-500" />
            <span>Occupied (Dining)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-info" />
            <span>Billed (Awaiting Payment)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-purple-500" />
            <span>Reserved Soon (&lt;60m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 animate-pulse" />
            <span>Customer Order (New)</span>
          </div>
        </div>

        {/* Table Grid (15 Tables) */}
        {isLoadingTables ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-36 bg-brand-cream-100/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tables.map((table) => {
              const isOccupied = table.status === 'occupied';
              const isBilled = table.status === 'billed';
              const isReservedSoon = table.status === 'reserved_soon';

              let borderColor = 'border-brand-cream-300';
              let badgeVariant: 'cream' | 'gold' | 'info' | 'warning' = 'cream';
              let statusLabel = 'Free';

              if (isOccupied) {
                borderColor = 'border-brand-gold-500 bg-amber-50/50';
                badgeVariant = 'gold';
                statusLabel = 'Occupied';
              } else if (isBilled) {
                borderColor = 'border-brand-info bg-blue-50/50';
                badgeVariant = 'info';
                statusLabel = 'Billed';
              } else if (isReservedSoon) {
                borderColor = 'border-purple-400 bg-purple-50/50';
                badgeVariant = 'warning';
                statusLabel = `Reserved (${table.reservedSoon?.startTime})`;
              }

              return (
                <button
                  key={table.tableId}
                  onClick={() => handleTableClick(table)}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] min-h-[144px] flex flex-col justify-between ${borderColor} bg-white`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-title-md font-serif font-bold text-brand-green-950">
                        #{table.tableNumber}
                      </span>
                      <Badge variant={badgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-caption text-brand-ink-900/60 line-clamp-1">
                      {table.label || `${table.capacity} Seater`} • {table.zone}
                    </p>

                    {/* Waiter Ready to Serve Alert Badge */}
                    {table.readyCount !== undefined && table.readyCount > 0 && (
                      <div className="mt-2 flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-300 rounded px-2 py-0.5 text-[11px] font-bold animate-pulse">
                        <span>Ready to serve</span>
                        <span>
                          {table.readyCount}
                          {table.oldestReadyMinutes !== undefined && table.oldestReadyMinutes > 0
                            ? ` (${table.oldestReadyMinutes}m)`
                            : ''}
                        </span>
                      </div>
                    )}

                    {/* Customer Order Alert Badge */}
                    {table.hasUnacknowledgedCustomerSubmission && (
                      <div className="mt-2 flex items-center justify-between bg-amber-500 text-white rounded px-2 py-0.5 text-[11px] font-bold animate-pulse shadow-sm">
                        <span className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          Customer order
                        </span>
                        <span className="text-[10px] bg-white text-amber-950 px-1 rounded font-black">NEW</span>
                      </div>
                    )}
                  </div>

                  {/* Open order stats if active */}
                  {table.openOrder && (
                    <div className="mt-3 pt-2 border-t border-brand-cream-300 text-caption">
                      <div className="flex justify-between font-bold text-brand-green-900">
                        <span>{table.openOrder.orderNo}</span>
                        <span>{formatPrice(table.openOrder.runningTotalPaise)}</span>
                      </div>
                      <div className="flex justify-between text-brand-ink-900/60 text-[11px] mt-0.5">
                        <span>{table.openOrder.itemsCount} items</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {table.openOrder.ageMinutes}m
                        </span>
                      </div>
                    </div>
                  )}

                  {!table.openOrder && (
                    <div className="mt-2 text-caption font-semibold text-brand-green-800 flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      <span>Start Order</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Modal: Open Takeaway Order */}
        <Modal
          isOpen={showTakeawayModal}
          onClose={() => setShowTakeawayModal(false)}
          title="New Takeaway Order"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={takeawayName}
                onChange={(e) => setTakeawayName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={takeawayPhone}
                onChange={(e) => setTakeawayPhone(e.target.value)}
                placeholder="e.g. +91 98765 00000"
                className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowTakeawayModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={createOrderMutation.isPending}
                onClick={() =>
                  createOrderMutation.mutate({
                    type: 'takeaway',
                    customerName: takeawayName.trim() || undefined,
                    customerPhone: takeawayPhone.trim() || undefined,
                  })
                }
              >
                Create Takeaway Ticket
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2 & 3: ACTIVE ORDER & BILLING DESK
  // -------------------------------------------------------------
  const sentItems = activeOrder?.items.filter((i) => !!i.sentAt) || [];
  const activeUnsentItems = draftLines;
  const isOrderBilledOrPaid = activeOrder?.status === 'billed' || activeOrder?.status === 'paid';

  return (
    <div className="min-h-screen bg-brand-cream-100 flex flex-col font-sans">
      {/* Top POS Action Bar */}
      <header className="bg-brand-green-950 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToTables}
            className="text-white hover:bg-white/10 p-2 min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline ml-1 font-semibold">Table Map</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-title-sm font-serif font-bold text-brand-gold-500">
                {activeOrder?.orderNo || 'Loading...'}
              </span>
              <span className="text-caption text-white/80">
                {activeOrder?.type === 'dine_in' ? `Table #${activeOrder.tableNumber}` : 'Takeaway'}
              </span>
              <Badge variant={isOrderBilledOrPaid ? 'info' : 'gold'} size="sm">
                {activeOrder?.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeOrder?.type === 'dine_in' && activeOrder?.status === 'open' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransferModal(true)}
              className="text-white border-white/30 hover:bg-white/10 hidden sm:flex gap-1"
            >
              <MoveRight className="h-4 w-4" />
              Transfer Table
            </Button>
          )}

          {canDiscount && activeOrder?.status === 'open' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiscountModal(true)}
              className="text-white border-white/30 hover:bg-white/10 flex items-center gap-1"
            >
              <Percent className="h-4 w-4" />
              <span>Discount</span>
            </Button>
          )}

          {canCancelSent && activeOrder?.status === 'open' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowCancelOrderModal(true)}
              className="hidden sm:flex"
            >
              Cancel Order
            </Button>
          )}
        </div>
      </header>

      {/* Main Order Workspace (Split Screen on Tablet Landscape) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: Menu Picking Catalog */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          {/* Search & Dietary Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-ink-900/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food & beverages..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
              />
            </div>
            {/* Dietary pill selectors */}
            <div className="flex gap-1 bg-white p-1 rounded-lg border border-brand-cream-300">
              {(['all', 'veg', 'non_veg', 'egg'] as const).map((diet) => (
                <button
                  key={diet}
                  onClick={() => setSelectedDiet(diet)}
                  className={`px-3 py-1 rounded text-caption font-semibold capitalize transition-colors ${
                    selectedDiet === diet
                      ? 'bg-brand-green-900 text-white'
                      : 'text-brand-ink-900/70 hover:bg-brand-cream-100'
                  }`}
                >
                  {diet === 'non_veg' ? 'Non-Veg' : diet}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-caption font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-brand-gold-500 text-brand-ink-900 shadow-sm'
                  : 'bg-white border border-brand-cream-300 text-brand-ink-900/70 hover:bg-brand-cream-100'
              }`}
            >
              All Items
            </button>
            {menuData?.categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-caption font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-brand-gold-500 text-brand-ink-900 shadow-sm'
                    : 'bg-white border border-brand-cream-300 text-brand-ink-900/70 hover:bg-brand-cream-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Item Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredMenuItems.map((item) => {
              const isUnavailable = !item.isAvailable || !!item.archivedAt;

              return (
                <button
                  key={item.id}
                  disabled={isUnavailable || isOrderBilledOrPaid}
                  onClick={() => handleItemSelect(item)}
                  className={`text-left p-3 rounded-xl border bg-white flex flex-col justify-between transition-all min-h-[110px] ${
                    isUnavailable || isOrderBilledOrPaid
                      ? 'opacity-50 grayscale cursor-not-allowed border-gray-200'
                      : 'hover:border-brand-gold-500 hover:shadow-sm active:scale-[0.98] border-brand-cream-300'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-1">
                      <span className="font-semibold text-body-sm text-brand-green-950 line-clamp-2">
                        {item.name}
                      </span>
                      <FoodTypeIndicator type={item.foodType} size="sm" />
                    </div>
                    {item.variants && item.variants.length > 0 && (
                      <span className="text-[11px] text-brand-ink-900/60 block">
                        {item.variants.length} portions available
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex justify-between items-end">
                    <span className="font-bold text-body-sm text-brand-green-900">
                      {formatPrice(item.basePrice)}
                    </span>
                    {isUnavailable ? (
                      <span className="text-[10px] font-bold text-red-600">Out of Stock</span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-brand-gold-500/20 text-brand-green-950 flex items-center justify-center font-bold text-caption">
                        +
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Running Ticket, Kitchen Groups, & Billing */}
        <div className="w-full lg:w-[420px] bg-white border-l border-brand-cream-300 flex flex-col shadow-lg">
          {/* Order Header Summary */}
          <div className="p-4 border-b border-brand-cream-300 bg-brand-cream-100/50">
            <div className="flex justify-between items-center">
              <span className="font-serif font-bold text-title-sm text-brand-green-950">
                Running Bill & Ticket
              </span>
              <span className="text-caption font-semibold text-brand-ink-900/70">
                {sentItems.length + activeUnsentItems.length} lines total
              </span>
            </div>
          </div>

          {/* Cart Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* GROUP 1: Sent to Kitchen */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption font-bold tracking-wider uppercase text-brand-green-950 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-brand-success" />
                  Sent to Kitchen ({sentItems.length})
                </span>
                <span className="text-[11px] text-gray-500">KOT Dispatched</span>
              </div>

              {/* KOT Status Badges */}
              {activeOrder?.kots && activeOrder.kots.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {activeOrder.kots.map((kot) => {
                    let colorCls = 'bg-stone-100 text-stone-700 border-stone-300';
                    if (kot.status === 'new') colorCls = 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse';
                    else if (kot.status === 'preparing') colorCls = 'bg-amber-50 text-amber-800 border-amber-300';
                    else if (kot.status === 'ready') colorCls = 'bg-emerald-50 text-emerald-800 border-emerald-400 font-bold';
                    else if (kot.status === 'served') colorCls = 'bg-stone-100 text-stone-500 border-stone-200 line-through';
                    else if (kot.status === 'cancelled') colorCls = 'bg-red-50 text-red-700 border-red-200 line-through';

                    return (
                      <span
                        key={kot.kotId}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${colorCls}`}
                      >
                        {kot.kotNo}: {(kot.status || 'sent').toUpperCase()}
                      </span>
                    );
                  })}
                </div>
              )}

              {sentItems.length === 0 ? (
                <p className="text-caption text-brand-ink-900/40 italic py-2">
                  No items sent to the kitchen yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sentItems.map((item) => {
                    const isCancelled = item.status === 'cancelled';
                    return (
                      <div
                        key={item.lineId}
                        className={`p-2.5 rounded-lg border flex items-start justify-between text-body-sm ${
                          isCancelled
                            ? 'bg-red-50/60 border-red-200 text-gray-400 line-through'
                            : 'bg-brand-cream-100/40 border-brand-cream-300'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-brand-green-950">
                              {item.nameSnapshot} {item.variantName ? `(${item.variantName})` : ''}
                            </span>
                            {item.source === 'customer' && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
                                Customer
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-brand-ink-900/60 flex items-center gap-2 mt-0.5">
                            <span>Qty: {item.qty}</span>
                            <span>•</span>
                            <span>{formatPrice(item.unitPrice * item.qty)}</span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-amber-800 italic mt-0.5">Note: {item.note}</p>
                          )}
                          {isCancelled && item.cancelReason && (
                            <p className="text-[10px] text-red-600 not-italic font-medium mt-0.5">
                              Cancelled: {item.cancelReason}
                            </p>
                          )}
                        </div>

                        {!isCancelled && canCancelSent && activeOrder?.status === 'open' && (
                          <button
                            onClick={() => setCancellingLineId(item.lineId)}
                            className="text-red-500 hover:text-red-700 text-caption font-semibold p-1"
                            title="Cancel sent item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GROUP 2: New (Not Sent) Draft Items */}
            {!isOrderBilledOrPaid && (
              <div className="border-t border-brand-cream-300 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption font-bold tracking-wider uppercase text-amber-900 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                    New Draft Items ({activeUnsentItems.length})
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">Unsent to Kitchen</span>
                </div>

                {activeUnsentItems.length === 0 ? (
                  <p className="text-caption text-brand-ink-900/40 italic py-2">
                    Tap items from the left menu to add to draft.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeUnsentItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/50 flex items-center justify-between"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-semibold text-brand-green-950 text-body-sm">
                            {item.name} {item.variantName ? `(${item.variantName})` : ''}
                          </div>
                          <span className="text-caption text-brand-green-900 font-bold">
                            {formatPrice(item.unitPrice * item.qty)}
                          </span>
                          {item.note && (
                            <p className="text-[11px] text-gray-600 italic">Note: {item.note}</p>
                          )}
                        </div>

                        {/* Qty Steppers */}
                        <div className="flex items-center gap-1.5 bg-white border border-brand-cream-300 rounded-lg p-1">
                          <button
                            onClick={() => updateDraftQty(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-brand-cream-100 text-brand-ink-900"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center font-bold text-caption">{item.qty}</span>
                          <button
                            onClick={() => updateDraftQty(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-brand-cream-100 text-brand-ink-900"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Financial Totals & CTA */}
          <div className="p-4 border-t border-brand-cream-300 bg-brand-cream-100/30 space-y-3">
            {/* Live calculation totals */}
            {activeOrderData?.calculated && (
              <div className="space-y-1 text-caption">
                <div className="flex justify-between text-brand-ink-900/70">
                  <span>Subtotal:</span>
                  <span>{formatPrice(activeOrderData.calculated.subtotal)}</span>
                </div>
                {activeOrderData.calculated.discount > 0 && (
                  <div className="flex justify-between text-brand-success font-semibold">
                    <span>Discount:</span>
                    <span>-{formatPrice(activeOrderData.calculated.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-brand-ink-900/70">
                  <span>GST Tax (CGST + SGST):</span>
                  <span>{formatPrice(activeOrderData.calculated.totalTax)}</span>
                </div>
                <div className="flex justify-between text-title-sm font-bold text-brand-green-950 pt-1 border-t border-brand-cream-300">
                  <span>Grand Total:</span>
                  <span>{formatPrice(activeOrderData.calculated.grandTotal)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {/* Button: Send to Kitchen */}
              {activeUnsentItems.length > 0 && activeOrder?.status === 'open' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full gap-2 min-h-[48px]"
                  isLoading={sendKotMutation.isPending || addItemsMutation.isPending}
                  onClick={handleSendToKitchen}
                >
                  <Send className="h-4 w-4" />
                  <span>Send {activeUnsentItems.reduce((a, b) => a + b.qty, 0)} Items to Kitchen</span>
                </Button>
              )}

              {/* Button: Generate Bill (For Cashier/Partner/Manager) */}
              {canBill && activeOrder?.status === 'open' && sentItems.length > 0 && activeUnsentItems.length === 0 && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full gap-2 min-h-[48px] bg-brand-green-900 hover:bg-brand-green-800"
                  isLoading={generateBillMutation.isPending}
                  onClick={() => generateBillMutation.mutate(activeOrder.id)}
                >
                  <Receipt className="h-4 w-4" />
                  <span>Generate Tax Bill</span>
                </Button>
              )}

              {/* Billed Order: Show Payment & Receipt Actions */}
              {activeOrder?.status === 'billed' && activeBillData && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex justify-between font-bold text-body-sm text-blue-900">
                      <span>Invoice #{activeBillData.bill.invoiceNo}</span>
                      <span>Balance: {formatPrice(activeBillData.balancePaise)}</span>
                    </div>

                    {/* Payment tender quick options */}
                    {activeBillData.balancePaise > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['cash', 'upi', 'card'] as const).map((method) => (
                            <button
                              key={method}
                              onClick={() => setPaymentMethod(method)}
                              className={`py-1.5 rounded-lg text-caption font-bold uppercase transition-colors ${
                                paymentMethod === method
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-blue-200 text-blue-900'
                              }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>

                        {/* Cash tendered & change calculation */}
                        {paymentMethod === 'cash' && (
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-600 font-semibold">Tendered (₹)</label>
                              <input
                                type="number"
                                value={cashTenderedRupees}
                                onChange={(e) => setCashTenderedRupees(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-caption font-bold"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-600 font-semibold">Change Due</label>
                              <div className="px-2 py-1 bg-gray-100 rounded text-caption font-bold text-green-700">
                                {formatPrice(cashChangeDue)}
                              </div>
                            </div>
                          </div>
                        )}

                        {paymentMethod !== 'cash' && (
                          <div>
                            <label className="text-[10px] text-gray-600 font-semibold block mb-0.5">Txn Reference (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. UPI Ref / Auth Code"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-caption"
                            />
                          </div>
                        )}

                        <Button
                          variant="primary"
                          size="md"
                          className="w-full bg-blue-700 hover:bg-blue-800 min-h-[44px]"
                          isLoading={recordPaymentMutation.isPending}
                          onClick={() => {
                            const paise = Math.round(parseFloat(paymentAmountRupees) * 100);
                            recordPaymentMutation.mutate({
                              billId: activeBillData.bill.id,
                              method: paymentMethod,
                              amount: paise,
                              reference: paymentReference || undefined,
                              idempotencyKey: crypto.randomUUID(),
                            });
                          }}
                        >
                          Record Payment & Settle
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Paid Bill: Print & WhatsApp actions */}
              {activeOrder?.status === 'paid' && activeBillData && (
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1 gap-1.5 bg-brand-green-900"
                    onClick={() => {
                      setPrintBillData(activeBillData.bill);
                      setTimeout(handlePrint, 200);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Bill</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    className="gap-1.5"
                    onClick={handleWhatsAppShare}
                  >
                    <Share2 className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Variant and Note Selector */}
      {activeItemForVariant && (
        <Modal
          isOpen={true}
          onClose={() => setActiveItemForVariant(null)}
          title={`Select Portion: ${activeItemForVariant.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-brand-ink-900 mb-2">
                Available Portions:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activeItemForVariant.variants.map((v: MenuItemVariant) => (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVariantName(v.name)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedVariantName === v.name
                        ? 'border-brand-gold-500 bg-amber-50 shadow-sm'
                        : 'border-brand-cream-300 hover:bg-brand-cream-100'
                    }`}
                  >
                    <div className="font-bold text-body-sm text-brand-green-950">{v.name}</div>
                    <div className="text-caption text-brand-green-800 font-semibold">{formatPrice(v.price)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
                Preparation Note (Optional, max 100 chars):
              </label>
              <input
                type="text"
                value={variantItemNote}
                maxLength={100}
                onChange={(e) => setVariantItemNote(e.target.value)}
                placeholder="e.g. Less spicy, oat milk, no ice..."
                className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setActiveItemForVariant(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmVariant}>
                Add to Draft
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Cancel Sent Item Reason */}
      {cancellingLineId && (
        <CancelReasonModal
          isOpen={true}
          onClose={() => setCancellingLineId(null)}
          title="Cancel Sent Item"
          description="This item has already been dispatched to the kitchen. A valid managerial cancellation reason is required."
          confirmLabel="Cancel Item"
          onConfirm={async (reason) => {
            if (activeOrderId && cancellingLineId) {
              await posService.cancelItem(activeOrderId, cancellingLineId, reason);
              showToast({ title: 'Item cancelled', message: 'Item cancelled from ticket.', type: 'info' });
              refetchActiveOrder();
            }
          }}
        />
      )}

      {/* MODAL: Cancel Whole Order Reason */}
      {showCancelOrderModal && (
        <CancelReasonModal
          isOpen={true}
          onClose={() => setShowCancelOrderModal(false)}
          title="Cancel Order"
          description="Are you sure you want to cancel this entire order ticket? A valid reason is mandatory."
          confirmLabel="Cancel Order"
          onConfirm={async (reason) => {
            if (activeOrderId) {
              await posService.cancelOrder(activeOrderId, reason);
              showToast({ title: 'Order cancelled', message: 'Ticket cancelled successfully.', type: 'info' });
              setActiveOrderId(null);
              queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
            }
          }}
        />
      )}

      {/* MODAL: Apply Discount */}
      <Modal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="Apply Order Discount"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-2 bg-brand-cream-100 p-1 rounded-lg">
            <button
              onClick={() => setDiscountType('percent')}
              className={`flex-1 py-1.5 rounded text-caption font-bold ${
                discountType === 'percent' ? 'bg-white shadow text-brand-green-950' : 'text-gray-600'
              }`}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setDiscountType('flat')}
              className={`flex-1 py-1.5 rounded text-caption font-bold ${
                discountType === 'flat' ? 'bg-white shadow text-brand-green-950' : 'text-gray-600'
              }`}
            >
              Flat Amount (₹)
            </button>
          </div>

          <div>
            <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
              Discount Value {discountType === 'percent' ? '(%)' : '(₹)'}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-brand-ink-900 mb-1">
              Reason (Mandatory)
            </label>
            <input
              type="text"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="e.g. Partner promo, staff courtesy..."
              className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowDiscountModal(false)}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!activeOrderId || !discountReason.trim()) return;
                const val = parseFloat(discountValue) || 0;
                const paise = discountType === 'flat' ? Math.round(val * 100) : val;
                await posService.applyDiscount(activeOrderId, {
                  type: discountType,
                  value: paise,
                  reason: discountReason.trim(),
                });
                showToast({ title: 'Discount applied', message: 'Order discount updated.', type: 'success' });
                setShowDiscountModal(false);
                refetchActiveOrder();
              }}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Table Transfer */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Transfer Order to Another Table"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-body-sm text-brand-ink-900/70">
            Select an open table to transfer active order #{activeOrder?.tableNumber}:
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {tables
              .filter((t) => t.status === 'free')
              .map((freeTable) => (
                <button
                  key={freeTable.tableId}
                  onClick={async () => {
                    if (activeOrderId) {
                      await posService.transferTable(activeOrderId, freeTable.tableId);
                      showToast({
                        title: 'Table Transferred',
                        message: `Order moved to Table #${freeTable.tableNumber}.`,
                        type: 'success',
                      });
                      setShowTransferModal(false);
                      refetchActiveOrder();
                      queryClient.invalidateQueries({ queryKey: ['pos-tables'] });
                    }
                  }}
                  className="p-3 border border-brand-cream-300 rounded-xl hover:border-brand-gold-500 hover:bg-amber-50 text-center font-bold text-brand-green-950"
                >
                  Table #{freeTable.tableNumber}
                </button>
              ))}
          </div>
        </div>
      </Modal>

      {/* PAUSE QR ORDERING MODAL */}
      <Modal
        isOpen={showQrPauseModal}
        onClose={() => setShowQrPauseModal(false)}
        title="Pause Table QR Self-Ordering"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-brand-ink-900/80">
            Temporarily pause customer phone self-ordering during kitchen rushes or operational holds. Customers scanning table QR codes will see an informative pause notice and can still browse the live menu.
          </p>
          <div>
            <label className="block text-caption font-semibold text-brand-green-950 mb-1">
              Customer Notice Message (Optional)
            </label>
            <input
              type="text"
              value={pauseMessageInput}
              onChange={(e) => setPauseMessageInput(e.target.value)}
              placeholder="Online table ordering is temporarily paused. Please order with our staff."
              className="w-full px-3 py-2 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowQrPauseModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={updateQrSettingMutation.isPending}
              onClick={() =>
                updateQrSettingMutation.mutate({
                  enabled: false,
                  message: pauseMessageInput || undefined,
                })
              }
            >
              Confirm Pause
            </Button>
          </div>
        </div>
      </Modal>

      {/* HIDDEN PRINT CONTAINERS FOR 80mm THERMAL PRINTING */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]" ref={printContainerRef}>
        {printBillData && (
          <ThermalReceipt bill={printBillData} payments={activeBillData?.payments || []} />
        )}
        {printKotData && (
          <KotSlip
            order={printKotData.order}
            kotNo={printKotData.kotNo}
            items={printKotData.items}
          />
        )}
      </div>
    </div>
  );
};
