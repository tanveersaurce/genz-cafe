import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ReservationPage } from '../pages/public/ReservationPage';
import { ToastProvider } from '../components/ui/Toast';
import { apiClient } from '../lib/apiClient';

describe('Public ReservationPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter>
              <ReservationPage />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  };

  it('renders Step 1 with date picker and guests selector', () => {
    renderComponent();

    expect(screen.getByText('Reserve a Table')).toBeInTheDocument();
    expect(screen.getByText('1. Choose Date & Number of Guests')).toBeInTheDocument();
    expect(screen.getByText(/Party Size/i)).toBeInTheDocument();
    expect(screen.getByText('Find Slots')).toBeInTheDocument();
  });

  it('updates party size when clicking guest count chips', () => {
    renderComponent();

    const fourGuestBtn = screen.getByRole('button', { name: '4' });
    fireEvent.click(fourGuestBtn);

    expect(screen.getByText(/Party Size \(4 Guests\)/i)).toBeInTheDocument();
  });

  it('advances to Step 2 and displays slots returned by API', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: {
        slots: [
          { time: '12:00', isAvailable: true, requiresConfirmation: false },
          { time: '12:30', isAvailable: true, requiresConfirmation: false },
          { time: '13:00', isAvailable: false, requiresConfirmation: false, reason: 'Full' },
        ],
      },
    });

    renderComponent();

    const findSlotsBtn = screen.getByText('Find Slots');
    fireEvent.click(findSlotsBtn);

    await waitFor(() => {
      expect(screen.getByText('2. Select Time Slot')).toBeInTheDocument();
    });

    expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    expect(screen.getByText('12:30 PM')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
  });

  it('allows switching to Find / Cancel Booking mode and searches for reservation', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        reservation: {
          code: 'GZ-ABC123',
          customerName: 'Aarav Patel',
          phoneMasked: '+91 98***00000',
          guests: 4,
          date: '2026-10-10',
          time: '19:00',
          status: 'confirmed',
          assignedTables: [{ tableNumber: 3, label: 'Window 3', zone: 'window' }],
        },
      },
    });

    renderComponent();

    const findTab = screen.getByRole('button', { name: 'Find / Cancel Booking' });
    fireEvent.click(findTab);

    expect(screen.getByText('Find or Manage Your Reservation')).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText('GZ-XXXXXX');
    const phoneInput = screen.getByPlaceholderText('9876543210');
    fireEvent.change(codeInput, { target: { value: 'GZ-ABC123' } });
    fireEvent.change(phoneInput, { target: { value: '9876500000' } });

    const searchBtn = screen.getByRole('button', { name: /Search Booking/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
    });

    expect(screen.getByText('GZ-ABC123')).toBeInTheDocument();
    expect(screen.getByText('Cancel This Reservation')).toBeInTheDocument();
  });
});
