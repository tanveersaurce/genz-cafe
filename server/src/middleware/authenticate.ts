import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';
import { User } from '../modules/auth/models/User';
import { AppError } from '../utils/AppError';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401, 'UNAUTHENTICATED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication token missing.', 401, 'UNAUTHENTICATED');
    }

    const payload = authService.verifyAccessToken(token);

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new AppError('User belonging to this token no longer exists.', 401, 'UNAUTHENTICATED');
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact a partner.', 401, 'UNAUTHENTICATED');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is temporarily locked. Please try again later.', 423, 'ACCOUNT_LOCKED');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
