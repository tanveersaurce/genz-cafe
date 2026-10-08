import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../auth/models/User';
import { authService, sanitizeUser } from '../auth/auth.service';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { FilterQuery } from 'mongoose';
import { IUser } from '../auth/models/User';
import { RefreshToken } from '../auth/models/RefreshToken';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../../config/realtimeEvents';
import { deviceSettings } from '../../config/deviceSettings';

const generateTemporaryPassword = (): string => {
  // Generate random 10-char alphanumeric string with symbols, satisfying password policy
  const randomPart = crypto.randomBytes(6).toString('hex');
  return `Temp#${randomPart}`;
};

export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const { search, role, isActive, page = 1, limit = 20 } = req.query as {
      search?: string;
      role?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    };

    const filter: FilterQuery<IUser> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: users.map(sanitizeUser),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { name, username, role, phone } = req.body;
    const actor = req.user!;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      throw new AppError(`Username '${username}' is already in use`, 409, 'CONFLICT');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await authService.hashPassword(temporaryPassword);

    const newUser = await User.create({
      name,
      username: username.toLowerCase(),
      passwordHash,
      role,
      phone,
      mustChangePassword: true,
      createdBy: actor._id,
      isActive: true,
    });

    await auditService.log({
      actorId: actor._id,
      actorName: actor.name,
      action: 'user.create',
      entityType: 'User',
      entityId: newUser._id.toString(),
      metadata: { createdUsername: newUser.username, role: newUser.role },
      ip,
      userAgent,
    });

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(newUser),
        temporaryPassword, // Returned ONLY ONCE upon creation
      },
    });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, role, phone } = req.body;
    const actor = req.user!;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Safeguard 1: Partner cannot demote themselves
    if (user._id.equals(actor._id) && role && role !== 'partner') {
      throw new AppError('You cannot demote your own partner role', 400, 'FORBIDDEN');
    }

    // Safeguard 2: At least one active partner must always remain
    if (user.role === 'partner' && role && role !== 'partner') {
      const activePartnerCount = await User.countDocuments({ role: 'partner', isActive: true });
      if (activePartnerCount <= 1) {
        throw new AppError('Cannot demote the last active partner in the system', 400, 'FORBIDDEN');
      }
    }

    const oldRole = user.role;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role) {
      user.role = role;
      // Role changed to non-eligible role: invalidate PIN and PIN sessions
      if (!(deviceSettings.pinEligibleRoles as readonly string[]).includes(role)) {
        user.loginPinHash = undefined;
        user.mustChangePin = false;
        await RefreshToken.updateMany(
          { userId: user._id, loginMethod: 'pin', revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }
    }

    await user.save();

    if (role && role !== oldRole) {
      realtimeService.emit(
        REALTIME_EVENTS.SESSION_REVOKED,
        `user:${user._id.toString()}`,
        { reason: 'role_changed' }
      );
      realtimeService.disconnectUserSockets(user._id.toString());
    }

    await auditService.log({
      actorId: actor._id,
      actorName: actor.name,
      action: 'user.update',
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: { updatedFields: { name, role, phone } },
      ip,
      userAgent,
    });

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { isActive } = req.body;
    const actor = req.user!;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Safeguard 1: Partner cannot deactivate themselves
    if (user._id.equals(actor._id) && !isActive) {
      throw new AppError('You cannot deactivate your own account', 400, 'FORBIDDEN');
    }

    // Safeguard 2: System must always keep at least one active partner
    if (user.role === 'partner' && !isActive) {
      const activePartnerCount = await User.countDocuments({ role: 'partner', isActive: true });
      if (activePartnerCount <= 1) {
        throw new AppError('Cannot deactivate the last active partner in the system', 400, 'FORBIDDEN');
      }
    }

    user.isActive = isActive;
    if (!isActive) {
      // Deactivating invalidates login PIN
      user.loginPinHash = undefined;
      user.mustChangePin = false;
    }
    await user.save();

    // If deactivating user, immediately revoke all active refresh sessions and disconnect sockets
    if (!isActive) {
      await authService.revokeAllUserSessions(user._id);
      realtimeService.emit(
        REALTIME_EVENTS.SESSION_REVOKED,
        `user:${user._id.toString()}`,
        { reason: 'account_deactivated' }
      );
      realtimeService.disconnectUserSockets(user._id.toString());
    }

    await auditService.log({
      actorId: actor._id,
      actorName: actor.name,
      action: 'user.status_change',
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: { newStatus: isActive ? 'active' : 'deactivated' },
      ip,
      userAgent,
    });

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const actor = req.user!;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const temporaryPassword = generateTemporaryPassword();
    user.passwordHash = await authService.hashPassword(temporaryPassword);
    user.mustChangePassword = true;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    // Password reset invalidates fast login PIN
    user.loginPinHash = undefined;
    user.mustChangePin = false;
    await user.save();

    // Revoke all sessions for the user so they must log in with the new temp password
    await authService.revokeAllUserSessions(user._id);

    await auditService.log({
      actorId: actor._id,
      actorName: actor.name,
      action: 'user.reset_password',
      entityType: 'User',
      entityId: user._id.toString(),
      ip,
      userAgent,
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Password successfully reset',
        temporaryPassword, // Returned ONLY ONCE
      },
    });
  },

  async resetLoginPin(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const tempPin = await authService.resetStaffLoginPin(id as string, req.user!._id.toString());

    res.status(200).json({
      success: true,
      data: {
        message: 'Staff login PIN reset successfully',
        tempPin, // Returned ONLY ONCE
      },
    });
  },
};
