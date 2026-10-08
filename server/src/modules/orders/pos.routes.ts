import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { orderController } from './order.controller';
import { kitchenController } from '../kitchen/kitchen.controller';

const router = Router();
router.use(authenticate);

router.get('/tables', authorize('pos:access'), orderController.getLivePosTables);
router.post('/kots/:kotId/served', authorize('orders:serve'), kitchenController.markKotServed);
router.get('/ready', authorize('orders:read'), kitchenController.getPosReadyKots);

// Customer self-orders tray & acknowledgment
router.get('/customer-orders/pending', authorize('orders:read'), orderController.getPendingCustomerOrders);
router.post('/customer-orders/:submissionId/acknowledge', authorize('orders:read'), orderController.acknowledgeCustomerOrder);

export const posRoutes = router;

