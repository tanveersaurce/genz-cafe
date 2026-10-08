import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { CashMovement, ICashMovement, CashMovementCategory, CashMovementType } from './models/cashMovement.model';
import { closingService } from '../closing/closing.service';
import { periodLockService } from '../finance/periodLock.service';
import { approvalService } from '../approvals/approval.service';
import { cashSettings } from '../../config/cashSettings';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';

export interface CreateCashMovementParams {
  type: CashMovementType;
  amount: number; // in integer paise
  category: CashMovementCategory;
  reason: string;
  note?: string;
  approvalToken?: string;
}

export const cashService = {
  /**
   * Records a cash in or cash out movement.
   * Large cash-out withdrawals above ₹2,000 require partner/manager role or manager approval token.
   */
  async createMovement(
    params: CreateCashMovementParams,
    userId: string,
    userRole: string
  ): Promise<ICashMovement> {
    if (params.amount <= 0) {
      throw new AppError('Amount must be greater than zero', 400);
    }

    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const localDate = nowIst.toFormat('yyyy-MM-dd');

    // Guard: Day closed
    await closingService.assertDayNotClosed(localDate);
    // Guard: Month finalized
    await periodLockService.assertMonthNotFinalized(localDate);

    let approvalTokenId: Types.ObjectId | undefined;
    let approvalApproverId: Types.ObjectId | undefined;

    // Check large cash-out threshold
    if (params.type === 'out' && params.amount > cashSettings.largeCashOutThresholdPaise) {
      const isManagerOrPartner = userRole === 'partner' || userRole === 'manager';

      if (!isManagerOrPartner) {
        if (!params.approvalToken) {
          throw new AppError(
            `Cash withdrawals above ₹${(cashSettings.largeCashOutThresholdPaise / 100).toFixed(2)} require manager approval`,
            403,
            'APPROVAL_REQUIRED',
            { action: 'cash.out_large' }
          );
        }

        const tokenInfo = await approvalService.consumeApprovalToken({
          rawToken: params.approvalToken,
          action: 'cash.out_large',
          entityId: 'cash_drawer',
          params: { amount: params.amount, reason: params.reason },
          userId,
        });

        approvalTokenId = tokenInfo.tokenDoc._id as Types.ObjectId;
        approvalApproverId = new Types.ObjectId(tokenInfo.approverId);
      }
    }

    const movement = await CashMovement.create({
      localDate,
      type: params.type,
      amount: params.amount,
      category: params.category,
      reason: params.reason.trim(),
      note: params.note?.trim(),
      recordedBy: new Types.ObjectId(userId),
      recordedAt: new Date(),
      status: 'recorded',
      approvalTokenId,
      approvalApproverId,
    });

    await auditService.log({
      actorId: userId,
      action: params.type === 'in' ? 'cash.in' : 'cash.out',
      entityType: 'CashMovement',
      entityId: movement._id.toString(),
      metadata: {
        localDate,
        amount: movement.amount,
        category: movement.category,
        reason: movement.reason,
        approvalApproverId: approvalApproverId ? approvalApproverId.toString() : undefined,
      },
    });

    return movement;
  },

  /**
   * Reverses a recorded cash movement (partner/manager only with mandatory reason).
   */
  async reverseMovement(id: string, reason: string, userId: string): Promise<ICashMovement> {
    const movement = await CashMovement.findById(id);
    if (!movement) throw new AppError('Cash movement not found', 404);
    if (movement.status === 'reversed') {
      throw new AppError('Cash movement is already reversed', 400);
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('A reason is mandatory to reverse a cash movement', 400);
    }

    // Guard: Day closed
    await closingService.assertDayNotClosed(movement.localDate);
    // Guard: Month finalized
    await periodLockService.assertMonthNotFinalized(movement.localDate);

    movement.status = 'reversed';
    movement.reversedBy = new Types.ObjectId(userId);
    movement.reversedAt = new Date();
    movement.reverseReason = reason.trim();
    await movement.save();

    await auditService.log({
      actorId: userId,
      action: 'cash.reversed',
      entityType: 'CashMovement',
      entityId: movement._id.toString(),
      metadata: {
        movementId: movement._id.toString(),
        amount: movement.amount,
        type: movement.type,
        reason: movement.reverseReason,
      },
    });

    return movement;
  },

  /**
   * Lists cash movements for an IST date (defaults to today).
   */
  async getMovements(date?: string): Promise<ICashMovement[]> {
    const nowIst = DateTime.now().setZone('Asia/Kolkata');
    const targetDate = date || nowIst.toFormat('yyyy-MM-dd');

    return CashMovement.find({ localDate: targetDate })
      .sort({ createdAt: -1 })
      .populate('recordedBy', 'name username')
      .populate('reversedBy', 'name username')
      .populate('approvalApproverId', 'name username');
  },
};
