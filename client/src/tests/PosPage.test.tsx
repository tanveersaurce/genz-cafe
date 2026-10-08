import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PosPage } from '../pages/staff/PosPage';
import { ToastProvider } from '../components/ui/Toast';
import { posService } from '../services/posService';
import { PosTable, PosOrder } from '../types/pos';
import { apiClient } from '../lib/apiClient';
import * as AuthContextModule from '../lib/authContext';

describe('Staff PosPage Component', () => {
  let queryClient: QueryClient;

  const mockTables: PosTable[] = [
    {
      tableId: 't1',
      tableNumber: 1,
      label: 'Window Cozy 1',
      capacity: 2,
      zone: 'window',
      status: 'free',
      openOrder: null,
      reservedSoon: null,
    },
    {
      tableId: 't2',
      tableNumber: 2,
      label: 'Indoor Booth 2',
      capacity: 4,
      zone: 'indoor',
      status: 'occupied',
      openOrder: {
        orderId: 'o2',
        orderNo: 'T-002',
        itemsCount: 3,
        runningTotalPaise: 45000,
        ageMinutes: 20,
      },
      reservedSoon: null,
    },
  ];

  const mockMenuItems = [
    {
      id: 'm1',
      name: 'Hazelnut Cold Coffee',
      category: 'c1',
      foodType: 'veg' as const,
      basePrice: 18000,
      variants: [],
      gstRate: 5 as const,
      isAvailable: true,
      isActive: true,
      sortOrder: 1,
      tags: [],
      isFeatured: false,
      slug: 'hazelnut-cold-coffee',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      name: 'Seasonal Berry Shake',
      category: 'c1',
      foodType: 'veg' as const,
      basePrice: 22000,
      variants: [],
      gstRate: 5 as const,
      isAvailable: false, // UNAVAILABLE
      isActive: true,
      sortOrder: 2,
      tags: [],
      isFeatured: false,
      slug: 'seasonal-berry-shake',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockActiveOrder: PosOrder = {
    _id: 'o2',
    id: 'o2',
    orderNo: 'T-002',
    localDate: '2026-10-06',
    type: 'dine_in',
    tableId: 't2',
    tableNumber: 2,
    status: 'open',
    items: [
      {
        lineId: 'l1',
        menuItemId: 'm1',
        nameSnapshot: 'Hazelnut Cold Coffee',
        unitPrice: 18000,
        gstRateSnapshot: 5,
        foodTypeSnapshot: 'veg',
        qty: 1,
        status: 'active',
        sentAt: new Date().toISOString(),
        kotId: 'kot-1',
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
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-waiter',
        name: 'Waiter One',
        username: 'waiter1',
        role: 'cashier',
        isActive: true,
        phone: '9876543210',
        mustChangePassword: false,
        permissions: [
          'pos:access',
          'orders:create',
          'orders:update',
          'orders:cancel',
          'orders:discount',
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

    vi.spyOn(posService, 'getLiveTables').mockResolvedValue(mockTables);
    vi.spyOn(posService, 'getOrderById').mockResolvedValue({
      order: mockActiveOrder,
      calculated: {
        title: 'Tax Invoice',
        subtotal: 18000,
        discount: 0,
        taxable: 17143,
        cgst: 428,
        sgst: 429,
        totalTax: 857,
        roundOff: 0,
        grandTotal: 18000,
        lines: [],
        taxBreakup: [],
      },
    });

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/pos/ready')) {
        return {
          success: true,
          data: [],
        };
      }
      if (url.includes('/menu')) {
        return {
          success: true,
          data: {
            categories: [{ id: 'c1', name: 'Brews' }],
            items: mockMenuItems,
          },
        };
      }
      return { success: true, data: {} };
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <PosPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders table map with Free, Occupied tables and Takeaway button', async () => {
    renderComponent();

    expect(await screen.findByText('POS Station & Table Map')).toBeInTheDocument();
    expect(screen.getByText('New Takeaway Order')).toBeInTheDocument();
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(await screen.findByText('Free')).toBeInTheDocument();
    expect(await screen.findByText('#2')).toBeInTheDocument();
    expect(await screen.findByText('Occupied')).toBeInTheDocument();
  });

  it('tapping an occupied table opens its running ticket showing Sent to Kitchen items', async () => {
    renderComponent();

    const table2Btn = await screen.findByText('#2');
    fireEvent.click(table2Btn);

    expect(await screen.findByText('T-002')).toBeInTheDocument();
    expect(await screen.findByText(/Sent to Kitchen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hazelnut Cold Coffee/).length).toBeGreaterThan(0);
  });

  it('unavailable item is disabled and marked Out of Stock', async () => {
    renderComponent();

    // Click table 2 to enter order screen
    const table2Btn = await screen.findByText('#2');
    fireEvent.click(table2Btn);

    // Find Seasonal Berry Shake
    const unavailableCard = await screen.findByText('Seasonal Berry Shake');
    const button = unavailableCard.closest('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('groups items into Sent vs New Draft and guards Send to Kitchen against double-taps', async () => {
    const addItemsSpy = vi.spyOn(posService, 'addItems').mockResolvedValue(mockActiveOrder);
    const sendKotSpy = vi.spyOn(posService, 'sendKot').mockResolvedValue({
      order: mockActiveOrder,
      kot: { kotId: 'kot-new', kotNo: 'KOT-002' },
    });

    renderComponent();

    // Click table 2
    const table2Btn = await screen.findByText('#2');
    fireEvent.click(table2Btn);

    // Tap available item Hazelnut Cold Coffee to add to draft
    const coffeeCard = await screen.findByText('Hazelnut Cold Coffee');
    fireEvent.click(coffeeCard);

    // Verify New Draft Items section appears with item
    expect(await screen.findByText(/New Draft Items/)).toBeInTheDocument();

    const sendBtn = screen.getByRole('button', { name: /Send 1 Items to Kitchen/i });
    expect(sendBtn).toBeInTheDocument();

    // Rapid double click
    fireEvent.click(sendBtn);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(addItemsSpy).toHaveBeenCalledTimes(1);
      expect(sendKotSpy).toHaveBeenCalledTimes(1);
    });
  });
});
