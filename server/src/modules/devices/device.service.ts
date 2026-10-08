import crypto from 'crypto';
import argon2 from 'argon2';
import { Types } from 'mongoose';
import { TrustedDevice, ITrustedDevice } from './models/trustedDevice.model';
import { RefreshToken } from '../auth/models/RefreshToken';
import { User } from '../auth/models/User';
import { hasPermission } from '../auth/permissions';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../../config/realtimeEvents';

export const deviceService = {
  /**
   * Registers a new trusted terminal. Requires partner password re-verification.
   */
  async registerDevice(params: {
    name: string;
    partnerId: string;
    partnerPassword: string;
    userAgent?: string;
  }): Promise<{ device: ITrustedDevice; rawToken: string }> {
    const partner = await User.findById(params.partnerId).select('+passwordHash');
    if (!partner || !partner.isActive) {
      throw new AppError('Partner account not found or inactive', 404);
    }

    if (!hasPermission(partner.role, 'devices:manage')) {
      throw new AppError('Only partners can register trusted devices', 403);
    }

    const isPasswordValid = await argon2.verify(partner.passwordHash, params.partnerPassword);
    if (!isPasswordValid) {
      throw new AppError('Incorrect partner password', 401, 'INVALID_CREDENTIALS');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const device = await TrustedDevice.create({
      name: params.name.trim(),
      deviceTokenHash,
      registeredBy: partner._id,
      userAgent: params.userAgent,
      registeredAt: new Date(),
      lastUsedAt: new Date(),
    });

    await auditService.log({
      actorId: partner._id,
      actorName: partner.name,
      action: 'device.registered',
      entityType: 'TrustedDevice',
      entityId: device._id.toString(),
      metadata: {
        name: device.name,
        userAgent: params.userAgent,
      },
    });

    return { device, rawToken };
  },

  /**
   * Lists all registered terminals with status and metadata.
   */
  async listDevices(): Promise<ITrustedDevice[]> {
    return TrustedDevice.find().sort({ createdAt: -1 }).populate('registeredBy', 'name username');
  },

  /**
   * Revokes a trusted terminal and terminates all PIN sessions issued to it immediately.
   */
  async revokeDevice(deviceId: string, partnerId: string): Promise<ITrustedDevice> {
    const device = await TrustedDevice.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);
    if (device.revokedAt) throw new AppError('Device is already revoked', 400);

    device.revokedAt = new Date();
    await device.save();

    // Revoke all refresh tokens originated from this device
    const activeTokens = await RefreshToken.find({
      deviceId: device._id,
      revokedAt: null,
    });

    await RefreshToken.updateMany(
      {
        deviceId: device._id,
        revokedAt: null,
      },
      {
        $set: { revokedAt: new Date() },
      }
    );

    // Disconnect socket sessions for affected users
    const affectedUserIds = [...new Set(activeTokens.map((t) => t.userId.toString()))];
    for (const uid of affectedUserIds) {
      realtimeService.emit(REALTIME_EVENTS.SESSION_REVOKED, [`user:${uid}`], {
        reason: 'Device registration has been revoked by admin',
      });
      realtimeService.disconnectUserSockets(uid);
    }

    const partner = await User.findById(partnerId);
    await auditService.log({
      actorId: partner?._id || new Types.ObjectId(partnerId),
      actorName: partner?.name || 'Partner',
      action: 'device.revoked',
      entityType: 'TrustedDevice',
      entityId: device._id.toString(),
      metadata: {
        name: device.name,
        revokedSessionCount: activeTokens.length,
      },
    });

    return device;
  },

  /**
   * Verifies the presence and validity of the device_token cookie.
   */
  async verifyDeviceToken(rawToken?: string): Promise<ITrustedDevice> {
    if (!rawToken) {
      throw new AppError(
        'This terminal is not registered. Please register device with a Partner account.',
        401,
        'DEVICE_UNREGISTERED'
      );
    }

    const deviceTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const device = await TrustedDevice.findOne({
      deviceTokenHash,
      revokedAt: null,
    });

    if (!device) {
      throw new AppError(
        'Device registration is invalid or has been revoked.',
        401,
        'DEVICE_REVOKED'
      );
    }

    // Touch lastUsedAt asynchronously
    void TrustedDevice.updateOne({ _id: device._id }, { $set: { lastUsedAt: new Date() } });

    return device;
  },
};
