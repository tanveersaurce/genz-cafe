import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize, authorizeAny } from '../../middleware/authorize';
import { billController } from './bill.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize('orders:read'), billController.getBills);
router.get('/:id', authorize('orders:read'), billController.getBillById);
router.post('/:id/payments', authorize('payments:record'), billController.recordPayment);
router.post(
  '/:id/void',
  authorizeAny('billing:void', 'approvals:request'),
  billController.voidBill
);

export const billRoutes = router;
