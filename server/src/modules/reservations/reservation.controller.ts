import { Request, Response } from 'express';
import { reservationService } from './reservation.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const reservationController = {
  getReservations: asyncHandler(async (req: Request, res: Response) => {
    const { date, status, search, page, limit } = req.query;

    const result = await reservationService.getStaffReservations({
      date: date ? String(date) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const date = req.query.date ? String(req.query.date) : undefined;
    const summary = await reservationService.getStaffReservationsSummary(date);
    res.status(200).json({
      success: true,
      data: { summary },
    });
  }),

  createReservation: asyncHandler(async (req: Request, res: Response) => {
    const reservation = await reservationService.createStaffReservation(
      req.body,
      req.user?.id,
      req.user?.name
    );
    res.status(201).json({
      success: true,
      data: { reservation },
    });
  }),

  updateReservation: asyncHandler(async (req: Request, res: Response) => {
    const reservation = await reservationService.updateStaffReservation(
      String(req.params.id),
      req.body,
      req.user?.id,
      req.user?.name
    );
    res.status(200).json({
      success: true,
      data: { reservation },
    });
  }),

  confirmReservation: asyncHandler(async (req: Request, res: Response) => {
    const tableIds = req.body.tableIds as string[] | undefined;
    const reservation = await reservationService.confirmReservation(
      String(req.params.id),
      tableIds,
      req.user?.id,
      req.user?.name
    );
    res.status(200).json({
      success: true,
      data: { reservation },
    });
  }),

  assignTables: asyncHandler(async (req: Request, res: Response) => {
    const tableIds = req.body.tableIds as string[];
    const reservation = await reservationService.assignTables(
      String(req.params.id),
      tableIds,
      req.user?.id,
      req.user?.name
    );
    res.status(200).json({
      success: true,
      data: { reservation },
    });
  }),

  transitionStatus: asyncHandler(async (req: Request, res: Response) => {
    const { status, reason } = req.body;
    const reservation = await reservationService.transitionStatus(
      String(req.params.id),
      status,
      reason,
      req.user?.id,
      req.user?.name
    );
    res.status(200).json({
      success: true,
      data: { reservation },
    });
  }),

  getBlocks: asyncHandler(async (_req: Request, res: Response) => {
    const blocks = await reservationService.getBlocks();
    res.status(200).json({
      success: true,
      data: { blocks },
    });
  }),

  createBlock: asyncHandler(async (req: Request, res: Response) => {
    const { startAt, endAt, reason } = req.body;
    const result = await reservationService.createBlock(
      startAt,
      endAt,
      reason,
      req.user?.id,
      req.user?.name
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  }),

  deleteBlock: asyncHandler(async (req: Request, res: Response) => {
    await reservationService.deleteBlock(String(req.params.id), req.user?.id, req.user?.name);
    res.status(200).json({
      success: true,
      message: 'Block removed successfully.',
    });
  }),
};
