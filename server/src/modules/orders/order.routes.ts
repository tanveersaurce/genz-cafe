import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize, authorizeAny } from '../../middleware/authorize';
import { orderController } from './order.controller';

const router = Router();
router.use(authenticate);

router.post('/', authorize('orders:create'), orderController.createOrder);
router.get('/', authorize('orders:read'), orderController.getOrders);
router.get('/:id', authorize('orders:read'), orderController.getOrderById);

router.post('/:id/items', authorize('orders:create'), orderController.addItems);
router.patch('/:id/items/:lineId', authorize('orders:create'), orderController.updateDraftItem);
router.post(
  '/:id/items/:lineId/cancel',
  authorizeAny('orders:cancel', 'approvals:request'),
  orderController.cancelItem
);

router.post('/:id/send-kot', authorize('orders:create'), orderController.sendKot);
router.post('/:id/transfer', authorize('orders:create'), orderController.transferTable);
router.post(
  '/:id/discount',
  authorizeAny('orders:discount', 'approvals:request'),
  orderController.applyDiscount
);
router.post('/:id/reopen', authorize('orders:reopen'), orderController.reopenOrder);
router.post('/:id/cancel', authorize('orders:cancel'), orderController.cancelOrder);
router.post('/:id/bill', authorize('billing:create'), orderController.generateBill);

export const orderRoutes = router;
