import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { approvalService } from './approval.service';
import { APPROVABLE_ACTIONS, ApprovableAction } from '../../config/approvalActions';

const requestApprovalSchema = z.object({
  approverId: z.string().min(1, 'Approver ID is required'),
  pin: z.string().length(6, 'PIN must be 6 digits'),
  action: z.enum(APPROVABLE_ACTIONS as unknown as [ApprovableAction, ...ApprovableAction[]]),
  entityId: z.string().min(1, 'Entity ID is required'),
  params: z.unknown().optional(),
});

const setApprovalPinSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  pin: z.string().length(6, 'Approval PIN must be 6 digits'),
});

export const approvalController = {
  getApprovers: asyncHandler(async (_req: Request, res: Response) => {
    const approvers = await approvalService.getApprovers();
    res.status(200).json({
      success: true,
      data: approvers,
    });
  }),

  requestApproval: asyncHandler(async (req: Request, res: Response) => {
    const parsed = requestApprovalSchema.parse(req.body);

    const result = await approvalService.requestApproval({
      requestedBy: req.user!._id.toString(),
      approverId: parsed.approverId,
      pin: parsed.pin,
      action: parsed.action,
      entityId: parsed.entityId,
      params: parsed.params ?? {},
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }),

  setApprovalPin: asyncHandler(async (req: Request, res: Response) => {
    const parsed = setApprovalPinSchema.parse(req.body);

    await approvalService.setApprovalPin(req.user!._id.toString(), parsed.currentPassword, parsed.pin);

    res.status(200).json({
      success: true,
      message: 'Approval PIN updated successfully',
    });
  }),
};
