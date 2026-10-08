import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReservationsPage } from '../pages/staff/ReservationsPage';
import { ToastProvider } from '../components/ui/Toast';
import * as AuthContextModule from '../lib/authContext';
import { apiClient } from '../lib/apiClient';

describe('Staff ReservationsPage Component', () => {
  let queryClient: QueryClient;

  const mockReservations = [
    {
      _id: 'r1',
      code: 'GZ-K3N8P2',
      customerName: 'Priya Sharma',
      phone: '+91 98765 11111',
      guests: 2,
      date: '2026-10-05',
      time: '14:00',
      status: 'confirmed',
      source: 'web',
      assignedTables: [{ _id: 't1', tableNumber: 1, label: 'Table 1', zone: 'indoor' }],
      createdAt: '2026-10-05T00:00:00Z',
      updatedAt: '2026-10-05T00:00:00Z',
    },
    {
      _id: 'r2',
      code: 'GZ-M4X9L1',
      customerName: 'Rohan Mehra',
      phone: '+91 98765 22222',
      guests: 8,
      date: '2026-10-05',
      time: '19:30',
      status: 'pending',
      source: 'web',
      assignedTables: [],
      createdAt: '2026-10-05T00:00:00Z',
      updatedAt: '2026-10-05T00:00:00Z',
    },
  ];

  const mockSummary = {
    total: 2,
    pending: 1,
    confirmed: 1,
    seated: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

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
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <ReservationsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders reservation desk with summary counts and reservation cards', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        name: 'Manager',
        username: 'manager1',
        role: 'manager',
        isActive: true,
        mustChangePassword: false,
        permissions: ['reservations:read', 'reservations:manage'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/reservations/summary')) {
        return { success: true, data: { summary: mockSummary } };
      }
      if (url.includes('/reservations')) {
        return { success: true, data: { reservations: mockReservations, total: 2 } };
      }
      if (url.includes('/tables')) {
        return { success: true, data: { tables: [] } };
      }
      return { success: true, data: {} };
    });

    renderComponent();

    expect(screen.getByText('Reservation Desk')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('GZ-K3N8P2')).toBeInTheDocument();
    });

    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('GZ-M4X9L1')).toBeInTheDocument();
    expect(screen.getByText('Rohan Mehra')).toBeInTheDocument();

    // Verify Action Buttons for Manage role
    expect(screen.getByText('Seat')).toBeInTheDocument();
    expect(screen.getByText('Assign Table')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('New Booking')).toBeInTheDocument();
    expect(screen.getByText('Closure Blocks')).toBeInTheDocument();
  });

  it('hides action buttons for read-only waiter role', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u3',
        name: 'Waiter',
        username: 'waiter1',
        role: 'waiter',
        isActive: true,
        mustChangePassword: false,
        permissions: ['reservations:read'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/reservations/summary')) {
        return { success: true, data: { summary: mockSummary } };
      }
      if (url.includes('/reservations')) {
        return { success: true, data: { reservations: mockReservations, total: 2 } };
      }
      if (url.includes('/tables')) {
        return { success: true, data: { tables: [] } };
      }
      return { success: true, data: {} };
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('GZ-K3N8P2')).toBeInTheDocument();
    });

    // Verify Action buttons are hidden
    expect(screen.queryByText('Seat')).not.toBeInTheDocument();
    expect(screen.queryByText('New Booking')).not.toBeInTheDocument();
    expect(screen.queryByText('Closure Blocks')).not.toBeInTheDocument();
  });
});
