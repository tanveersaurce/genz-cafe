import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { closingController } from './closing.controller';

const router = Router();
router.use(authenticate);

router.get('/preview', authorize('closing:perform'), closingController.getPreview);
router.post('/', authorize('closing:perform'), closingController.submitClosing);
router.get('/', authorize('closing:view'), closingController.listClosings);
router.get('/:date', authorize('closing:view'), closingController.getClosingByDate);
router.post('/:date/reopen', authorize('closing:reopen'), closingController.reopenClosing);

export const closingRoutes = router;
