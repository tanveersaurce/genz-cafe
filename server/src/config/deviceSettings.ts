import { Role } from '../modules/auth/permissions';

export const deviceSettings = {
  cookieName: 'device_token',
  cookieMaxAgeDays: 365,
  pinRefreshLifetimeHours: 12,
  // DUMMY: confirm with cafe
  idleTimeoutMinutes: 3,
  pinEligibleRoles: ['waiter', 'cashier', 'kitchen'] as const satisfies readonly Role[],
  maxPinFailedAttempts: 5,
  pinLockoutMinutes: 15,
};
