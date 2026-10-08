import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { billService } from './bill.service';
import {
  recordPaymentSchema,
  voidBillSchema,
  reversePaymentSchema,
} from './order.validation';

export const billController = {
  getBillById: asyncHandler(async (req: Request, res: Response) => {
    const result = await billService.getBillById(req.params.id as string);
    res.json({
      success: true,
      data: result,
    });
  }),

  getBills: asyncHandler(async (req: Request, res: Response) => {
    const { date, status } = req.query;
    const bills = await billService.getBills({
      date: date ? String(date) : undefined,
      status: status ? String(status) : undefined,
    });

    res.json({
      success: true,
      data: { bills },
    });
  }),

  recordPayment: asyncHandler(async (req: Request, res: Response) => {
    const validated = recordPaymentSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const result = await billService.recordPayment(
      req.params.id as string,
      validated,
      userId
    );

    res.status(201).json({
      success: true,
      message: result.isDuplicate
        ? 'Payment already recorded (idempotent return)'
        : 'Payment recorded successfully',
      data: result,
    });
  }),

  voidBill: asyncHandler(async (req: Request, res: Response) => {
    const validated = voidBillSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();
    const userRole = req.user?.role;

    const result = await billService.voidBill(
      req.params.id as string,
      validated.reason,
      userId,
      userRole,
      validated.approvalToken
    );

    res.json({
      success: true,
      message: 'Bill voided successfully',
      data: result,
    });
  }),

  reversePayment: asyncHandler(async (req: Request, res: Response) => {
    const validated = reversePaymentSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const result = await billService.reversePayment(
      req.params.id as string,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: 'Payment reversed successfully',
      data: result,
    });
  }),
};
