import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { auditViewerController } from './auditViewer.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('audit:view'));

// Method Not Allowed guard to ensure audit log is strictly immutable
const rejectMutations = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Audit logs are immutable. Mutations are strictly prohibited.',
      },
    });
    return;
  }
  next();
};

router.use(rejectMutations);

router.get('/', auditViewerController.getAuditLogs);
router.get('/actions', auditViewerController.getDistinctActions);
router.get('/export.csv', auditViewerController.exportCsv);

export const auditViewerRoutes = router;
