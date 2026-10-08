import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { Role, getRolePermissions } from './permissions';
import { User, IUser } from './models/User';
import { RefreshToken } from './models/RefreshToken';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { validateLoginPin } from '../../utils/pinValidator';
import { deviceService } from '../devices/device.service';
import { deviceSettings } from '../../config/deviceSettings';

export interface TokenPayload {
  userId: string;
  role: Role;
}

export interface UserResponse {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  phone?: string;
  mustChangePassword: boolean;
  mustChangePin?: boolean;
  permissions: readonly string[];
}

export const sanitizeUser = (user: IUser): UserResponse => {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    phone: user.phone,
    mustChangePassword: user.mustChangePassword,
    mustChangePin: !!user.mustChangePin,
    permissions: getRolePermissions(user.role),
  };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const authService = {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  },

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      return decoded as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired access token', 401, 'UNAUTHENTICATED');
    }
  },

  async createSession(
    user: IUser,
    ip?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const accessToken = this.generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // 64-byte cryptographically secure random token
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      createdByIp: ip,
      userAgent,
    });

    return { accessToken, rawRefreshToken };
  },

  async rotateSession(
    rawRefreshToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; newRawRefreshToken: string; user: IUser }> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await RefreshToken.findOne({ tokenHash });

    if (!existing) {
      throw new AppError('Invalid refresh token session', 401, 'UNAUTHENTICATED');
    }

    // Token Reuse / Theft Detection: If token is already revoked, breach detected!
    if (existing.revokedAt) {
      // Invalidate ALL tokens for this compromised account immediately
      await RefreshToken.updateMany(
        { userId: existing.userId, revokedAt: { $exists: false } },
        { revokedAt: new Date() }
      );

      await auditService.log({
        actorId: existing.userId,
        action: 'auth.token_theft_detected',
        entityType: 'RefreshToken',
        metadata: {
          ip,
          userAgent,
          reusedTokenHashPrefix: tokenHash.substring(0, 10),
        },
        ip,
        userAgent,
      });

      throw new AppError(
        'Session security violation detected. All sessions revoked for this account.',
        401,
        'UNAUTHENTICATED'
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new AppError('Refresh token expired. Please log in again.', 401, 'UNAUTHENTICATED');
    }

    const user = await User.findById(existing.userId);
    if (!user || !user.isActive) {
      throw new AppError('Account is inactive or not found', 401, 'UNAUTHENTICATED');
    }

    // Issue rotated tokens
    const newRawRefreshToken = crypto.randomBytes(64).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    // Revoke old token and link to replacement
    existing.revokedAt = new Date();
    existing.replacedByTokenHash = newTokenHash;
    await existing.save();

    // Create new token
    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt,
      createdByIp: ip,
      userAgent,
    });

    const accessToken = this.generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    return { accessToken, newRawRefreshToken, user };
  },

  async revokeSession(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.updateOne(
      { tokenHash, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );
  },

  async revokeAllUserSessions(userId: Types.ObjectId | string): Promise<void> {
    await RefreshToken.updateMany(
      { userId, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );
  },

  /**
   * Returns list of staff members with an active login PIN for fast PIN login.
   * Requires a valid device registration cookie.
   */
  async getPinUsers(
    deviceToken?: string
  ): Promise<Array<{ id: string; name: string; username: string; role: Role }>> {
    await deviceService.verifyDeviceToken(deviceToken);

    const users = await User.find(
      {
        isActive: true,
        role: { $in: deviceSettings.pinEligibleRoles },
        loginPinHash: { $exists: true, $ne: null },
      },
      '_id name username role'
    ).sort({ name: 1 });

    return users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      role: u.role,
    }));
  },

  /**
   * Fast 4-digit PIN login on a trusted device terminal.
   * Only floor/kitchen staff (waiter, cashier, kitchen) can use this.
   * Lockout: 5 wrong attempts locks user on PIN login for 15 minutes.
   * Refresh session lifetime: 12 hours.
   */
  async loginWithPin(params: {
    userId: string;
    pin: string;
    deviceToken?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ accessToken: string; rawRefreshToken: string; user: IUser }> {
    const device = await deviceService.verifyDeviceToken(params.deviceToken);

    const user = await User.findById(params.userId).select(
      '+passwordHash +loginPinHash +loginPinFailedAttempts +loginPinLockedUntil'
    );

    if (!user || !user.isActive) {
      throw new AppError('Account not found or inactive', 401, 'UNAUTHENTICATED');
    }

    if (!(deviceSettings.pinEligibleRoles as readonly string[]).includes(user.role)) {
      throw new AppError(
        'PIN login is only available for floor and kitchen staff (waiter, cashier, kitchen)',
        403,
        'PIN_LOGIN_NOT_ALLOWED'
      );
    }

    const now = new Date();
    if (user.loginPinLockedUntil && user.loginPinLockedUntil > now) {
      const waitMinutes = Math.ceil((user.loginPinLockedUntil.getTime() - now.getTime()) / 60000);
      throw new AppError(
        `PIN login is temporarily locked. Please use password login or wait ${waitMinutes} minute(s).`,
        429,
        'PIN_LOCKED'
      );
    }

    if (!user.loginPinHash) {
      throw new AppError('PIN login is not configured for this account', 400, 'PIN_NOT_SET');
    }

    const isPinValid = await argon2.verify(user.loginPinHash, params.pin);

    if (!isPinValid) {
      user.loginPinFailedAttempts = (user.loginPinFailedAttempts || 0) + 1;

      if (user.loginPinFailedAttempts >= deviceSettings.maxPinFailedAttempts) {
        user.loginPinLockedUntil = new Date(
          now.getTime() + deviceSettings.pinLockoutMinutes * 60 * 1000
        );
        await user.save();

        await auditService.log({
          actorId: user._id,
          actorName: user.name,
          action: 'auth.pin_login_locked',
          entityType: 'User',
          entityId: user._id.toString(),
          metadata: {
            deviceId: device._id.toString(),
            failedAttempts: user.loginPinFailedAttempts,
            lockedUntil: user.loginPinLockedUntil,
          },
          ip: params.ip,
          userAgent: params.userAgent,
        });

        throw new AppError(
          'Too many incorrect PIN attempts. PIN login locked for 15 minutes. Password login remains available.',
          429,
          'PIN_LOCKED'
        );
      }

      await user.save();

      await auditService.log({
        actorId: user._id,
        actorName: user.name,
        action: 'auth.pin_login_failed',
        entityType: 'User',
        entityId: user._id.toString(),
        metadata: {
          deviceId: device._id.toString(),
          failedAttempts: user.loginPinFailedAttempts,
        },
        ip: params.ip,
        userAgent: params.userAgent,
      });

      throw new AppError('Invalid PIN', 401, 'INVALID_PIN');
    }

    // Success: reset failed attempts
    user.loginPinFailedAttempts = 0;
    user.loginPinLockedUntil = undefined;
    user.lastLoginAt = now;
    await user.save();

    // Create 12-hour session
    const accessToken = this.generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(
      now.getTime() + deviceSettings.pinRefreshLifetimeHours * 60 * 60 * 1000
    );

    await RefreshToken.create({
      userId: user._id,
      deviceId: device._id,
      loginMethod: 'pin',
      tokenHash,
      expiresAt,
      createdByIp: params.ip,
      userAgent: params.userAgent,
    });

    await auditService.log({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.pin_login',
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: {
        deviceId: device._id.toString(),
        deviceName: device.name,
      },
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return { accessToken, rawRefreshToken, user };
  },

  /**
   * Sets or changes staff member's own 4-digit fast login PIN.
   */
  async setLoginPin(userId: string, currentPassword: string, newPin: string): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash +loginPinHash');
    if (!user) throw new AppError('User not found', 404);

    if (!(deviceSettings.pinEligibleRoles as readonly string[]).includes(user.role)) {
      throw new AppError('Fast PIN login is not available for this role', 403);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Incorrect password', 401, 'INVALID_CREDENTIALS');
    }

    validateLoginPin(newPin);

    const pinHash = await argon2.hash(newPin);
    user.loginPinHash = pinHash;
    user.mustChangePin = false;
    user.loginPinFailedAttempts = 0;
    user.loginPinLockedUntil = undefined;
    await user.save();

    await auditService.log({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.login_pin_changed',
      entityType: 'User',
      entityId: user._id.toString(),
    });
  },

  /**
   * Resets a staff member's fast login PIN (partner only).
   * Generates a random 4-digit PIN, sets mustChangePin = true, revokes prior PIN sessions.
   */
  async resetStaffLoginPin(targetUserId: string, partnerId: string): Promise<string> {
    const targetUser = await User.findById(targetUserId).select('+loginPinHash');
    if (!targetUser) throw new AppError('User not found', 404);

    if (!(deviceSettings.pinEligibleRoles as readonly string[]).includes(targetUser.role)) {
      throw new AppError('Target user is not eligible for fast PIN login', 400);
    }

    // Generate random non-trivial 4-digit PIN
    let tempPin = '';
    while (true) {
      const candidate = Math.floor(1000 + Math.random() * 9000).toString();
      try {
        validateLoginPin(candidate);
        tempPin = candidate;
        break;
      } catch {
        // regenerate
      }
    }

    const pinHash = await argon2.hash(tempPin);
    targetUser.loginPinHash = pinHash;
    targetUser.mustChangePin = true;
    targetUser.loginPinFailedAttempts = 0;
    targetUser.loginPinLockedUntil = undefined;
    await targetUser.save();

    // Revoke any existing PIN sessions for this user
    await RefreshToken.updateMany(
      { userId: targetUser._id, loginMethod: 'pin', revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    const partner = await User.findById(partnerId);
    await auditService.log({
      actorId: partner?._id || new Types.ObjectId(partnerId),
      actorName: partner?.name || 'Partner',
      action: 'auth.login_pin_reset',
      entityType: 'User',
      entityId: targetUser._id.toString(),
      metadata: {
        targetUsername: targetUser.username,
      },
    });

    return tempPin;
  },
};
