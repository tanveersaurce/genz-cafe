import { apiClient } from '@/lib/apiClient';

export interface ExpenseCategory {
  _id: string;
  name: string;
  type: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Vendor {
  _id: string;
  name: string;
  category?: { _id: string; name: string };
  gstin?: string;
  phone?: string;
  defaultPaymentMethod?: string;
}

export interface ExpensePayment {
  _id?: string;
  method: string;
  amount: number;
  paidAt: string;
  paidBy?: { _id: string; name: string };
  paidByPartnerId?: { _id: string; name: string };
  reference?: string;
  cashMovementId?: string;
  ledgerEntryId?: string;
}

export interface Expense {
  _id: string;
  expenseNo: string;
  expenseDate: string;
  categoryId: { _id: string; name: string; type: string };
  vendorId?: { _id: string; name: string; phone?: string };
  vendorName?: string;
  amount: number; // paise
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  paidAmount: number; // paise
  payments: ExpensePayment[];
  status: 'active' | 'voided';
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
  isRecurringInstance?: boolean;
  voidReason?: string;
  createdBy?: { _id: string; name: string };
  createdAt: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  page: number;
  pages: number;
  summary: {
    totalAmount: number;
    totalPaid: number;
  };
}

export interface RecurringExpenseTemplate {
  _id: string;
  title: string;
  categoryId: { _id: string; name: string; type: string };
  vendorId?: { _id: string; name: string };
  amount: number; // paise
  frequency: string;
  dayOfMonth: number;
  paymentMethod: string;
  paidByPartnerId?: { _id: string; name: string };
  isActive: boolean;
  lastGeneratedMonth?: string;
  notes?: string;
}

export const expenseService = {
  async getCategories(): Promise<ExpenseCategory[]> {
    const res = await apiClient.get<{ success: boolean; data: ExpenseCategory[] }>('/expenses/categories');
    return res.data;
  },

  async createCategory(data: { name: string; type: string; sortOrder?: number }): Promise<ExpenseCategory> {
    const res = await apiClient.post<{ success: boolean; data: ExpenseCategory }>('/expenses/categories', data);
    return res.data;
  },

  async getVendors(): Promise<Vendor[]> {
    const res = await apiClient.get<{ success: boolean; data: Vendor[] }>('/expenses/vendors');
    return res.data;
  },

  async createVendor(data: { name: string; category?: string; gstin?: string; phone?: string }): Promise<Vendor> {
    const res = await apiClient.post<{ success: boolean; data: Vendor }>('/expenses/vendors', data);
    return res.data;
  },

  async listExpenses(params: {
    from?: string;
    to?: string;
    categoryId?: string;
    status?: string;
    paymentStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ExpenseListResponse> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.status) query.set('status', params.status);
    if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await apiClient.get<{ success: boolean; data: ExpenseListResponse }>(
      `/expenses?${query.toString()}`
    );
    return res.data;
  },

  async getExpense(id: string): Promise<Expense> {
    const res = await apiClient.get<{ success: boolean; data: Expense }>(`/expenses/${id}`);
    return res.data;
  },

  async createExpense(data: {
    expenseDate: string;
    categoryId: string;
    vendorId?: string;
    vendorName?: string;
    amount: number;
    isPaid?: boolean;
    paymentMethod?: string;
    paidByPartnerId?: string;
    reference?: string;
    invoiceNumber?: string;
    notes?: string;
  }): Promise<Expense> {
    const res = await apiClient.post<{ success: boolean; data: Expense }>('/expenses', data);
    return res.data;
  },

  async updateExpense(
    id: string,
    data: {
      categoryId?: string;
      vendorId?: string;
      vendorName?: string;
      amount?: number;
      invoiceNumber?: string;
      notes?: string;
    }
  ): Promise<Expense> {
    const res = await apiClient.patch<{ success: boolean; data: Expense }>(`/expenses/${id}`, data);
    return res.data;
  },

  async voidExpense(id: string, reason: string): Promise<Expense> {
    const res = await apiClient.post<{ success: boolean; data: Expense }>(`/expenses/${id}/void`, { reason });
    return res.data;
  },

  async addPayment(
    id: string,
    data: {
      method: string;
      amount: number;
      paidByPartnerId?: string;
      reference?: string;
    }
  ): Promise<Expense> {
    const res = await apiClient.post<{ success: boolean; data: Expense }>(`/expenses/${id}/payments`, data);
    return res.data;
  },

  async listRecurringTemplates(): Promise<RecurringExpenseTemplate[]> {
    const res = await apiClient.get<{ success: boolean; data: RecurringExpenseTemplate[] }>('/expenses/recurring');
    return res.data;
  },

  async createRecurringTemplate(data: {
    title: string;
    categoryId: string;
    vendorId?: string;
    amount: number;
    frequency?: string;
    dayOfMonth?: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<RecurringExpenseTemplate> {
    const res = await apiClient.post<{ success: boolean; data: RecurringExpenseTemplate }>(
      '/expenses/recurring',
      data
    );
    return res.data;
  },

  async generateRecurring(month: string): Promise<{ count: number; items: Expense[] }> {
    const res = await apiClient.post<{ success: boolean; data: { count: number; items: Expense[] } }>(
      '/expenses/recurring/generate',
      { month }
    );
    return res.data;
  },
};
