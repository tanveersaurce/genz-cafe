import { Request, Response } from 'express';
import { tableService } from './table.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const tableController = {
  getTables: asyncHandler(async (req: Request, res: Response) => {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const isReservable = req.query.isReservable !== undefined ? req.query.isReservable === 'true' : undefined;

    const tables = await tableService.getAllTables({ isActive, isReservable });
    res.status(200).json({
      success: true,
      data: { tables },
    });
  }),

  getTableById: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.getTableById(String(req.params.id));
    res.status(200).json({
      success: true,
      data: { table },
    });
  }),

  createTable: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.createTable(req.body, req.user?.id, req.user?.name);
    res.status(201).json({
      success: true,
      data: { table },
    });
  }),

  updateTable: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.updateTable(String(req.params.id), req.body, req.user?.id, req.user?.name);
    res.status(200).json({
      success: true,
      data: { table },
    });
  }),

  toggleTableStatus: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.toggleTableStatus(String(req.params.id), req.body.isActive, req.user?.id, req.user?.name);
    res.status(200).json({
      success: true,
      data: { table },
    });
  }),

  rotateQrToken: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.rotateQrToken(String(req.params.id), req.user?.id, req.user?.name);
    res.status(200).json({
      success: true,
      data: { table },
    });
  }),

  rotateAllQrTokens: asyncHandler(async (req: Request, res: Response) => {
    const result = await tableService.rotateAllQrTokens(req.user?.id, req.user?.name);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
};
