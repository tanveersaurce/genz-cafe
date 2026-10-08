import { Request, Response } from 'express';
import { User } from './models/User';
import { authService, sanitizeUser } from './auth.service';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { env } from '../../config/env';

const COOKIE_NAME = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Lax works reliably in modern browsers across local dev ports while stopping CSRF
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
};

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');

    // Generic error message for both non-existent user and wrong password
    const invalidCredentialsError = new AppError('Invalid username or password', 401, 'UNAUTHENTICATED');

    if (!user) {
      await auditService.log({
        action: 'auth.failed_login',
        entityType: 'User',
        metadata: { usernameAttempt: username, reason: 'user_not_found' },
        ip,
        userAgent,
      });
      throw invalidCredentialsError;
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact a partner.', 403, 'FORBIDDEN');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      throw new AppError(
        `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
        423,
        'ACCOUNT_LOCKED'
      );
    }

    const isMatch = await authService.verifyPassword(password, user.passwordHash);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lock account for 15 minutes after 5 consecutive failures
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await auditService.log({
          actorId: user._id,
          actorName: user.name,
          action: 'auth.account_locked',
          entityType: 'User',
          entityId: user._id.toString(),
          metadata: { failedAttempts: user.failedLoginAttempts, lockDurationMinutes: 15 },
          ip,
          userAgent,
        });
      }

      await user.save();

      await auditService.log({
        actorId: user._id,
        actorName: user.name,
        action: 'auth.failed_login',
        entityType: 'User',
        entityId: user._id.toString(),
        metadata: { failedAttempts: user.failedLoginAttempts },
        ip,
        userAgent,
      });

      throw invalidCredentialsError;
    }

    // Success: Reset failure count and update last login
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken, rawRefreshToken } = await authService.createSession(user, ip, userAgent);

    res.cookie(COOKIE_NAME, rawRefreshToken, COOKIE_OPTIONS);

    await auditService.log({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.login',
      entityType: 'User',
      entityId: user._id.toString(),
      ip,
      userAgent,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: sanitizeUser(user),
      },
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[COOKIE_NAME];
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!rawRefreshToken) {
      throw new AppError('Refresh token missing. Please sign in.', 401, 'UNAUTHENTICATED');
    }

    const { accessToken, newRawRefreshToken, user } = await authService.rotateSession(
      rawRefreshToken,
      ip,
      userAgent
    );

    res.cookie(COOKIE_NAME, newRawRefreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: sanitizeUser(user),
      },
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[COOKIE_NAME];
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (rawRefreshToken) {
      await authService.revokeSession(rawRefreshToken);
    }

    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });

    if (req.user) {
      await auditService.log({
        actorId: req.user._id,
        actorName: req.user.name,
        action: 'auth.logout',
        entityType: 'User',
        entityId: req.user._id.toString(),
        ip,
        userAgent,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  },

  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
    }

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(req.user),
      },
    });
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body;
    const currentUser = req.user!;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (newPassword === currentUser.username) {
      throw new AppError('New password cannot be identical to your username', 400, 'VALIDATION_ERROR');
    }

    const user = await User.findById(currentUser._id).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const isMatch = await authService.verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Incorrect current password', 400, 'VALIDATION_ERROR');
    }

    user.passwordHash = await authService.hashPassword(newPassword);
    user.mustChangePassword = false;
    // Password change invalidates fast login PIN
    user.loginPinHash = undefined;
    user.mustChangePin = false;
    await user.save();

    // Revoke all other active refresh sessions for security
    await authService.revokeAllUserSessions(user._id);

    await auditService.log({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.change_password',
      entityType: 'User',
      entityId: user._id.toString(),
      ip,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. All other sessions have been logged out.',
    });
  },

  async getPinUsers(req: Request, res: Response): Promise<void> {
    const deviceToken = req.cookies?.['device_token'];
    const users = await authService.getPinUsers(deviceToken);
    res.status(200).json({
      success: true,
      data: { users },
    });
  },

  async loginWithPin(req: Request, res: Response): Promise<void> {
    const { userId, pin } = req.body;
    const deviceToken = req.cookies?.['device_token'];
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!userId || !pin) {
      throw new AppError('User ID and 4-digit PIN are required', 400);
    }

    const { accessToken, rawRefreshToken, user } = await authService.loginWithPin({
      userId,
      pin,
      deviceToken,
      ip,
      userAgent,
    });

    res.cookie(COOKIE_NAME, rawRefreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 12 * 60 * 60 * 1000, // 12-hour PIN session
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: sanitizeUser(user),
        mustChangePin: user.mustChangePin,
      },
    });
  },

  async setLoginPin(req: Request, res: Response): Promise<void> {
    const { currentPassword, pin } = req.body;
    if (!currentPassword || !pin) {
      throw new AppError('Current password and 4-digit PIN are required', 400);
    }

    await authService.setLoginPin(req.user!._id.toString(), currentPassword, pin);

    res.status(200).json({
      success: true,
      message: 'Fast login PIN updated successfully',
    });
  },
};
