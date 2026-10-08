import React, { useState } from 'react';
import { ShoppingBag, X, Plus, Minus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPaiseToRupees } from '@/lib/formatPrice';
import { publicQrService } from '@/services/publicQrService';
import { qrOrderingSettings } from '@/config/qrOrderingSettings';
import { ApiClientError } from '@/lib/apiClient';

export interface CartItem {
  key: string; // unique key: menuItemId + (variantName ? `:${variantName}` : '')
  menuItemId: string;
  name: string;
  variantName?: string;
  price: number; // in paise
  gstRate: number;
  qty: number;
  note?: string;
}

interface CustomerCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number;
  token: string;
  items: CartItem[];
  onUpdateQty: (key: string, delta: number) => void;
  onUpdateNote: (key: string, note: string) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
  onOrderSuccess: (statusToken: string) => void;
}

export const CustomerCartSheet: React.FC<CustomerCartSheetProps> = ({
  isOpen,
  onClose,
  tableNumber,
  token,
  items,
  onUpdateQty,
  onUpdateNote,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPaise = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);

  const isNameValid =
    customerName.trim().length >= qrOrderingSettings.nameMinChars &&
    customerName.trim().length <= qrOrderingSettings.nameMaxChars;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNameValid || items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const res = await publicQrService.submitOrder({
        table: tableNumber,
        token,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        lines: items.map((i) => ({
          menuItemId: i.menuItemId,
          variantName: i.variantName,
          qty: i.qty,
          note: i.note?.trim() || undefined,
        })),
        idempotencyKey,
        honeypot: honeypot.trim() || undefined,
      });

      onClearCart();
      onOrderSuccess(res.statusToken);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to place order. Please ask a server for assistance.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div
        className="bg-brand-surface-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-brand-cream-300 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-cream-200 flex items-center justify-between bg-brand-cream-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-brand-green-900 text-brand-gold-400 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 id="cart-drawer-title" className="font-serif font-bold text-lg text-brand-green-950">
                Table {tableNumber} Order
              </h2>
              <p className="text-xs text-brand-ink-500">
                {totalCount} {totalCount === 1 ? 'item' : 'items'} in your order
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Cart"
            className="h-10 w-10 flex items-center justify-center rounded-full text-brand-ink-500 hover:text-brand-ink-900 hover:bg-brand-cream-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Items & Customer Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShoppingBag className="h-12 w-12 text-brand-ink-300 mx-auto" />
              <p className="text-sm font-medium text-brand-ink-700">Your cart is empty.</p>
              <p className="text-xs text-brand-ink-400">
                Browse our menu and tap &quot;Add&quot; on dishes you&apos;d like to enjoy.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-brand-ink-600 uppercase tracking-wider">
                Selected Dishes
              </div>
              {items.map((item) => (
                <div
                  key={item.key}
                  className="p-3 bg-white rounded-xl border border-brand-cream-200 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif font-bold text-sm text-brand-green-950 truncate">
                        {item.name}
                      </h4>
                      {item.variantName && (
                        <span className="inline-block text-[11px] font-mono text-brand-gold-700 bg-brand-gold-50 px-1.5 py-0.5 rounded">
                          {item.variantName}
                        </span>
                      )}
                      <div className="text-xs font-mono font-medium text-brand-ink-600 mt-0.5">
                        {formatPaiseToRupees(item.price)} each
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-brand-cream-100 rounded-full p-1 border border-brand-cream-300">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.key, -1)}
                        aria-label="Decrease quantity"
                        className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full bg-white flex items-center justify-center text-brand-ink-700 hover:bg-brand-cream-200 active:scale-95 transition-transform"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono font-bold text-xs w-6 text-center text-brand-green-950">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.key, 1)}
                        disabled={item.qty >= qrOrderingSettings.maxQtyPerLine}
                        aria-label="Increase quantity"
                        className="h-8 w-8 min-h-[32px] min-w-[32px] rounded-full bg-brand-green-900 text-brand-gold-400 flex items-center justify-center hover:bg-brand-green-800 disabled:opacity-40 active:scale-95 transition-transform"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.key)}
                      aria-label="Remove item"
                      className="h-8 w-8 flex items-center justify-center text-brand-ink-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Special Note Input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Special note (e.g. less ice, extra crispy)..."
                      value={item.note || ''}
                      onChange={(e) => onUpdateNote(item.key, e.target.value)}
                      maxLength={100}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-brand-cream-300 bg-brand-cream-50/50 text-brand-ink-800 placeholder:text-brand-ink-400 focus:outline-none focus:ring-1 focus:ring-brand-gold-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <form onSubmit={handleSubmitOrder} className="space-y-4 pt-2 border-t border-brand-cream-200">
              <div className="text-xs font-semibold text-brand-ink-600 uppercase tracking-wider">
                Guest Information
              </div>

              {/* Customer Name */}
              <div>
                <label htmlFor="customer-name-input" className="block text-xs font-semibold text-brand-green-950 mb-1">
                  Your Name *
                </label>
                <input
                  id="customer-name-input"
                  type="text"
                  required
                  minLength={qrOrderingSettings.nameMinChars}
                  maxLength={qrOrderingSettings.nameMaxChars}
                  placeholder="e.g. Alex"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-brand-cream-300 bg-white text-brand-ink-900 placeholder:text-brand-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
                />
                <span className="text-[11px] text-brand-ink-400 mt-1 block">
                  So our staff knows who to deliver the food to ({qrOrderingSettings.nameMinChars}-
                  {qrOrderingSettings.nameMaxChars} characters).
                </span>
              </div>

              {/* Customer Phone (Optional) */}
              <div>
                <label htmlFor="customer-phone-input" className="block text-xs font-semibold text-brand-green-950 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  id="customer-phone-input"
                  type="tel"
                  placeholder="e.g. 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={15}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-brand-cream-300 bg-white text-brand-ink-900 placeholder:text-brand-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-gold-500"
                />
                <span className="text-[11px] text-brand-ink-400 mt-1 block">
                  Optional. Stored securely for {qrOrderingSettings.customerPhoneRetentionDays} days for order updates, then automatically purged.
                </span>
              </div>

              {/* Silent Honeypot */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <label htmlFor="special-promo-code">Leave this blank</label>
                <input
                  id="special-promo-code"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Pricing Notice */}
              <div className="bg-brand-cream-100 p-3 rounded-xl border border-brand-cream-200 text-xs text-brand-ink-600 flex items-start gap-2">
                <Clock className="h-4 w-4 text-brand-gold-600 shrink-0 mt-0.5" />
                <span>
                  Orders are sent directly to the kitchen. You can cancel within {qrOrderingSettings.undoWindowSeconds} seconds before kitchen prep begins.
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Footer with Totals and Submit */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-brand-cream-200 bg-white space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-brand-ink-600">Estimated Total:</span>
              <span className="font-mono font-bold text-lg text-brand-green-950">
                {formatPaiseToRupees(totalPaise)}
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSubmitOrder}
              disabled={!isNameValid || items.length === 0 || isSubmitting}
              className="w-full py-3.5 bg-brand-green-900 hover:bg-brand-green-800 text-brand-gold-400 font-bold rounded-xl text-sm min-h-[48px] shadow-soft active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-brand-gold-400 border-t-transparent rounded-full" />
                  Sending to Kitchen...
                </>
              ) : (
                `Send to Kitchen (${formatPaiseToRupees(totalPaise)})`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
