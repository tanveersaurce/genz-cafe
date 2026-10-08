import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { statementController } from './statement.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize('finance:view'), statementController.listStatements);
router.get('/:month', authorize('finance:view'), statementController.getStatement);
router.get('/:month/prechecks', authorize('partners:manage'), statementController.getPreChecks);
router.get('/:month/preview', authorize('partners:manage'), statementController.previewStatement);
router.post('/:month/finalize', authorize('partners:manage'), statementController.finalizeStatement);
router.post('/:month/reopen', authorize('partners:manage'), statementController.reopenStatement);
router.get('/:month/pdf', authorize('finance:view'), statementController.downloadPdf);

export const statementRoutes = router;
