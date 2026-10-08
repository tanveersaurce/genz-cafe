import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MenuPage } from '../pages/public/MenuPage';
import { apiClient } from '../lib/apiClient';

describe('MenuPage component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const mockMenuResponse = {
    success: true,
    data: {
      categories: [
        {
          id: 'cat-coffee',
          name: 'Artisanal Coffee',
          slug: 'artisanal-coffee',
          description: 'Specialty single origin roasts and espresso brews',
          sortOrder: 1,
          items: [
            {
              id: 'item-espresso',
              name: 'Doppio Espresso',
              slug: 'doppio-espresso',
              description: 'Double shot of concentrated single origin roast',
              foodType: 'veg',
              basePrice: 18000,
              variants: [],
              gstRate: 5,
              tags: ['bestseller'],
              isFeatured: true,
              isAvailable: true,
              preparationMinutes: 5,
              sortOrder: 1,
            },
            {
              id: 'item-coldbrew',
              name: 'Vanilla Sweet Cream Cold Brew',
              slug: 'vanilla-sweet-cream-cold-brew',
              description: 'Slow steeped 18-hour cold brew with vanilla cream',
              foodType: 'veg',
              basePrice: 24000,
              variants: [],
              gstRate: 5,
              tags: ['chef_special'],
              isFeatured: true,
              isAvailable: false, // OUT OF STOCK
              preparationMinutes: 3,
              sortOrder: 2,
            },
          ],
        },
      ],
      totalItems: 2,
    },
  };

  const renderWithProviders = (initialEntries = ['/menu']) => {
    return render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <MenuPage />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  };

  it('renders menu items and displays "Temporarily Sold Out" badge for out-of-stock items', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);

    renderWithProviders(['/menu']);

    await waitFor(() => {
      expect(screen.getByText('Doppio Espresso')).toBeInTheDocument();
      expect(screen.getByText('Vanilla Sweet Cream Cold Brew')).toBeInTheDocument();
    });

    // Available item badge
    expect(screen.getByText('Available Now')).toBeInTheDocument();

    // Out of stock item badge
    expect(screen.getByText('Temporarily Sold Out')).toBeInTheDocument();
  });

  it('detects and displays valid ?table=N session banner', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);

    renderWithProviders(['/menu?table=4']);

    await waitFor(() => {
      expect(screen.getByText(/Dining at Table 4/i)).toBeInTheDocument();
    });
  });

  it('ignores invalid table numbers (e.g. 0, 100, abc)', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);

    renderWithProviders(['/menu?table=0']);

    await waitFor(() => {
      expect(screen.getByText('Doppio Espresso')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Dining at Table/i)).not.toBeInTheDocument();
  });

  it('displays dietary filter options', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(mockMenuResponse);

    renderWithProviders(['/menu']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all items/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pure veg/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /non-veg/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /contains egg/i })).toBeInTheDocument();
    });
  });
});
