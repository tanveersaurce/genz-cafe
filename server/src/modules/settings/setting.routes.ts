import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getQrOrderingStatus, updateQrOrderingStatus } from './setting.controller';

const router = Router();

// Staff endpoints for runtime kill switch
router.get('/qr-ordering', authenticate, getQrOrderingStatus);
router.patch('/qr-ordering', authenticate, updateQrOrderingStatus);

export { router as settingRoutes };
