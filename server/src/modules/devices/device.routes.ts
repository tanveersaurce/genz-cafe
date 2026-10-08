import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { deviceController } from './device.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('devices:manage'));

router.get('/', deviceController.listDevices);
router.post('/', deviceController.registerDevice);
router.post('/:id/revoke', deviceController.revokeDevice);

export const deviceRoutes = router;
export default router;
