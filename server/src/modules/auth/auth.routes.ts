import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validate';
import { loginSchema, changePasswordSchema } from './auth.validation';
import { asyncHandler } from '../../utils/asyncHandler';

import { authorize } from '../../middleware/authorize';
import { approvalController } from '../approvals/approval.controller';

const router = Router();

// Strict rate limiter for login route to defend against credential stuffing / brute force
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Max 15 attempts per 15-minute window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    },
  },
});

const pinLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Max 20 PIN login attempts per 15-minute window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_PIN_ATTEMPTS',
      message: 'Too many PIN login attempts. Please try again later or use password login.',
    },
  },
});

router.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login)
);

// Fast PIN login on trusted devices
router.get('/pin/users', asyncHandler(authController.getPinUsers));
router.post('/pin/login', pinLoginRateLimiter, asyncHandler(authController.loginWithPin));

router.post('/refresh', asyncHandler(authController.refresh));

router.post('/logout', asyncHandler(authController.logout));

router.get('/me', authenticate, asyncHandler(authController.me));

router.post(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword)
);

// Set / change own approval PIN (partners & managers)
router.post(
  '/approval-pin',
  authenticate,
  authorize('pin:manage-own'),
  approvalController.setApprovalPin
);

// Set / change own fast login PIN (staff)
router.post(
  '/login-pin',
  authenticate,
  authorize('pin:manage-own'),
  asyncHandler(authController.setLoginPin)
);

export const authRouter = router;
