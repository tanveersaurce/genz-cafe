import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { approvalController } from './approval.controller';

const router = Router();

// Rate limiter for PIN verification attempts (max 10 requests per minute per IP)
const approvalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many approval attempts. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

// List eligible approvers
router.get('/approvers', authorize('approvals:request'), approvalController.getApprovers);

// Request approval token with manager PIN
router.post('/', authorize('approvals:request'), approvalRateLimiter, approvalController.requestApproval);

export const approvalRoutes = router;
export default router;
