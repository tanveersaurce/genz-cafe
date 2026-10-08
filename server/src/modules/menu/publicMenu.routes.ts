import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getPublicMenu } from './publicMenu.controller';

const router = Router();

// Public read-only menu endpoint
router.get('/', asyncHandler(getPublicMenu));

export const publicMenuRoutes = router;
