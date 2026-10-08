import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { pnlController } from './pnl.controller';

const router = Router();
router.use(authenticate);

router.get('/pnl', authorize('finance:view'), pnlController.getPnl);
router.get('/pnl/trend', authorize('finance:view'), pnlController.getTrend);
router.get('/pnl/export', authorize('finance:view'), pnlController.exportCsv);

export const pnlRoutes = router;
