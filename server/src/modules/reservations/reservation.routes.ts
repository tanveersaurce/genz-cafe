import { Router } from 'express';
import { reservationController } from './reservation.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import {
  staffCreateReservationSchema,
  staffUpdateReservationSchema,
  staffConfirmReservationSchema,
  staffAssignTablesSchema,
  staffStatusTransitionSchema,
  createBlockSchema,
} from './reservation.validation';

const router = Router();

// All staff reservation endpoints require authentication
router.use(authenticate);

// 1. Blocks endpoints (must come before /:id routes to avoid route param collisions)
router.get(
  '/blocks',
  authorize('reservations:manage'),
  reservationController.getBlocks
);

router.post(
  '/blocks',
  authorize('reservations:manage'),
  validateRequest({ body: createBlockSchema }),
  reservationController.createBlock
);

router.delete(
  '/blocks/:id',
  authorize('reservations:manage'),
  reservationController.deleteBlock
);

// 2. Summary counts (for nav badges & dashboard metrics)
router.get(
  '/summary',
  authorize('reservations:read'),
  reservationController.getSummary
);

// 3. Main reservation queries (reservations:read => partner, manager, cashier, waiter)
router.get(
  '/',
  authorize('reservations:read'),
  reservationController.getReservations
);

// 4. Staff booking actions (reservations:manage => partner, manager, cashier)
router.post(
  '/',
  authorize('reservations:manage'),
  validateRequest({ body: staffCreateReservationSchema }),
  reservationController.createReservation
);

router.patch(
  '/:id',
  authorize('reservations:manage'),
  validateRequest({ body: staffUpdateReservationSchema }),
  reservationController.updateReservation
);

router.post(
  '/:id/confirm',
  authorize('reservations:manage'),
  validateRequest({ body: staffConfirmReservationSchema }),
  reservationController.confirmReservation
);

router.post(
  '/:id/assign-tables',
  authorize('reservations:manage'),
  validateRequest({ body: staffAssignTablesSchema }),
  reservationController.assignTables
);

router.post(
  '/:id/status',
  authorize('reservations:manage'),
  validateRequest({ body: staffStatusTransitionSchema }),
  reservationController.transitionStatus
);

export const reservationRoutes = router;
