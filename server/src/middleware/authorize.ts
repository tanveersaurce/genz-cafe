import { Request, Response, NextFunction } from 'express';
import { Permission, hasPermission, hasAllPermissions } from '../modules/auth/permissions';
import { AppError } from '../utils/AppError';

export const authorize = (...requiredPermissions: Permission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthenticated request', 401, 'UNAUTHENTICATED'));
    }

    const isAuthorized = hasAllPermissions(req.user.role, requiredPermissions);
    if (!isAuthorized) {
      return next(
        new AppError(
          `Forbidden: You do not possess the required permissions (${requiredPermissions.join(', ')})`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

export const authorizeAny = (...allowedPermissions: Permission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthenticated request', 401, 'UNAUTHENTICATED'));
    }

    const isAuthorized = allowedPermissions.some((p) => hasPermission(req.user!.role, p));
    if (!isAuthorized) {
      return next(
        new AppError(
          `Forbidden: You do not possess any of the required permissions (${allowedPermissions.join(', ')})`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};
