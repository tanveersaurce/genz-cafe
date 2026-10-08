import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { KitchenPage } from '../pages/staff/KitchenPage';
import { ToastProvider } from '../components/ui/Toast';
import { apiClient } from '../lib/apiClient';
import { KitchenBoardApiResponse } from '../components/kitchen/KitchenTicketCard';

// Mock Web Audio and Notification / WakeLock
vi.mock('../lib/soundAlerts', () => ({
  soundAlerts: {
    playNewTicket: vi.fn(),
    playItemCancelled: vi.fn(),
    playOrderReady: vi.fn(),
    unlockAudio: vi.fn().mockResolvedValue(true),
    isMuted: vi.fn().mockReturnValue(false),
    setMuted: vi.fn(),
    isAudioUnlocked: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      id: 'chef-1',
      name: 'Head Chef',
      role: 'kitchen',
      permissions: ['kitchen:view', 'kitchen:update', 'menu:read', 'menu:availability'],
    },
    logout: vi.fn(),
  }),
}));

const mockBoardData: KitchenBoardApiResponse = {
  serverTime: new Date().toISOString(),
  activeKots: [
    {
      kotId: 'kot-101',
      kotNo: 'KOT-001',
      orderId: 'ord-101',
      orderNo: 'T-001',
      orderType: 'dine_in',
      tableNumber: 3,
      tableName: 'Table 3',
      zone: 'indoor',
      status: 'new',
      sentAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      startedAt: null,
      readyAt: null,
      timestamps: {
        sentAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        receivedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        startedAt: null,
        readyAt: null,
        servedAt: null,
      },
      items: [
        {
          lineId: 'line-1',
          menuItemId: 'item-1',
          name: 'Paneer Tikka Pizza',
          variant: 'Medium',
          qty: 2,
          note: 'Spicy and crispy',
          foodType: 'veg',
          status: 'active',
        },
      ],
    },
    {
      kotId: 'kot-102',
      kotNo: 'KOT-002',
      orderId: 'ord-102',
      orderNo: 'T-002',
      orderType: 'takeaway',
      tableNumber: null,
      tableName: 'Takeaway',
      zone: null,
      status: 'preparing',
      sentAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      readyAt: null,
      timestamps: {
        sentAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        receivedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        readyAt: null,
        servedAt: null,
      },
      items: [
        {
          lineId: 'line-2',
          menuItemId: 'item-2',
          name: 'Iced Americano',
          variant: undefined,
          qty: 1,
          note: undefined,
          foodType: 'veg',
          status: 'active',
        },
      ],
    },
  ],
  recentlyServedKots: [],
};

describe('Staff KitchenPage (KDS) Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/kitchen/board') {
        return { success: true, data: mockBoardData };
      }
      if (url.includes('/menu')) {
        return { success: true, data: [] };
      }
      return { success: true, data: {} };
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async () => {
      return { success: true, data: { idempotent: false } };
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <KitchenPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders kitchen tickets in corresponding status columns with ticket details', async () => {
    renderComponent();

    // Check title and columns
    expect(await screen.findByText(/KITCHEN DISPLAY/i)).toBeInTheDocument();

    // Check Ticket 1 (New) details
    expect(await screen.findByText('T3')).toBeInTheDocument();
    expect(screen.getByText('Paneer Tikka Pizza')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/Spicy and crispy/)).toBeInTheDocument();

    // Check Ticket 2 (Preparing) details
    expect(screen.getByText('TAKEAWAY')).toBeInTheDocument();
    expect(screen.getByText('Iced Americano')).toBeInTheDocument();
  });

  it('allows chef to start prep by clicking START PREPARING button', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { idempotent: false },
    });

    renderComponent();

    const startPrepBtn = await screen.findByRole('button', { name: /START PREPARING/i });
    fireEvent.click(startPrepBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/kitchen/kots/kot-101/status',
        { to: 'preparing', expectedFrom: 'new' }
      );
    });
  });

  it('allows chef to mark ticket ready by clicking MARK READY button', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { idempotent: false },
    });

    renderComponent();

    const readyBtn = await screen.findByRole('button', { name: /MARK READY/i });
    fireEvent.click(readyBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/kitchen/kots/kot-102/status',
        { to: 'ready', expectedFrom: 'preparing' }
      );
    });
  });

  it('opens 86 Out of Stock modal when clicking 86 Out of Stock button', async () => {
    renderComponent();

    const stockBtn = await screen.findByRole('button', { name: /86 Out of Stock/i });
    fireEvent.click(stockBtn);

    expect(await screen.findByText('Quick Stock Control (86 Items)')).toBeInTheDocument();
  });
});
