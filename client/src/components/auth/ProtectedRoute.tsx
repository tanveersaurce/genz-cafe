import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Spinner } from '@/components/ui/Spinner';
import { ChangePasswordModal } from './ChangePasswordModal';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-cream-50 gap-3">
        <Spinner size="lg" variant="green" />
        <p className="text-small text-brand-ink-500 font-sans">Checking staff session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  return (
    <>
      {user?.mustChangePassword && <ChangePasswordModal />}
      {children ? children : <Outlet />}
    </>
  );
};
