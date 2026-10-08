import { Request, Response } from 'express';
import { z } from 'zod';
import { customerOrderService } from './customerOrder.service';
import { asyncHandler } from '../../utils/asyncHandler';

const postCustomerOrderSchema = z.object({
  table: z.number().int().min(1).max(99),
  token: z.string().min(1),
  customerName: z.string().min(1).max(50),
  customerPhone: z.string().optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        variantName: z.string().optional(),
        qty: z.number().int().min(1).max(50),
        note: z.string().max(100).optional(),
      })
    )
    .min(1),
  idempotencyKey: z.string().min(1),
  honeypot: z.string().optional(),
});

export const getQrContext = asyncHandler(async (req: Request, res: Response) => {
  const tableNumber = parseInt(String(req.query.table), 10);
  const token = req.query.t ? String(req.query.t) : undefined;

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    res.status(200).json({
      success: true,
      data: {
        tableNumber: 0,
        orderingEnabled: false,
        reason: 'invalid_token',
      },
    });
    return;
  }

  const context = await customerOrderService.getQrContext(tableNumber, token);
  res.status(200).json({
    success: true,
    data: context,
  });
});

export const submitCustomerOrder = asyncHandler(async (req: Request, res: Response) => {
  const validated = postCustomerOrderSchema.parse(req.body);
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const result = await customerOrderService.submitCustomerOrder({
    tableNumber: validated.table,
    token: validated.token,
    customerName: validated.customerName,
    customerPhone: validated.customerPhone,
    lines: validated.lines,
    idempotencyKey: validated.idempotencyKey,
    honeypot: validated.honeypot,
    clientIp,
    userAgent,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

export const getSubmissionStatus = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = String(req.params.token);
  const result = await customerOrderService.getSubmissionStatus(rawToken);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const cancelSubmission = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = String(req.params.token);
  const result = await customerOrderService.cancelSubmission(rawToken);

  res.status(200).json({
    success: true,
    data: result,
  });
});
