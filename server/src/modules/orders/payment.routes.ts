import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { billController } from './bill.controller';

const router = Router();
router.use(authenticate);

router.post('/:id/reverse', authorize('billing:void'), billController.reversePayment);

export const paymentRoutes = router;
