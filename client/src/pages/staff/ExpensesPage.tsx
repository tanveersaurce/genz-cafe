import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  Receipt,
  CheckCircle,
  Clock,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { formatPrice, rupeesToPaise } from '@/lib/formatPrice';
import {
  expenseService,
  Expense,
  ExpenseCategory,
  Vendor,
  RecurringExpenseTemplate,
} from '@/services/expenseService';
import { partnerService, Partner } from '@/services/partnerService';

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [templates, setTemplates] = useState<RecurringExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSummary, setTotalSummary] = useState({ totalAmount: 0, totalPaid: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [selectedExpenseForVoid, setSelectedExpenseForVoid] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState<Expense | null>(null);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);

  // Create Form State
  const [createDate, setCreateDate] = useState(() => new Date().toISOString().split('T')[0] || '');
  const [createCategory, setCreateCategory] = useState('');
  const [createVendor, setCreateVendor] = useState('');
  const [createAmountRupees, setCreateAmountRupees] = useState('');
  const [createIsPaid, setCreateIsPaid] = useState(true);
  const [createMethod, setCreateMethod] = useState('cash_drawer');
  const [createPartnerId, setCreatePartnerId] = useState('');
  const [createRef, setCreateRef] = useState('');
  const [createInvoice, setCreateInvoice] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Payment Form State
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payMethod, setPayMethod] = useState('cash_drawer');
  const [payPartnerId, setPayPartnerId] = useState('');
  const [payRef, setPayRef] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [expData, catData, venData, partData, tempRes] = await Promise.all([
        expenseService.listExpenses({
          from: fromFilter || undefined,
          to: toFilter || undefined,
          categoryId: categoryFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        expenseService.getCategories(),
        expenseService.getVendors(),
        partnerService.listPartners().catch(() => []),
        expenseService.listRecurringTemplates().catch(() => []),
      ]);

      setExpenses(expData.items);
      setTotalSummary(expData.summary);
      setCategories(catData);
      setVendors(venData);
      setPartners(partData);
      setTemplates(tempRes);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, statusFilter, fromFilter, toFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const amountPaise = rupeesToPaise(createAmountRupees);
      if (amountPaise <= 0) {
        setActionError('Please enter a valid amount');
        return;
      }

      await expenseService.createExpense({
        expenseDate: createDate,
        categoryId: createCategory,
        vendorId: createVendor || undefined,
        amount: amountPaise,
        isPaid: createIsPaid,
        paymentMethod: createIsPaid ? createMethod : undefined,
        paidByPartnerId: createMethod === 'owner_paid' ? createPartnerId : undefined,
        reference: createRef || undefined,
        invoiceNumber: createInvoice || undefined,
        notes: createNotes || undefined,
      });

      setIsCreateOpen(false);
      resetCreateForm();
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to record expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForVoid) return;
    setActionError(null);
    try {
      setActionLoading(true);
      await expenseService.voidExpense(selectedExpenseForVoid._id, voidReason);
      setIsVoidOpen(false);
      setSelectedExpenseForVoid(null);
      setVoidReason('');
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to void expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForPay) return;
    setActionError(null);
    try {
      setActionLoading(true);
      const amountPaise = rupeesToPaise(payAmountRupees);
      await expenseService.addPayment(selectedExpenseForPay._id, {
        amount: amountPaise,
        method: payMethod,
        paidByPartnerId: payMethod === 'owner_paid' ? payPartnerId : undefined,
        reference: payRef || undefined,
      });
      setIsPaymentOpen(false);
      setSelectedExpenseForPay(null);
      setPayAmountRupees('');
      setPayRef('');
      loadData();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateRecurring = async () => {
    try {
      const curMonth = new Date().toISOString().substring(0, 7);
      const res = await expenseService.generateRecurring(curMonth);
      alert(`Generated ${res.count} recurring expenses for ${curMonth}`);
      loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to generate recurring expenses');
    }
  };

  const resetCreateForm = () => {
    setCreateCategory('');
    setCreateVendor('');
    setCreateAmountRupees('');
    setCreateIsPaid(true);
    setCreateMethod('cash_drawer');
    setCreatePartnerId('');
    setCreateRef('');
    setCreateInvoice('');
    setCreateNotes('');
  };

  const canCreate = hasPermission(user?.permissions, 'expenses:create');
  const canVoid = hasPermission(user?.permissions, 'expenses:void');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-forest">Expense Management</h1>
          <p className="text-sm text-cafe-text-muted mt-1">
            Track vendor purchases, operating costs, partner out-of-pocket expenses, and recurring bills.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRecurringOpen(true)}
              className="border-cafe-forest/20 text-cafe-forest"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              Recurring Templates ({templates.length})
            </Button>
          )}
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError(null);
                setIsCreateOpen(true);
              }}
              className="bg-cafe-gold hover:bg-cafe-gold/90 text-cafe-forest font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Record Expense
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-cafe-text-muted">
              Total Expenses
            </span>
            <Receipt className="w-4 h-4 text-cafe-forest" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-cafe-forest">
            {formatPrice(totalSummary.totalAmount)}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">Active recorded expenses</span>
        </div>

        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600">
              Total Settled
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-emerald-700">
            {formatPrice(totalSummary.totalPaid)}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">Paid via drawer / accounts</span>
        </div>

        <div className="bg-white rounded-xl border border-cafe-forest/10 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-600">
              Outstanding Payable
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-amber-700">
            {formatPrice(Math.max(0, totalSummary.totalAmount - totalSummary.totalPaid))}
          </div>
          <span className="text-xs text-cafe-text-muted mt-1 block">Unpaid supplier credit</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-cafe-forest/10 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cafe-text-muted" />
          <input
            type="text"
            placeholder="Search by expense #, vendor, invoice, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-cafe-cream/30 border border-cafe-forest/15 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-cafe-forest"
          />
        </form>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="text-sm bg-cafe-cream/30 border border-cafe-forest/15 rounded-lg px-3 py-1.5 focus:outline-hidden"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="text-sm bg-cafe-cream/30 border border-cafe-forest/15 rounded-lg px-3 py-1.5 focus:outline-hidden"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="voided">Voided</option>
        </select>

        <div className="flex items-center gap-1.5 text-xs text-cafe-text-muted">
          <span>From</span>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            aria-label="Filter from date"
            className="text-xs bg-cafe-cream/30 border border-cafe-forest/15 rounded-md px-2 py-1"
          />
          <span>To</span>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            aria-label="Filter to date"
            className="text-xs bg-cafe-cream/30 border border-cafe-forest/15 rounded-md px-2 py-1"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-cafe-forest/10 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Spinner className="mx-auto" />
            <p className="text-xs text-cafe-text-muted mt-2">Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-cafe-text-muted">
            <Receipt className="w-10 h-10 mx-auto text-cafe-forest/30 mb-2" />
            <p className="text-base font-serif font-bold text-cafe-forest">No expenses found</p>
            <p className="text-xs mt-1">Try clearing filters or record a new expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cafe-cream/50 border-b border-cafe-forest/10 text-xs font-semibold text-cafe-forest uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date / No</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vendor / Notes</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-forest/5">
                {expenses.map((exp) => (
                  <tr
                    key={exp._id}
                    className={`hover:bg-cafe-cream/20 transition-colors ${
                      exp.status === 'voided' ? 'opacity-50 line-through bg-gray-50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-cafe-forest">{exp.expenseNo}</div>
                      <div className="text-xs text-cafe-text-muted flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {exp.expenseDate}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-cafe-text-dark">{exp.categoryId?.name}</div>
                      <Badge variant="cream" className="text-[10px] mt-0.5 uppercase tracking-wider">
                        {exp.categoryId?.type?.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-cafe-text-dark font-medium">
                        {exp.vendorName || exp.vendorId?.name || '—'}
                      </div>
                      {exp.notes && (
                        <div className="text-xs text-cafe-text-muted truncate max-w-xs">{exp.notes}</div>
                      )}
                      {exp.invoiceNumber && (
                        <div className="text-[10px] text-cafe-text-muted">Inv: {exp.invoiceNumber}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-serif font-bold text-cafe-forest">
                      {formatPrice(exp.amount)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant={
                            exp.paymentStatus === 'paid'
                              ? 'success'
                              : exp.paymentStatus === 'partial'
                              ? 'warning'
                              : 'danger'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {exp.paymentStatus}
                        </Badge>
                        {exp.payments[0] && (
                          <span className="text-[11px] text-cafe-text-muted">
                            via {exp.payments[0].method.replace('_', ' ')}
                            {exp.payments[0].paidByPartnerId &&
                              ` (${exp.payments[0].paidByPartnerId.name})`}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={exp.status === 'active' ? 'cream' : 'danger'}
                        className="text-[10px] uppercase"
                      >
                        {exp.status}
                      </Badge>
                      {exp.voidReason && (
                        <div className="text-[10px] text-red-600 truncate max-w-[120px]">
                          {exp.voidReason}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {exp.status === 'active' && exp.paymentStatus !== 'paid' && canCreate && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => {
                              setSelectedExpenseForPay(exp);
                              const remaining = exp.amount - exp.paidAmount;
                              setPayAmountRupees((remaining / 100).toFixed(2));
                              setIsPaymentOpen(true);
                            }}
                          >
                            Pay
                          </Button>
                        )}

                        {exp.status === 'active' && canVoid && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2 text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setSelectedExpenseForVoid(exp);
                              setVoidReason('');
                              setIsVoidOpen(true);
                            }}
                          >
                            Void
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record Expense */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Record New Expense">
        <form onSubmit={handleCreateExpense} className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Expense Date</label>
              <Input
                type="date"
                required
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 2500.00"
                value={createAmountRupees}
                onChange={(e) => setCreateAmountRupees(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Category</label>
            <select
              required
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2 focus:ring-1 focus:ring-cafe-forest"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Vendor (Optional)</label>
              <select
                value={createVendor}
                onChange={(e) => setCreateVendor(e.target.value)}
                className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
              >
                <option value="">None / One-time</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Invoice Number</label>
              <Input
                placeholder="e.g. INV-2026-90"
                value={createInvoice}
                onChange={(e) => setCreateInvoice(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Section */}
          <div className="border border-cafe-forest/10 rounded-lg p-3 bg-cafe-cream/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-cafe-forest">Mark as Paid Immediately</label>
              <input
                type="checkbox"
                checked={createIsPaid}
                onChange={(e) => setCreateIsPaid(e.target.checked)}
                className="rounded border-cafe-forest/30"
              />
            </div>

            {createIsPaid && (
              <div className="space-y-3 pt-2 border-t border-cafe-forest/10">
                <div>
                  <label className="block text-xs font-medium text-cafe-forest mb-1">Payment Method</label>
                  <select
                    value={createMethod}
                    onChange={(e) => setCreateMethod(e.target.value)}
                    className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-1.5"
                  >
                    <option value="cash_drawer">Cash Drawer (Deducts Float)</option>
                    <option value="upi">UPI (Cafe Account)</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="card">Card</option>
                    <option value="owner_paid">Owner Paid (Out of pocket - Credits Partner)</option>
                  </select>
                </div>

                {createMethod === 'owner_paid' && (
                  <div>
                    <label className="block text-xs font-medium text-cafe-forest mb-1">
                      Which Partner Paid?
                    </label>
                    <select
                      required
                      value={createPartnerId}
                      onChange={(e) => setCreatePartnerId(e.target.value)}
                      className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-1.5"
                    >
                      <option value="">Select Partner...</option>
                      {partners.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-cafe-forest mb-1">
                    Reference / UTR / Cheque #
                  </label>
                  <Input
                    placeholder="e.g. UTR-9823412"
                    value={createRef}
                    onChange={(e) => setCreateRef(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Notes / Description</label>
            <Textarea
              rows={2}
              placeholder="Any relevant context..."
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Record Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Void Expense */}
      <Modal
        isOpen={isVoidOpen}
        onClose={() => setIsVoidOpen(false)}
        title={`Void Expense: ${selectedExpenseForVoid?.expenseNo}`}
      >
        <form onSubmit={handleVoidExpense} className="space-y-4">
          <p className="text-xs text-cafe-text-muted">
            Voiding will invalidate this expense from all financial reports and compensate any cash drawer
            movements or partner credits.
          </p>

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Reason for Voiding</label>
            <Input
              required
              placeholder="e.g. Duplicate entry recorded by mistake"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsVoidOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={actionLoading}>
              {actionLoading ? 'Voiding...' : 'Confirm Void'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Payment */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={`Add Payment: ${selectedExpenseForPay?.expenseNo}`}
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Payment Amount (₹)</label>
            <Input
              type="number"
              step="0.01"
              required
              value={payAmountRupees}
              onChange={(e) => setPayAmountRupees(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
            >
              <option value="cash_drawer">Cash Drawer</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="owner_paid">Owner Paid</option>
            </select>
          </div>

          {payMethod === 'owner_paid' && (
            <div>
              <label className="block text-xs font-semibold text-cafe-forest mb-1">Partner</label>
              <select
                required
                value={payPartnerId}
                onChange={(e) => setPayPartnerId(e.target.value)}
                className="w-full text-sm bg-white border border-cafe-forest/20 rounded-lg px-3 py-2"
              >
                <option value="">Select Partner...</option>
                {partners.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-cafe-forest mb-1">Reference</label>
            <Input
              placeholder="UTR / Check #"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsPaymentOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Recurring Templates */}
      <Modal
        isOpen={isRecurringOpen}
        onClose={() => setIsRecurringOpen(false)}
        title="Recurring Expense Templates"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cafe-forest/10">
            <span className="text-xs text-cafe-text-muted">
              Auto-generate monthly recurring bills (rent, payroll base, wifi)
            </span>
            <Button size="sm" variant="outline" onClick={handleGenerateRecurring}>
              Generate for This Month
            </Button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {templates.map((t) => (
              <div
                key={t._id}
                className="p-3 rounded-lg border border-cafe-forest/10 bg-cafe-cream/30 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm text-cafe-forest">{t.title}</div>
                  <div className="text-xs text-cafe-text-muted">
                    {t.categoryId?.name} • Day {t.dayOfMonth} • {t.frequency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-cafe-forest">{formatPrice(t.amount)}</div>
                  <Badge variant="cream" className="text-[10px]">
                    via {t.paymentMethod}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setIsRecurringOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
