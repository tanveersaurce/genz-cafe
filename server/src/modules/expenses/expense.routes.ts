import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { expenseController } from './expense.controller';

const router = Router();
router.use(authenticate);

// Categories
router.get('/categories', authorize('expenses:read'), expenseController.listCategories);
router.post('/categories', authorize('expenses:create'), expenseController.createCategory);

// Vendors
router.get('/vendors', authorize('expenses:read'), expenseController.listVendors);
router.post('/vendors', authorize('expenses:create'), expenseController.createVendor);

// Recurring
router.get('/recurring', authorize('expenses:read'), expenseController.listRecurringTemplates);
router.post('/recurring', authorize('expenses:create'), expenseController.createRecurringTemplate);
router.post('/recurring/generate', authorize('expenses:create'), expenseController.generateRecurring);

// Expenses
router.get('/', authorize('expenses:read'), expenseController.listExpenses);
router.get('/:id', authorize('expenses:read'), expenseController.getExpense);
router.post('/', authorize('expenses:create'), expenseController.createExpense);
router.patch('/:id', authorize('expenses:edit'), expenseController.updateExpense);
router.post('/:id/void', authorize('expenses:void'), expenseController.voidExpense);
router.post('/:id/payments', authorize('expenses:create'), expenseController.addPayment);

export const expenseRoutes = router;
