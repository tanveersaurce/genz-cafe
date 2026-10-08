import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { menuUpload } from './menu.upload';
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  reorderCategories,
  listItems,
  createItem,
  updateItem,
  updateItemPrice,
  updateItemAvailability,
  archiveItem,
  reorderItems,
  uploadItemImage,
  deleteItemImage,
  getPriceHistory,
} from './menu.controller';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  updatePriceSchema,
  updateAvailabilitySchema,
  reorderMenuItemsSchema,
} from './menu.validation';

const router = Router();

// Protect all admin menu routes
router.use(authenticate);

// ==========================================
// CATEGORIES
// ==========================================
router.get('/categories', authorize('menu:read'), asyncHandler(listCategories));
router.post(
  '/categories',
  authorize('menu:write'),
  validateRequest({ body: createCategorySchema }),
  asyncHandler(createCategory)
);
router.post(
  '/categories/reorder',
  authorize('menu:write'),
  validateRequest({ body: reorderCategoriesSchema }),
  asyncHandler(reorderCategories)
);
router.patch(
  '/categories/:id',
  authorize('menu:write'),
  validateRequest({ body: updateCategorySchema }),
  asyncHandler(updateCategory)
);
router.delete('/categories/:id', authorize('menu:delete'), asyncHandler(archiveCategory));

// ==========================================
// MENU ITEMS
// ==========================================
router.get('/items', authorize('menu:read'), asyncHandler(listItems));
router.post(
  '/items',
  authorize('menu:write'),
  validateRequest({ body: createMenuItemSchema }),
  asyncHandler(createItem)
);
router.post(
  '/items/reorder',
  authorize('menu:write'),
  validateRequest({ body: reorderMenuItemsSchema }),
  asyncHandler(reorderItems)
);
router.patch(
  '/items/:id',
  authorize('menu:write'),
  validateRequest({ body: updateMenuItemSchema }),
  asyncHandler(updateItem)
);
router.patch(
  '/items/:id/price',
  authorize('menu:price'),
  validateRequest({ body: updatePriceSchema }),
  asyncHandler(updateItemPrice)
);
router.patch(
  '/items/:id/availability',
  authorize('menu:availability'),
  validateRequest({ body: updateAvailabilitySchema }),
  asyncHandler(updateItemAvailability)
);
router.delete('/items/:id', authorize('menu:delete'), asyncHandler(archiveItem));

// Images
router.post(
  '/items/:id/image',
  authorize('menu:write'),
  menuUpload.single('image'),
  asyncHandler(uploadItemImage)
);
router.delete('/items/:id/image', authorize('menu:write'), asyncHandler(deleteItemImage));

// Price audit history
router.get('/items/:id/price-history', authorize('menu:read'), asyncHandler(getPriceHistory));

export const menuRoutes = router;
