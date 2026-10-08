import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { expenseService } from './expense.service';
import { ExpenseCategory } from './models/expenseCategory.model';
import { Vendor } from './models/vendor.model';
import { RecurringExpenseTemplate } from './models/recurringTemplate.model';
import { Expense } from './models/expense.model';
import {
  createExpenseSchema,
  updateExpenseSchema,
  voidExpenseSchema,
  addPaymentSchema,
  createCategorySchema,
  createVendorSchema,
  createRecurringTemplateSchema,
} from './expense.validation';
import { AppError } from '../../utils/AppError';
import { Types } from 'mongoose';

export const expenseController = {
  // Categories
  listCategories: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await ExpenseCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: categories });
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const data = createCategorySchema.parse(req.body);
    const category = new ExpenseCategory(data);
    await category.save();
    res.status(201).json({ success: true, data: category });
  }),

  // Vendors
  listVendors: asyncHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.all !== 'true';
    const filter = activeOnly ? { isActive: true } : {};
    const vendors = await Vendor.find(filter).sort({ name: 1 }).populate('category', 'name');
    res.json({ success: true, data: vendors });
  }),

  createVendor: asyncHandler(async (req: Request, res: Response) => {
    const data = createVendorSchema.parse(req.body);
    const vendor = new Vendor({
      ...data,
      category: data.category ? new Types.ObjectId(data.category) : undefined,
    });
    await vendor.save();
    res.status(201).json({ success: true, data: vendor });
  }),

  // Expenses
  listExpenses: asyncHandler(async (req: Request, res: Response) => {
    const { from, to, categoryId, vendorId, status, paymentStatus, search, page, limit } = req.query;
    const result = await expenseService.listExpenses({
      from: from as string | undefined,
      to: to as string | undefined,
      categoryId: categoryId as string | undefined,
      vendorId: vendorId as string | undefined,
      status: status as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, data: result });
  }),

  getExpense: asyncHandler(async (req: Request, res: Response) => {
    const expense = await Expense.findById(req.params.id)
      .populate('categoryId', 'name type')
      .populate('vendorId', 'name gstin contactPerson phone email')
      .populate('createdBy', 'name email')
      .populate('payments.paidBy', 'name email')
      .populate('payments.paidByPartnerId', 'name');
    if (!expense) throw new AppError('Expense not found', 404);
    res.json({ success: true, data: expense });
  }),

  createExpense: asyncHandler(async (req: Request, res: Response) => {
    const data = createExpenseSchema.parse(req.body);
    const expense = await expenseService.createExpense(
      data,
      req.user!._id.toString(),
      req.user!.role
    );
    res.status(201).json({ success: true, data: expense });
  }),

  updateExpense: asyncHandler(async (req: Request, res: Response) => {
    const data = updateExpenseSchema.parse(req.body);
    const expense = await expenseService.updateExpense(
      req.params.id as string,
      data,
      req.user!._id.toString(),
      req.user!.role
    );
    res.json({ success: true, data: expense });
  }),

  voidExpense: asyncHandler(async (req: Request, res: Response) => {
    const { reason } = voidExpenseSchema.parse(req.body);
    const expense = await expenseService.voidExpense(
      req.params.id as string,
      reason,
      req.user!._id.toString()
    );
    res.json({ success: true, data: expense });
  }),

  addPayment: asyncHandler(async (req: Request, res: Response) => {
    const data = addPaymentSchema.parse(req.body);
    const expense = await expenseService.addPayment(
      req.params.id as string,
      data,
      req.user!._id.toString()
    );
    res.json({ success: true, data: expense });
  }),

  // Recurring Templates
  listRecurringTemplates: asyncHandler(async (_req: Request, res: Response) => {
    const templates = await RecurringExpenseTemplate.find()
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name type')
      .populate('vendorId', 'name')
      .populate('paidByPartnerId', 'name');
    res.json({ success: true, data: templates });
  }),

  createRecurringTemplate: asyncHandler(async (req: Request, res: Response) => {
    const data = createRecurringTemplateSchema.parse(req.body);
    const template = new RecurringExpenseTemplate({
      ...data,
      categoryId: new Types.ObjectId(data.categoryId),
      vendorId: data.vendorId ? new Types.ObjectId(data.vendorId) : undefined,
      paidByPartnerId: data.paidByPartnerId ? new Types.ObjectId(data.paidByPartnerId) : undefined,
      createdBy: new Types.ObjectId(req.user!._id.toString()),
    });
    await template.save();
    res.status(201).json({ success: true, data: template });
  }),

  generateRecurring: asyncHandler(async (req: Request, res: Response) => {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Valid month in YYYY-MM format is required', 400);
    }
    const generated = await expenseService.generateRecurringExpenses(
      month,
      req.user!._id.toString()
    );
    res.json({ success: true, data: { count: generated.length, items: generated } });
  }),
};
