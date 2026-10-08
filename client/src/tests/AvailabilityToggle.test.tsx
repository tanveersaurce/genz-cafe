import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AvailabilityToggle } from '../components/menu/AvailabilityToggle';
import { ToastProvider } from '../components/ui/Toast';
import * as AuthContextModule from '../lib/authContext';
import { apiClient } from '../lib/apiClient';

describe('AvailabilityToggle component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders switch with aria-checked true when available and can toggle', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        name: 'Manager User',
        username: 'manager1',
        role: 'manager',
        isActive: true,
        mustChangePassword: false,
        permissions: ['menu:availability', 'menu:read'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      success: true,
      data: { id: 'item1', isAvailable: false },
    });

    renderWithProviders(
      <AvailabilityToggle
        itemId="item1"
        itemName="Iced Latte"
        isAvailable={true}
      />
    );

    const toggleBtn = screen.getByRole('switch', {
      name: /toggle availability for iced latte/i,
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/menu/items/item1/availability', {
        isAvailable: false,
      });
    });
  });

  it('is disabled when user lacks menu:availability permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u2',
        name: 'Marketing User',
        username: 'marketing1',
        role: 'marketing',
        isActive: true,
        mustChangePassword: false,
        permissions: ['menu:read', 'menu:write'], // No menu:availability
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <AvailabilityToggle
        itemId="item2"
        itemName="Cappuccino"
        isAvailable={true}
      />
    );

    const toggleBtn = screen.getByRole('switch', {
      name: /toggle availability for cappuccino/i,
    });
    expect(toggleBtn).toBeDisabled();
  });
});
