import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReadyToServeTray, PosReadyKot } from '../components/pos/ReadyToServeTray';
import { KitchenTicketCard, KitchenKot } from '../components/kitchen/KitchenTicketCard';
import { ToastProvider } from '../components/ui/Toast';
import { apiClient } from '../lib/apiClient';

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      id: 'waiter-1',
      name: 'Waiter Staff',
      role: 'waiter',
      permissions: ['orders:read', 'orders:serve'],
    },
  }),
}));

vi.mock('../lib/realtimeContext', () => ({
  useRealtime: () => ({
    connectionStatus: 'connected',
    connectionState: 'connected',
    isLive: true,
    refetchIntervalFallback: 60000,
  }),
}));

describe('ReadyToServeTray & Kitchen Components Test Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  describe('1. ReadyToServeTray', () => {
    const mockReadyKots: PosReadyKot[] = [
      {
        kotId: 'kot-999',
        kotNo: 'KOT-009',
        orderId: 'ord-999',
        orderNo: 'T-009',
        orderType: 'dine_in',
        tableNumber: 7,
        tableId: 't-7',
        readyAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        waitingMinutes: 4,
        itemCount: 3,
      },
    ];

    it('renders ready tickets and waiter can tap SERVED', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: mockReadyKots,
      });

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { idempotent: false },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ReadyToServeTray />
          </ToastProvider>
        </QueryClientProvider>
      );

      expect(await screen.findByText('FOOD READY FOR PICKUP')).toBeInTheDocument();
      expect(screen.getByText('Table 7')).toBeInTheDocument();
      expect(screen.getByText(/4m/)).toBeInTheDocument();

      const servedButton = screen.getByRole('button', { name: /SERVED/i });
      fireEvent.click(servedButton);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/pos/kots/kot-999/served');
      });
    });

    it('renders nothing when ready tickets list is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: [],
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ReadyToServeTray />
          </ToastProvider>
        </QueryClientProvider>
      );

      // Wait a tick for query to settle
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('2. KitchenTicketCard', () => {
    const mockKot: KitchenKot = {
      kotId: 'kot-303',
      kotNo: 'KOT-003',
      orderId: 'ord-303',
      orderNo: 'T-003',
      orderType: 'dine_in',
      tableNumber: 2,
      tableName: 'Table 2',
      zone: 'outdoor',
      status: 'ready',
      sentAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      readyAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      timestamps: {
        sentAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        receivedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        startedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        readyAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        servedAt: null,
      },
      items: [
        {
          lineId: 'line-3',
          menuItemId: 'item-3',
          name: 'Iced Latte',
          variant: 'Oat Milk',
          qty: 1,
          note: 'Sugar-free syrup',
          foodType: 'veg',
          status: 'active',
        },
      ],
    };

    it('renders ticket details and action buttons', () => {
      const onAction = vi.fn();
      const onUndo = vi.fn();

      render(
        <KitchenTicketCard
          kot={mockKot}
          onAction={onAction}
          onUndo={onUndo}
          clockOffsetMs={0}
        />
      );

      expect(screen.getByText('T2')).toBeInTheDocument();
      expect(screen.getByText('Iced Latte')).toBeInTheDocument();
      expect(screen.getByText('Oat Milk')).toBeInTheDocument();
      expect(screen.getByText(/Sugar-free syrup/)).toBeInTheDocument();
    });
  });
});
