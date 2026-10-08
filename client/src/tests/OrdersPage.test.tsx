import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrdersPage } from '../pages/staff/OrdersPage';
import { ToastProvider } from '../components/ui/Toast';
import { posService } from '../services/posService';
import { PosOrder } from '../types/pos';
import * as AuthContextModule from '../lib/authContext';

describe('Staff OrdersPage (Order History) Component', () => {
  let queryClient: QueryClient;

  const mockOrders: PosOrder[] = [
    {
      _id: 'o1',
      id: 'o1',
      orderNo: 'T-001',
      localDate: '2026-10-06',
      type: 'dine_in',
      tableId: 't1',
      tableNumber: 3,
      status: 'paid',
      items: [
        {
          lineId: 'l1',
          menuItemId: 'm1',
          nameSnapshot: 'Cold Coffee Frappe',
          unitPrice: 15000,
          gstRateSnapshot: 5,
          foodTypeSnapshot: 'veg',
          qty: 2,
          status: 'active',
          sentAt: new Date().toISOString(),
          addedBy: { name: 'Waiter 1' },
        },
      ],
      kots: [
        {
          kotId: 'kot-1',
          kotNo: 'KOT-001',
          itemLineIds: ['l1'],
          sentAt: new Date().toISOString(),
        },
      ],
      version: 1,
      openedBy: { name: 'Waiter 1' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-mgr',
        name: 'Manager',
        username: 'manager',
        role: 'manager',
        isActive: true,
        phone: '9876543210',
        mustChangePassword: false,
        permissions: [
          'pos:access',
          'orders:read',
          'orders:create',
          'orders:update',
          'orders:cancel',
          'orders:discount',
          'orders:reopen',
          'billing:create',
          'billing:void',
          'payments:record',
        ],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(posService, 'getOrders').mockResolvedValue({
      orders: mockOrders,
      pagination: { total: 1, page: 1, pages: 1 },
    });

    vi.spyOn(posService, 'getOrderById').mockResolvedValue({
      order: mockOrders[0]!,
      calculated: {
        title: 'Tax Invoice',
        subtotal: 30000,
        discount: 0,
        taxable: 28571,
        cgst: 714,
        sgst: 715,
        totalTax: 1429,
        roundOff: 0,
        grandTotal: 30000,
        lines: [],
        taxBreakup: [],
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <OrdersPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders order history table with orders, status badges, and action buttons', async () => {
    renderComponent();

    expect(await screen.findByText('Order History')).toBeInTheDocument();
    expect(await screen.findByText('T-001')).toBeInTheDocument();
    expect(screen.getByText('Table #3')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByText('View Ticket')).toBeInTheDocument();
  });

  it('clicking View Ticket opens read-only ticket details with line items and totals', async () => {
    renderComponent();

    const viewBtn = await screen.findByText('View Ticket');
    fireEvent.click(viewBtn);

    expect(await screen.findByText(/Order Ticket: T-001/)).toBeInTheDocument();
    expect(screen.getByText('Cold Coffee Frappe')).toBeInTheDocument();
    expect(screen.getByText('Reprint KOT')).toBeInTheDocument();
  });
});
