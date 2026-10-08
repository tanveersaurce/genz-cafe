export const ROLES = [
  'partner',
  'manager',
  'cashier',
  'waiter',
  'kitchen',
  'marketing',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // User & Administrative
  'users:manage',
  'users:read',
  'partners:view',
  'reports:view',
  'audit:view',

  // Menu Management
  'menu:read',
  'menu:write',
  'menu:price',
  'menu:availability',
  'menu:delete',

  // Operations & POS
  'orders:read',
  'orders:create',
  'orders:update',
  'orders:cancel',
  'orders:discount',
  'orders:reopen',
  'billing:create',
  'billing:void',
  'payments:record',
  'orders:serve',
  'pos:access',
  'kitchen:view',
  'kitchen:update',

  // Tables & Reservations
  'tables:read',
  'tables:manage',
  'reservations:read',
  'reservations:manage',

  // Approvals & Devices
  'approvals:grant',
  'approvals:request',
  'devices:manage',
  'pin:manage-own',

  // Cash & Closing
  'cash:record',
  'closing:perform',
  'closing:view',
  'closing:reopen',

  // Expenses & Finance (Prompt 10)
  'expenses:read',
  'expenses:create',
  'expenses:edit',
  'expenses:void',
  'finance:view',
  'partners:manage',

  // QR Ordering & Settings (Prompt 11)
  'settings:manage',
  'qr:pause',
  'qr:rotate-token',
  'customerOrders:view-phone',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Maps each staff role to their designated granular permissions.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  partner: [
    'users:manage',
    'users:read',
    'partners:view',
    'reports:view',
    'audit:view',
    'menu:read',
    'menu:write',
    'menu:price',
    'menu:availability',
    'menu:delete',
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:cancel',
    'orders:discount',
    'orders:reopen',
    'billing:create',
    'billing:void',
    'payments:record',
    'orders:serve',
    'pos:access',
    'kitchen:view',
    'kitchen:update',
    'tables:read',
    'tables:manage',
    'reservations:read',
    'reservations:manage',
    'approvals:grant',
    'devices:manage',
    'pin:manage-own',
    'cash:record',
    'closing:perform',
    'closing:view',
    'closing:reopen',
    'expenses:read',
    'expenses:create',
    'expenses:edit',
    'expenses:void',
    'finance:view',
    'partners:manage',
    'settings:manage',
    'qr:pause',
    'qr:rotate-token',
    'customerOrders:view-phone',
  ],
  manager: [
    'users:read',
    'menu:read',
    'menu:write',
    'menu:price',
    'menu:availability',
    'menu:delete',
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:cancel',
    'orders:discount',
    'orders:reopen',
    'billing:create',
    'billing:void',
    'payments:record',
    'orders:serve',
    'pos:access',
    'kitchen:view',
    'kitchen:update',
    'tables:read',
    'tables:manage',
    'reservations:read',
    'reservations:manage',
    'approvals:grant',
    'pin:manage-own',
    'cash:record',
    'closing:perform',
    'closing:view',
    'expenses:read',
    'expenses:create',
    'expenses:edit',
    'qr:pause',
    'qr:rotate-token',
    'customerOrders:view-phone',
  ],
  marketing: [
    'menu:read',
    'menu:write', // Can create/edit descriptions, photos, tags, categories. NO price, NO delete, NO users, NO finance, NO tables/reservations.
  ],
  cashier: [
    'menu:read',
    'menu:availability',
    'orders:read',
    'orders:create',
    'orders:update',
    'billing:create',
    'payments:record',
    'orders:serve',
    'pos:access',
    'tables:read',
    'reservations:read',
    'reservations:manage',
    'approvals:request',
    'pin:manage-own',
    'cash:record',
    'closing:perform',
    'customerOrders:view-phone',
  ],
  waiter: [
    'menu:read',
    'menu:availability',
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:serve',
    'pos:access',
    'tables:read',
    'reservations:read',
    'approvals:request',
    'pin:manage-own',
  ],
  kitchen: [
    'menu:read',
    'menu:availability',
    'kitchen:view',
    'kitchen:update',
    'pin:manage-own',
  ],
};

export const getRolePermissions = (role: Role): readonly Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
};

export const hasAllPermissions = (role: Role, permissions: Permission[]): boolean => {
  const userPermissions = getRolePermissions(role);
  return permissions.every((p) => userPermissions.includes(p));
};
