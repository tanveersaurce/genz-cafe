import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { cashController } from './cash.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize('cash:record'), cashController.getMovements);
router.post('/', authorize('cash:record'), cashController.createMovement);
router.post('/:id/reverse', authorize('closing:view'), cashController.reverseMovement);

export const cashRoutes = router;
