import { Router } from 'express';
import { tableController } from './table.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import {
  createTableSchema,
  updateTableSchema,
  toggleTableStatusSchema,
} from './table.validation';

const router = Router();

// All table endpoints require authentication
router.use(authenticate);

// tables:read => partner, manager, cashier, waiter
router.get('/', authorize('tables:read'), tableController.getTables);
router.get('/:id', authorize('tables:read'), tableController.getTableById);

// tables:manage => partner, manager
router.post(
  '/',
  authorize('tables:manage'),
  validateRequest({ body: createTableSchema }),
  tableController.createTable
);

router.patch(
  '/:id',
  authorize('tables:manage'),
  validateRequest({ body: updateTableSchema }),
  tableController.updateTable
);

router.patch(
  '/:id/status',
  authorize('tables:manage'),
  validateRequest({ body: toggleTableStatusSchema }),
  tableController.toggleTableStatus
);

// QR Token rotation (partner, manager)
router.post(
  '/:id/rotate-qr-token',
  authorize('qr:rotate-token'),
  tableController.rotateQrToken
);

router.post(
  '/rotate-all-qr-tokens',
  authorize('qr:rotate-token'),
  tableController.rotateAllQrTokens
);

export const tableRoutes = router;

