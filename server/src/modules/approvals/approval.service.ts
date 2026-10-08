import crypto from 'crypto';
import argon2 from 'argon2';
import { Types } from 'mongoose';
import { User } from '../auth/models/User';
import { hasPermission } from '../auth/permissions';
import { ApprovalToken, IApprovalToken } from './models/approvalToken.model';
import {
  ApprovableAction,
  APPROVABLE_ACTIONS,
  APPROVAL_ACTION_CONFIGS,
  approvalSettings,
} from '../../config/approvalActions';
import { hashParams } from './approval.utils';
import { validateApprovalPin } from '../../utils/pinValidator';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface RequestApprovalParams {
  requestedBy: string;
  approverId: string;
  pin: string;
  action: ApprovableAction;
  entityId: string;
  params: unknown;
}

export interface ConsumedTokenInfo {
  tokenDoc: IApprovalToken;
  approverId: string;
  approverName: string;
}

export const approvalService = {
  /**
   * Returns active staff members eligible to grant approvals (id and name only).
   */
  async getApprovers(): Promise<Array<{ id: string; name: string }>> {
    const approvers = await User.find(
      {
        isActive: true,
        role: { $in: ['partner', 'manager'] },
      },
      '_id name'
    ).sort({ name: 1 });

    return approvers.map((u) => ({
      id: u._id.toString(),
      name: u.name,
    }));
  },

  /**
   * Sets or updates own 6-digit approval PIN (managers and partners only).
   */
  async setApprovalPin(userId: string, currentPassword: string, pin: string): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash +pinHash');
    if (!user) throw new AppError('User not found', 404);

    if (!hasPermission(user.role, 'approvals:grant')) {
      throw new AppError('Only managers and partners can set an approval PIN', 403);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Incorrect password', 401, 'INVALID_CREDENTIALS');
    }

    validateApprovalPin(pin, user.phone);

    const pinHash = await argon2.hash(pin);
    user.pinHash = pinHash;
    user.pinSetAt = new Date();
    user.approvalPinFailedAttempts = 0;
    user.approvalPinLockedUntil = undefined;
    await user.save();

    await auditService.log({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.approval_pin_changed',
      entityType: 'User',
      entityId: user._id.toString(),
    });
  },

  /**
   * Verifies the manager's 6-digit PIN and issues a one-time 2-minute approval token.
   */
  async requestApproval(params: RequestApprovalParams): Promise<{
    approvalToken: string;
    expiresAt: Date;
  }> {
    if (!APPROVABLE_ACTIONS.includes(params.action)) {
      throw new AppError(`Action '${params.action}' is not approvable`, 400);
    }

    const actionConfig = APPROVAL_ACTION_CONFIGS[params.action];

    const approver = await User.findById(params.approverId).select(
      '+pinHash +approvalPinFailedAttempts +approvalPinLockedUntil'
    );

    if (!approver || !approver.isActive) {
      throw new AppError('Approver not found or inactive', 404);
    }

    // Verify approver has both approvals:grant and the action's underlying permission
    if (!hasPermission(approver.role, 'approvals:grant')) {
      throw new AppError('User cannot grant approvals', 403);
    }
    if (!hasPermission(approver.role, actionConfig.requiredPermission)) {
      throw new AppError('Approver lacks required permission for this action', 403);
    }

    const now = new Date();

    // Check if approver PIN is locked out
    if (approver.approvalPinLockedUntil && approver.approvalPinLockedUntil > now) {
      const waitMinutes = Math.ceil(
        (approver.approvalPinLockedUntil.getTime() - now.getTime()) / 60000
      );
      throw new AppError(
        `Approver PIN is temporarily locked. Please try again in ${waitMinutes} minute(s).`,
        429,
        'APPROVAL_PIN_LOCKED'
      );
    }

    if (!approver.pinHash) {
      throw new AppError('Approver has not configured an approval PIN', 400, 'APPROVAL_PIN_NOT_SET');
    }

    const isPinValid = await argon2.verify(approver.pinHash, params.pin);

    if (!isPinValid) {
      approver.approvalPinFailedAttempts = (approver.approvalPinFailedAttempts || 0) + 1;

      if (approver.approvalPinFailedAttempts >= approvalSettings.maxFailedAttempts) {
        approver.approvalPinLockedUntil = new Date(
          now.getTime() + approvalSettings.lockoutMinutes * 60 * 1000
        );
        await approver.save();

        await auditService.log({
          actorId: approver._id,
          actorName: approver.name,
          action: 'approval.pin_locked',
          entityType: 'User',
          entityId: approver._id.toString(),
          metadata: {
            failedAttempts: approver.approvalPinFailedAttempts,
            lockedUntil: approver.approvalPinLockedUntil,
          },
        });

        throw new AppError(
          'Too many incorrect attempts. Approval PIN has been locked for 15 minutes.',
          429,
          'APPROVAL_PIN_LOCKED'
        );
      }

      await approver.save();

      await auditService.log({
        actorId: params.requestedBy,
        action: 'approval.denied',
        entityType: 'User',
        entityId: approver._id.toString(),
        metadata: {
          targetAction: params.action,
          entityId: params.entityId,
          reason: 'Invalid PIN',
        },
      });

      throw new AppError('Invalid approval PIN', 401, 'INVALID_APPROVAL_PIN');
    }

    // Success: reset failed attempts
    approver.approvalPinFailedAttempts = 0;
    approver.approvalPinLockedUntil = undefined;
    await approver.save();

    // Generate random one-time token and store only SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const paramsHash = hashParams(params.params);
    const expiresAt = new Date(now.getTime() + approvalSettings.tokenTtlSeconds * 1000);

    await ApprovalToken.create({
      tokenHash,
      action: params.action,
      entityId: params.entityId,
      paramsHash,
      requestedBy: new Types.ObjectId(params.requestedBy),
      approverId: approver._id,
      expiresAt,
    });

    await auditService.log({
      actorId: approver._id,
      actorName: approver.name,
      action: 'approval.granted',
      entityType: 'ApprovalToken',
      metadata: {
        action: params.action,
        entityId: params.entityId,
        requestedBy: params.requestedBy,
      },
    });

    return {
      approvalToken: rawToken,
      expiresAt,
    };
  },

  /**
   * Atomically verifies and consumes a one-time approval token.
   * Prevents reuse, tampering with entityId/params, and cross-user theft.
   */
  async consumeApprovalToken(params: {
    rawToken: string;
    action: ApprovableAction;
    entityId: string;
    params: unknown;
    userId: string;
  }): Promise<ConsumedTokenInfo> {
    const tokenHash = crypto.createHash('sha256').update(params.rawToken).digest('hex');
    const expectedParamsHash = hashParams(params.params);
    const now = new Date();

    const tokenDoc = await ApprovalToken.findOneAndUpdate(
      {
        tokenHash,
        action: params.action,
        entityId: params.entityId,
        paramsHash: expectedParamsHash,
        requestedBy: new Types.ObjectId(params.userId),
        usedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: { usedAt: now },
      },
      {
        new: true,
      }
    ).populate('approverId', 'name');

    if (!tokenDoc) {
      throw new AppError(
        'Approval token is invalid, expired, already consumed, or does not match parameters',
        403,
        'APPROVAL_INVALID'
      );
    }

    const approver = tokenDoc.approverId as unknown as { _id: Types.ObjectId; name: string };

    return {
      tokenDoc: tokenDoc as IApprovalToken,
      approverId: approver._id.toString(),
      approverName: approver.name,
    };
  },
};
