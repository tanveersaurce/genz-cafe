import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  RefreshCw,
  Receipt,
  FileText,
} from 'lucide-react';
import { posService } from '../../services/posService';
import { PosOrder, PosBill, PosOrderItem } from '../../types/pos';
import { formatPrice } from '../../lib/formatPrice';
import { useAuth } from '../../lib/authContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CancelReasonModal } from '../../components/pos/CancelReasonModal';
import { ThermalReceipt } from '../../components/pos/ThermalReceipt';
import { KotSlip } from '../../components/pos/KotSlip';
import { FoodTypeIndicator } from '../../components/menu/FoodTypeIndicator';
import { useToast } from '../../components/ui/Toast';

export const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split('T')[0]!;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Detail Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Void Bill Modal
  const [voidingBillId, setVoidingBillId] = useState<string | null>(null);

  // Reprint data state
  const [reprintBill, setReprintBill] = useState<PosBill | null>(null);
  const [reprintKot, setReprintKot] = useState<{
    order: PosOrder;
    kotNo: string;
    items: PosOrderItem[];
  } | null>(null);

  const canVoid = user?.role === 'partner' || user?.role === 'manager';

  // 1. Fetch Orders List
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['orders-history', selectedDate, selectedStatus, selectedType, searchQuery, page],
    queryFn: () =>
      posService.getOrders({
        date: selectedDate,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
        page,
        limit: 15,
      }),
  });

  // 2. Fetch Selected Order Detail
  const { data: orderDetailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['order-detail', selectedOrderId],
    queryFn: () => posService.getOrderById(selectedOrderId!),
    enabled: !!selectedOrderId,
  });

  // 3. Fetch Bill Detail if Selected Order has a Bill
  const { data: billDetailData } = useQuery({
    queryKey: ['bill-detail', orderDetailData?.order.billId],
    queryFn: () => posService.getBillById(orderDetailData!.order.billId!),
    enabled: !!orderDetailData?.order.billId,
  });

  // Void Bill Mutation
  const voidBillMutation = useMutation({
    mutationFn: (vars: { billId: string; reason: string }) =>
      posService.voidBill(vars.billId, vars.reason),
    onSuccess: () => {
      showToast({ title: 'Bill Voided', message: 'The bill was successfully voided.', type: 'info' });
      queryClient.invalidateQueries({ queryKey: ['orders-history'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      setVoidingBillId(null);
    },
    onError: (err: Error) => {
      showToast({ title: 'Void failed', message: err.message, type: 'error' });
    },
  });

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination || { total: 0, page: 1, pages: 1 };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-display-sm text-brand-green-950 font-serif">Order History</h1>
          <p className="text-body-sm text-brand-ink-900/70">
            View orders, reprint KOTs and tax invoices, and void bills with managerial reason.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-brand-cream-300 mb-6 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-ink-900/50" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-brand-cream-300 rounded-lg text-body-sm bg-brand-cream-100/50 focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-ink-900/50" />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-brand-cream-300 rounded-lg text-body-sm bg-brand-cream-100/50 focus:outline-none focus:ring-2 focus:ring-brand-gold-500 capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="billed">Billed</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-brand-cream-300 rounded-lg text-body-sm bg-brand-cream-100/50 focus:outline-none focus:ring-2 focus:ring-brand-gold-500 capitalize"
          >
            <option value="all">All Types</option>
            <option value="dine_in">Dine-in</option>
            <option value="takeaway">Takeaway</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-ink-900/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search order number or table..."
            className="w-full pl-9 pr-3 py-1.5 border border-brand-cream-300 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-brand-cream-300 shadow-sm overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-8 text-center text-brand-ink-900/50">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-brand-cream-300 mx-auto mb-2" />
            <p className="font-semibold text-brand-green-950">No orders found</p>
            <p className="text-caption text-brand-ink-900/60 mt-1">
              Try selecting another date or removing filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-brand-cream-100/60 border-b border-brand-cream-300 text-caption font-bold text-brand-green-950 uppercase">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Time (IST)</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-300/40">
                {orders.map((order) => {
                  let badgeVariant: 'cream' | 'gold' | 'info' | 'danger' = 'cream';
                  if (order.status === 'open') badgeVariant = 'gold';
                  if (order.status === 'billed') badgeVariant = 'info';
                  if (order.status === 'paid') badgeVariant = 'cream';
                  if (order.status === 'cancelled') badgeVariant = 'danger';

                  const timeStr = new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={order._id} className="hover:bg-brand-cream-100/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-brand-green-950">{order.orderNo}</td>
                      <td className="py-3 px-4">
                        {order.type === 'dine_in' ? (
                          <span className="font-semibold text-brand-green-900">
                            Table #{order.tableNumber}
                          </span>
                        ) : (
                          <span className="text-amber-800">
                            Takeaway {order.customerName ? `(${order.customerName})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-brand-ink-900/70">{timeStr}</td>
                      <td className="py-3 px-4">
                        {order.items.filter((i) => i.status === 'active').length} active lines
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={badgeVariant} size="sm">
                          {order.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrderId(order.id || order._id)}
                          className="gap-1 text-brand-green-900"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Ticket</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center text-caption text-brand-ink-900/70">
          <span>
            Showing page {pagination.page} of {pagination.pages} ({pagination.total} orders)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* MODAL: Read-Only Order Ticket Detail */}
      {selectedOrderId && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrderId(null)}
          title={`Order Ticket: ${orderDetailData?.order.orderNo || 'Loading...'}`}
          maxWidth="lg"
        >
          {isLoadingDetail || !orderDetailData ? (
            <div className="p-8 text-center text-gray-500">Loading ticket details...</div>
          ) : (
            <div className="space-y-6">
              {/* Order Meta Bar */}
              <div className="bg-brand-cream-100 p-3 rounded-xl flex flex-wrap justify-between items-center text-caption gap-2">
                <div>
                  <span className="font-semibold text-brand-green-950">Type: </span>
                  <span>{orderDetailData.order.type === 'dine_in' ? `Table #${orderDetailData.order.tableNumber}` : 'Takeaway'}</span>
                </div>
                <div>
                  <span className="font-semibold text-brand-green-950">Opened by: </span>
                  <span>{orderDetailData.order.openedBy?.name || 'Staff'}</span>
                </div>
                <div>
                  <Badge variant={orderDetailData.order.status === 'paid' ? 'cream' : 'gold'} size="sm">
                    {orderDetailData.order.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-body-sm text-brand-green-950 mb-2 uppercase tracking-wide">
                  Line Items
                </h4>
                <div className="border border-brand-cream-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-body-sm">
                    <thead className="bg-brand-cream-100/50 text-[11px] font-bold text-brand-green-950 uppercase border-b border-brand-cream-300">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-cream-300/40">
                      {orderDetailData.order.items.map((item) => (
                        <tr
                          key={item.lineId}
                          className={item.status === 'cancelled' ? 'bg-red-50/50 text-gray-400 line-through' : ''}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 font-medium text-brand-green-950">
                              <FoodTypeIndicator type={item.foodTypeSnapshot} size="sm" />
                              <span>{item.nameSnapshot}</span>
                              {item.variantName && <span className="text-caption text-gray-600">({item.variantName})</span>}
                            </div>
                            {item.note && <p className="text-[11px] text-amber-800 italic ml-4">Note: {item.note}</p>}
                            {item.cancelReason && <p className="text-[10px] text-red-600 not-italic ml-4">Reason: {item.cancelReason}</p>}
                          </td>
                          <td className="py-2 px-3 text-center font-bold">{item.qty}</td>
                          <td className="py-2 px-3 text-right">{formatPrice(item.unitPrice)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatPrice(item.unitPrice * item.qty)}</td>
                          <td className="py-2 px-3">
                            <Badge variant={item.status === 'active' ? 'cream' : 'danger'} size="sm">
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-brand-cream-100/40 p-3 rounded-xl space-y-1.5 text-body-sm">
                <div className="flex justify-between text-brand-ink-900/70">
                  <span>Subtotal:</span>
                  <span>{formatPrice(orderDetailData.calculated.subtotal)}</span>
                </div>
                {orderDetailData.calculated.discount > 0 && (
                  <div className="flex justify-between text-brand-success font-semibold">
                    <span>Discount:</span>
                    <span>-{formatPrice(orderDetailData.calculated.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-brand-ink-900/70">
                  <span>GST Tax Breakdown:</span>
                  <span>{formatPrice(orderDetailData.calculated.totalTax)}</span>
                </div>
                <div className="flex justify-between text-title-sm font-bold text-brand-green-950 pt-1 border-t border-brand-cream-300">
                  <span>Grand Total:</span>
                  <span>{formatPrice(orderDetailData.calculated.grandTotal)}</span>
                </div>
              </div>

              {/* Actions & Reprints */}
              <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-brand-cream-300">
                <div className="flex gap-2">
                  {/* Reprint KOT */}
                  {orderDetailData.order.kots.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lastKot = orderDetailData.order.kots[orderDetailData.order.kots.length - 1]!;
                        const kotItems = orderDetailData.order.items.filter((i) => i.kotId === lastKot.kotId);
                        setReprintKot({
                          order: orderDetailData.order,
                          kotNo: lastKot.kotNo,
                          items: kotItems,
                        });
                        setTimeout(() => window.print(), 200);
                      }}
                      className="gap-1.5"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Reprint KOT</span>
                    </Button>
                  )}

                  {/* Reprint Bill */}
                  {billDetailData && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setReprintBill(billDetailData.bill);
                        setTimeout(() => window.print(), 200);
                      }}
                      className="gap-1.5 bg-brand-green-900"
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Reprint Tax Bill</span>
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* Void Bill (Partner/Manager only) */}
                  {canVoid && billDetailData && billDetailData.bill.status === 'issued' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setVoidingBillId(billDetailData.bill.id)}
                    >
                      Void Bill
                    </Button>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: Void Bill Reason */}
      {voidingBillId && (
        <CancelReasonModal
          isOpen={true}
          onClose={() => setVoidingBillId(null)}
          title="Void Tax Invoice"
          description="Voiding an issued invoice is an audited accounting action. The invoice number remains preserved. A valid reason is mandatory."
          confirmLabel="Void Invoice"
          onConfirm={async (reason) => {
            if (voidingBillId) {
              await voidBillMutation.mutateAsync({ billId: voidingBillId, reason });
            }
          }}
        />
      )}

      {/* HIDDEN PRINT CONTAINERS */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
        {reprintBill && (
          <ThermalReceipt bill={reprintBill} payments={billDetailData?.payments || []} />
        )}
        {reprintKot && (
          <KotSlip
            order={reprintKot.order}
            kotNo={reprintKot.kotNo}
            items={reprintKot.items}
          />
        )}
      </div>
    </div>
  );
};
