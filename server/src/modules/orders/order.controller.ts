import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { orderService } from './order.service';
import { billService } from './bill.service';
import {
  createOrderSchema,
  addItemsSchema,
  updateItemSchema,
  cancelItemSchema,
  transferOrderSchema,
  applyDiscountSchema,
  cancelOrderSchema,
  reopenOrderSchema,
} from './order.validation';

export const orderController = {
  getLivePosTables: asyncHandler(async (_req: Request, res: Response) => {
    const tables = await orderService.getLivePosTables();
    res.json({
      success: true,
      data: { tables },
    });
  }),

  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const validated = createOrderSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const result = await orderService.createOrder({
      ...validated,
      openedBy: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Order opened successfully',
      data: result,
    });
  }),

  getOrderById: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.getOrderById(req.params.id as string);
    res.json({
      success: true,
      data: result,
    });
  }),

  getOrders: asyncHandler(async (req: Request, res: Response) => {
    const { date, status, type, search, page, limit } = req.query;
    const result = await orderService.getOrders({
      date: date ? String(date) : undefined,
      status: status ? String(status) : undefined,
      type: type ? String(type) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  }),

  addItems: asyncHandler(async (req: Request, res: Response) => {
    const validated = addItemsSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const order = await orderService.addItems(req.params.id as string, {
      ...validated,
      userId,
    });

    res.json({
      success: true,
      message: 'Items added to order',
      data: { order },
    });
  }),

  updateDraftItem: asyncHandler(async (req: Request, res: Response) => {
    const validated = updateItemSchema.parse(req.body);

    const order = await orderService.updateDraftItem(
      req.params.id as string,
      req.params.lineId as string,
      validated
    );

    res.json({
      success: true,
      message: 'Draft item updated',
      data: { order },
    });
  }),

  cancelItem: asyncHandler(async (req: Request, res: Response) => {
    const validated = cancelItemSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();
    const userRole = req.user?.role;

    const order = await orderService.cancelItem(
      req.params.id as string,
      req.params.lineId as string,
      validated.reason,
      userId,
      userRole,
      validated.approvalToken
    );

    res.json({
      success: true,
      message: 'Item cancelled',
      data: { order },
    });
  }),

  sendKot: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?._id.toString();
    const result = await orderService.sendKot(req.params.id as string, userId);

    res.json({
      success: true,
      message: `KOT ${result.kot.kotNo} sent to kitchen`,
      data: result,
    });
  }),

  transferTable: asyncHandler(async (req: Request, res: Response) => {
    const validated = transferOrderSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const order = await orderService.transferTable(
      req.params.id as string,
      validated.toTableId,
      userId
    );

    res.json({
      success: true,
      message: 'Table transferred successfully',
      data: { order },
    });
  }),

  applyDiscount: asyncHandler(async (req: Request, res: Response) => {
    const validated = applyDiscountSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();
    const userRole = req.user?.role;

    const order = await orderService.applyDiscount(
      req.params.id as string,
      validated,
      userId,
      userRole
    );

    res.json({
      success: true,
      message: 'Discount updated',
      data: { order },
    });
  }),

  reopenOrder: asyncHandler(async (req: Request, res: Response) => {
    const validated = reopenOrderSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const order = await orderService.reopenOrder(
      req.params.id as string,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: 'Order reopened',
      data: { order },
    });
  }),

  cancelOrder: asyncHandler(async (req: Request, res: Response) => {
    const validated = cancelOrderSchema.parse(req.body);
    const userId = req.user?.id || req.user?._id.toString();

    const order = await orderService.cancelOrder(
      req.params.id as string,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: 'Order cancelled',
      data: { order },
    });
  }),

  generateBill: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?._id.toString();
    const result = await billService.generateBill(req.params.id as string, userId);

    res.json({
      success: true,
      message: result.isIdempotentReturn
        ? 'Retrieved existing active bill'
        : 'Bill generated successfully',
      data: result,
    });
  }),

  getPendingCustomerOrders: asyncHandler(async (req: Request, res: Response) => {
    const { hasPermission } = await import('../auth/permissions');
    type StaffRole = import('../auth/permissions').Role;
    const { customerOrderService } = await import('./customerOrder.service');
    const userRole = (req.user?.role || 'cashier') as StaffRole;
    const canViewPhone = hasPermission(userRole, 'customerOrders:view-phone');

    const pending = await customerOrderService.getPendingCustomerOrders(canViewPhone);
    res.json({
      success: true,
      data: { orders: pending },
    });
  }),

  acknowledgeCustomerOrder: asyncHandler(async (req: Request, res: Response) => {
    const { customerOrderService } = await import('./customerOrder.service');
    const userId = req.user?.id || req.user?._id.toString();
    const submissionId = String(req.params.submissionId);

    const result = await customerOrderService.acknowledgeSubmission(submissionId, userId);
    res.json({
      success: true,
      data: result,
    });
  }),
};
