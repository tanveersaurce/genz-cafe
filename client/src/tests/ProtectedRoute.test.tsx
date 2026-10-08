import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import * as AuthContextModule from '../lib/authContext';

describe('ProtectedRoute component', () => {
  it('redirects unauthenticated users to /app/login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route
            path="/app/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/app/login" element={<div>Login Page Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Secret Dashboard Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Screen')).toBeInTheDocument();
  });

  it('renders protected child content for authenticated users', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u1',
        name: 'Partner User',
        username: 'partner1',
        role: 'partner',
        isActive: true,
        mustChangePassword: false,
        permissions: ['users:manage'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route
            path="/app/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Secret Dashboard Content')).toBeInTheDocument();
  });
});
