import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { HomePage } from '../pages/public/HomePage';
import { GalleryPage } from '../pages/public/GalleryPage';
import { ContactPage } from '../pages/public/ContactPage';
import { ReservationPage } from '../pages/public/ReservationPage';
import { ToastProvider } from '../components/ui/Toast';
import { apiClient } from '../lib/apiClient';

describe('Public Pages Rendering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const wrap = (component: React.ReactElement) => {
    return render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter>{component}</MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  };

  it('renders HomePage with hero and brand pillars', () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: { categories: [], totalItems: 0 },
    });

    wrap(<HomePage />);

    expect(screen.getByText(/Good Food,/i)).toBeInTheDocument();
    expect(screen.getByText(/The Gen-Z Experience/i)).toBeInTheDocument();
    expect(screen.getByText('Delicious Food')).toBeInTheDocument();
    expect(screen.getByText('Great Ambience')).toBeInTheDocument();
  });

  it('renders GalleryPage with category filter buttons and cards', () => {
    wrap(<GalleryPage />);

    expect(screen.getByText('Photo Gallery')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Food$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Drinks$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ambience$/i })).toBeInTheDocument();
  });

  it('renders ContactPage with action cards and weekly hours table', () => {
    wrap(<ContactPage />);

    expect(screen.getByText('Visit & Connect')).toBeInTheDocument();
    expect(screen.getByText('Phone Support')).toBeInTheDocument();
    expect(screen.getByText('Weekly Operating Hours (IST)')).toBeInTheDocument();
    expect(screen.getByText('Find Us on the Map')).toBeInTheDocument();
  });

  it('renders ReservationPage with booking stepper and mode switch', () => {
    wrap(<ReservationPage />);

    expect(screen.getByText('Reserve a Table')).toBeInTheDocument();
    expect(screen.getByText('Book a Table')).toBeInTheDocument();
    expect(screen.getByText('Find / Cancel Booking')).toBeInTheDocument();
    expect(screen.getByText('Date & Guests')).toBeInTheDocument();
    expect(screen.getByText('Find Slots')).toBeInTheDocument();
  });
});
