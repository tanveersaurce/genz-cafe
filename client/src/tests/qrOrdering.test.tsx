import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MenuPage } from '../pages/public/MenuPage';
import { OrderStatusPage } from '../pages/public/OrderStatusPage';
import { publicQrService } from '../services/publicQrService';
import { apiClient } from '../lib/apiClient';

describe('QR Self-Ordering Client Test Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  const mockMenuResponse = {
    success: true,
    data: {
      categories: [
        {
          id: 'cat-1',
          name: 'Coffee',
          slug: 'coffee',
          sortOrder: 1,
          items: [
            {
              id: 'item-pour-over',
              name: 'Signature Pour Over',
              slug: 'signature-pour-over',
              foodType: 'veg' as const,
              basePrice: 15000,
              variants: [],
              gstRate: 5,
              tags: [],
              isFeatured: false,
              isAvailable: true,
              sortOrder: 1,
            },
          ],
        },
      ],
      totalItems: 1,
    },
  };

  it('1. MenuPage displays self-ordering banner, Add to Order button, and cart drawer flow', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);
    vi.spyOn(publicQrService, 'getContext').mockResolvedValue({
      tableNumber: 5,
      orderingEnabled: true,
    });
    const submitOrderSpy = vi.spyOn(publicQrService, 'submitOrder').mockResolvedValue({
      submissionId: 'sub-123',
      statusToken: 'status-token-abc',
      kotNo: 'KOT-1',
      items: [{ nameSnapshot: 'Signature Pour Over', qty: 1 }],
      undoUntil: new Date(Date.now() + 60000).toISOString(),
    });

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/menu?table=5&t=valid-qr-token']}>
            <MenuPage />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

    // Verify self-ordering active banner
    await waitFor(() => {
      expect(screen.getByText(/Live Ordering Active/i)).toBeInTheDocument();
    });

    // Tap "Add to Order"
    const addBtn = screen.getByRole('button', { name: /Add to Order/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    // Verify floating bottom bar appears
    await waitFor(() => {
      expect(screen.getByText(/1 item selected/i)).toBeInTheDocument();
    });

    // Click "Review & Send" to open cart drawer
    const reviewBtn = screen.getByRole('button', { name: /Review & Send/i });
    fireEvent.click(reviewBtn);

    // Cart drawer displays
    await waitFor(() => {
      expect(screen.getByText(/Table 5 Order/i)).toBeInTheDocument();
    });

    // Fill customer name
    const nameInput = screen.getByLabelText(/Your Name \*/i);
    fireEvent.change(nameInput, { target: { value: 'Alex Chen' } });

    // Submit order
    const sendBtn = screen.getByRole('button', { name: /Send to Kitchen/i });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(submitOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 5,
          token: 'valid-qr-token',
          customerName: 'Alex Chen',
          lines: [
            expect.objectContaining({
              menuItemId: 'item-pour-over',
              qty: 1,
            }),
          ],
        })
      );
    });
  });

  it('2. MenuPage shows paused banner when self-ordering kill switch is enabled', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);
    vi.spyOn(publicQrService, 'getContext').mockResolvedValue({
      tableNumber: 5,
      orderingEnabled: false,
      reason: 'paused',
      pauseMessage: 'Kitchen running at full capacity.',
    });

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/menu?table=5&t=valid-qr-token']}>
            <MenuPage />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Self-Ordering Temporarily Paused/i)).toBeInTheDocument();
      expect(screen.getByText(/Kitchen running at full capacity/i)).toBeInTheDocument();
    });

    // "Add to Order" should not be visible when ordering is paused
    expect(screen.queryByRole('button', { name: /Add to Order/i })).not.toBeInTheDocument();
  });

  it('3. OrderStatusPage renders live progress, 60s cancel countdown, and handles cancel click', async () => {
    const mockStatus = {
      submissionId: 'sub-789',
      tableNumber: 5,
      status: 'Order received',
      kotStatus: 'new' as const,
      items: [
        {
          nameSnapshot: 'Signature Pour Over',
          qty: 1,
          note: 'extra hot',
        },
      ],
      createdAt: new Date().toISOString(),
      undoUntil: new Date(Date.now() + 45000).toISOString(),
      undoAllowed: true,
      serverTime: new Date().toISOString(),
    };

    vi.spyOn(publicQrService, 'getStatus').mockResolvedValue(mockStatus);
    const cancelSpy = vi.spyOn(publicQrService, 'cancelOrder').mockResolvedValue({
      success: true,
      message: 'Order cancelled successfully',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/order/status/test-status-token']}>
            <Routes>
              <Route path="/order/status/:token" element={<OrderStatusPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Order received/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Signature Pour Over')).toBeInTheDocument();
      expect(screen.getByText(/extra hot/i)).toBeInTheDocument();
    });

    // Check cancel button is rendered
    const cancelBtn = screen.getByRole('button', { name: /Cancel Order/i });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('test-status-token');
    });
  });
});
