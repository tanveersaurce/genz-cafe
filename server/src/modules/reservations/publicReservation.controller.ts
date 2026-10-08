import { Request, Response } from 'express';
import { reservationService } from './reservation.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const publicReservationController = {
  getAvailability: asyncHandler(async (req: Request, res: Response) => {
    const date = req.query.date as string;
    const guests = parseInt(req.query.guests as string, 10);

    const slots = await reservationService.getAvailability(date, guests);
    res.status(200).json({
      success: true,
      data: { slots },
    });
  }),

  createReservation: asyncHandler(async (req: Request, res: Response) => {
    const result = await reservationService.createPublicReservation(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  }),

  lookupReservation: asyncHandler(async (req: Request, res: Response) => {
    const { code, phone } = req.body;
    const reservation = await reservationService.lookupReservation(code, phone);
    res.status(200).json({
      success: true,
      data: { reservation },
    });
  }),

  cancelReservation: asyncHandler(async (req: Request, res: Response) => {
    const { code, phone, reason } = req.body;
    const result = await reservationService.cancelReservationByCustomer(code, phone, reason);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
};
