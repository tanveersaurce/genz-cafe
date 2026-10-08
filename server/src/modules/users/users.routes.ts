import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  userQuerySchema,
} from './users.validation';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// All user management routes require valid authentication + 'users:manage' permission (partner role)
router.use(authenticate, authorize('users:manage'));

router.get(
  '/',
  validateRequest({ query: userQuerySchema }),
  asyncHandler(usersController.list)
);

router.post(
  '/',
  validateRequest({ body: createUserSchema }),
  asyncHandler(usersController.create)
);

router.patch(
  '/:id',
  validateRequest({ body: updateUserSchema }),
  asyncHandler(usersController.update)
);

router.patch(
  '/:id/status',
  validateRequest({ body: updateStatusSchema }),
  asyncHandler(usersController.updateStatus)
);

router.post(
  '/:id/reset-password',
  asyncHandler(usersController.resetPassword)
);

router.post(
  '/:id/reset-login-pin',
  asyncHandler(usersController.resetLoginPin)
);

export const usersRouter = router;
