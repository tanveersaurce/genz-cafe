import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import { kitchenController } from './kitchen.controller';
import { updateKotStatusSchema } from './kitchen.validation';

const router = Router();
router.use(authenticate);

router.get('/board', authorize('kitchen:view'), kitchenController.getBoard);
router.post(
  '/kots/:kotId/status',
  authorize('kitchen:update'),
  validateRequest({ body: updateKotStatusSchema }),
  kitchenController.updateKotStatus
);

export const kitchenRoutes = router;
