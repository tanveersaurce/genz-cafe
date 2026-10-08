import React from 'react';
import { useAuth } from '@/lib/authContext';
import { Permission, hasPermission } from '@/lib/permissions';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, children }) => {
  const { user } = useAuth();

  if (!user || !hasPermission(user.permissions, permission)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
};
