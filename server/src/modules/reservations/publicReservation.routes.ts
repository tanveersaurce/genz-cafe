import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { publicReservationController } from './publicReservation.controller';
import { validateRequest } from '../../middleware/validate';
import {
  publicAvailabilityQuerySchema,
  publicCreateReservationSchema,
  publicLookupSchema,
  publicCancelSchema,
} from './reservation.validation';

const router = Router();

// 1. Availability rate limiter (60 requests per 15 min per IP)
const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many availability lookups. Please try again shortly.',
    },
  },
});

// 2. Booking creation rate limiter (10 attempts per 15 min per IP)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many booking requests. Please wait a few minutes before trying again.',
    },
  },
});

// 3. Lookup & Cancel rate limiter (20 requests per 15 min per IP)
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many lookup attempts. Please try again later.',
    },
  },
});

router.get(
  '/availability',
  availabilityLimiter,
  validateRequest({ query: publicAvailabilityQuerySchema }),
  publicReservationController.getAvailability
);

router.post(
  '/',
  bookingLimiter,
  validateRequest({ body: publicCreateReservationSchema }),
  publicReservationController.createReservation
);

router.post(
  '/lookup',
  lookupLimiter,
  validateRequest({ body: publicLookupSchema }),
  publicReservationController.lookupReservation
);

router.post(
  '/cancel',
  lookupLimiter,
  validateRequest({ body: publicCancelSchema }),
  publicReservationController.cancelReservation
);

export const publicReservationRoutes = router;
