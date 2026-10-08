import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getQrContext,
  submitCustomerOrder,
  getSubmissionStatus,
  cancelSubmission,
} from './publicQr.controller';

const router = Router();

// NAT-friendly public rate limiter (120 req / minute for shared cafe Wi-Fi IP)
const publicQrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please wait a moment before trying again.',
    },
  },
});

router.use(publicQrLimiter);

router.get('/context', getQrContext);
router.post('/orders', submitCustomerOrder);
router.get('/status/:token', getSubmissionStatus);
router.post('/status/:token/cancel', cancelSubmission);

export { router as publicQrRoutes };
