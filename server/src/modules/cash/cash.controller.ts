import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { cashService, CreateCashMovementParams } from './cash.service';
import { createCashMovementSchema, reverseCashMovementSchema } from './cash.validation';

export const cashController = {
  createMovement: asyncHandler(async (req: Request, res: Response) => {
    const validated = createCashMovementSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();
    const userRole = req.user!.role;

    const movement = await cashService.createMovement(validated as unknown as CreateCashMovementParams, userId, userRole);

    res.status(201).json({
      success: true,
      message: `Cash ${movement.type} recorded successfully`,
      data: { movement },
    });
  }),

  reverseMovement: asyncHandler(async (req: Request, res: Response) => {
    const validated = reverseCashMovementSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const movement = await cashService.reverseMovement(
      req.params.id as string,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: 'Cash movement reversed successfully',
      data: { movement },
    });
  }),

  getMovements: asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query;
    const movements = await cashService.getMovements(date ? String(date) : undefined);

    res.json({
      success: true,
      data: { movements },
    });
  }),
};
