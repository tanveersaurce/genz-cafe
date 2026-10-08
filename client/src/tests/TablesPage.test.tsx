import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TablesPage } from '../pages/staff/TablesPage';
import { ToastProvider } from '../components/ui/Toast';
import * as AuthContextModule from '../lib/authContext';
import { apiClient } from '../lib/apiClient';

describe('Staff TablesPage Component', () => {
  let queryClient: QueryClient;

  const mockTables = [
    {
      _id: 't1',
      tableNumber: 1,
      label: 'Window Booth 1',
      capacity: 4,
      zone: 'window',
      isReservable: true,
      isActive: true,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      _id: 't2',
      tableNumber: 2,
      label: 'Outdoor Table 2',
      capacity: 2,
      zone: 'outdoor',
      isReservable: false,
      isActive: true,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

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
            <TablesPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders table cards with numbers, labels, and capacities', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        name: 'Manager',
        username: 'manager1',
        role: 'manager',
        isActive: true,
        mustChangePassword: false,
        permissions: ['tables:read', 'tables:manage'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: { tables: mockTables },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    expect(screen.getByText('Window Booth 1')).toBeInTheDocument();
    expect(screen.getByText('Capacity: 4')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('Outdoor Table 2')).toBeInTheDocument();
    expect(screen.getAllByText('Walk-in Only').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Add Table')).toBeInTheDocument();
    expect(screen.getByText('Print A4 QR Sheets')).toBeInTheDocument();
  });

  it('hides Add Table button when user lacks tables:manage permission', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u2',
        name: 'Waiter',
        username: 'waiter1',
        role: 'waiter',
        isActive: true,
        mustChangePassword: false,
        permissions: ['tables:read'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: { tables: mockTables },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Add Table')).not.toBeInTheDocument();
  });

  it('opens Single QR modal when clicking QR Code button', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        name: 'Manager',
        username: 'manager1',
        role: 'manager',
        isActive: true,
        mustChangePassword: false,
        permissions: ['tables:read', 'tables:manage'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: { tables: mockTables },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const qrButtons = screen.getAllByRole('button', { name: /QR Code/i });
    fireEvent.click(qrButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText('Table #1 QR Code')).toBeInTheDocument();
    });

    expect(screen.getByText('Download PNG')).toBeInTheDocument();
  });
});
