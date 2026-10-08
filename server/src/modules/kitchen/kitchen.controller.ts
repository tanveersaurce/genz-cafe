import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { kitchenService } from './kitchen.service';
import { UpdateKotStatusInput } from './kitchen.validation';

export const kitchenController = {
  getBoard: asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const board = await kitchenService.getKitchenBoard();
    res.status(200).json({
      success: true,
      data: board,
    });
  }),

  updateKotStatus: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { kotId } = req.params;
    const { to, expectedFrom } = req.body as UpdateKotStatusInput;
    const userId = req.user!.id;

    const result = await kitchenService.updateKotStatus(kotId!, to, expectedFrom, userId);
    res.status(200).json({
      success: true,
      data: {
        kot: result.kot,
        idempotent: result.idempotent,
      },
    });
  }),

  markKotServed: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { kotId } = req.params;
    const userId = req.user!.id;

    const result = await kitchenService.markKotServed(kotId!, userId);
    res.status(200).json({
      success: true,
      data: {
        kot: result.kot,
        idempotent: result.idempotent,
      },
    });
  }),

  getPosReadyKots: asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const readyKots = await kitchenService.getPosReadyKots();
    res.status(200).json({
      success: true,
      data: readyKots,
    });
  }),
};

