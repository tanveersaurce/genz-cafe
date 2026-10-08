import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Category } from './models/Category';
import { MenuItem } from './models/MenuItem';
import { MenuPriceHistory } from './models/MenuPriceHistory';
import { defaultStorageProvider } from './storage/LocalStorageProvider';
import { processMenuImage } from './menu.image';
import { slugify } from './menu.utils';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { realtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS, REALTIME_ROOMS } from '../../config/realtimeEvents';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
  UpdatePriceInput,
  UpdateAvailabilityInput,
  ReorderMenuItemsInput,
  MenuItemQueryInput,
} from './menu.validation';

// ==========================================
// CATEGORY CONTROLLERS
// ==========================================

export async function listCategories(req: Request, res: Response) {
  const includeArchived = req.query.includeArchived === 'true';
  const filter: Record<string, unknown> = {};
  if (!includeArchived) {
    filter.archivedAt = null;
  }

  const categories = await Category.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();

  // Attach active item count for each category
  const counts = await MenuItem.aggregate([
    { $match: { archivedAt: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>(
    counts.map((c: { _id: Types.ObjectId; count: number }) => [c._id.toString(), c.count])
  );

  const data = categories.map((cat) => ({
    ...cat,
    id: cat._id.toString(),
    itemCount: countMap.get(cat._id.toString()) || 0,
  }));

  res.status(200).json({
    success: true,
    data,
  });
}

export async function createCategory(req: Request, res: Response) {
  const input = req.body as CreateCategoryInput;
  const actor = req.user;

  // Check if category name exists (case-insensitive)
  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
  });
  if (existing) {
    throw new AppError(`Category "${input.name}" already exists`, 409);
  }

  // Generate unique slug
  let baseSlug = slugify(input.name);
  let slug = baseSlug;
  let counter = 1;
  while (await Category.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const category = await Category.create({
    name: input.name.trim(),
    slug,
    description: input.description?.trim(),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    archivedAt: null,
  });

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.category.create',
    entityType: 'Category',
    entityId: category._id.toString(),
    metadata: { name: category.name, slug: category.slug },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    data: {
      ...category.toObject(),
      id: category._id.toString(),
      itemCount: 0,
    },
  });
}

export async function updateCategory(req: Request, res: Response) {
  const { id } = req.params;
  const input = req.body as UpdateCategoryInput;
  const actor = req.user;

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  if (input.name && input.name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const existing = await Category.findOne({
      _id: { $ne: category._id },
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new AppError(`Category "${input.name}" already exists`, 409);
    }

    let baseSlug = slugify(input.name);
    let slug = baseSlug;
    let counter = 1;
    while (await Category.findOne({ _id: { $ne: category._id }, slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    category.name = input.name.trim();
    category.slug = slug;
  }

  if (input.description !== undefined) category.description = input.description.trim();
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) category.isActive = input.isActive;

  await category.save();

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.category.update',
    entityType: 'Category',
    entityId: category._id.toString(),
    metadata: { updates: input },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    data: {
      ...category.toObject(),
      id: category._id.toString(),
    },
  });
}

export async function archiveCategory(req: Request, res: Response) {
  const { id } = req.params;
  const actor = req.user;

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  // Soft-delete rule: A category with active items cannot be archived
  const activeItemCount = await MenuItem.countDocuments({
    category: category._id,
    archivedAt: null,
  });

  if (activeItemCount > 0) {
    throw new AppError(
      `Cannot archive category "${category.name}" because it contains ${activeItemCount} active menu item(s). Please archive or move the items first.`,
      400
    );
  }

  category.archivedAt = new Date();
  category.isActive = false;
  await category.save();

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.category.archive',
    entityType: 'Category',
    entityId: category._id.toString(),
    metadata: { name: category.name },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    message: `Category "${category.name}" archived successfully`,
  });
}

export async function reorderCategories(req: Request, res: Response) {
  const { items } = req.body as ReorderCategoriesInput;
  const actor = req.user;

  const bulkOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { sortOrder: item.sortOrder } },
    },
  }));

  await Category.bulkWrite(bulkOps);

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.category.reorder',
    entityType: 'Category',
    metadata: { count: items.length },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    message: 'Categories reordered successfully',
  });
}

// ==========================================
// MENU ITEM CONTROLLERS
// ==========================================

export async function listItems(req: Request, res: Response) {
  const query = req.query as unknown as MenuItemQueryInput;

  const filter: Record<string, unknown> = {};

  if (!query.includeArchived) {
    filter.archivedAt = null;
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.foodType) {
    filter.foodType = query.foodType;
  }

  if (query.isAvailable !== undefined) {
    filter.isAvailable = query.isAvailable;
  }

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  const items = await MenuItem.find(filter)
    .populate('category', 'name slug')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const formatted = items.map((item) => ({
    ...item,
    id: item._id.toString(),
  }));

  res.status(200).json({
    success: true,
    data: formatted,
  });
}

export async function createItem(req: Request, res: Response) {
  const input = req.body as CreateMenuItemInput;
  const actor = req.user;

  // Validate category
  const category = await Category.findOne({ _id: input.categoryId, archivedAt: null });
  if (!category) {
    throw new AppError('Selected category does not exist or has been archived', 400);
  }

  // Generate unique slug
  let baseSlug = slugify(input.name);
  let slug = baseSlug;
  let counter = 1;
  while (await MenuItem.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  // Variant rule: If variants are provided, basePrice equals the default variant's price
  let basePrice = input.basePrice;
  if (input.variants && input.variants.length > 0) {
    const defaultVariant = input.variants.find((v) => v.isDefault);
    if (defaultVariant) {
      basePrice = defaultVariant.price;
    }
  }

  const item = await MenuItem.create({
    name: input.name.trim(),
    slug,
    description: input.description?.trim(),
    category: new Types.ObjectId(input.categoryId),
    foodType: input.foodType,
    basePrice,
    variants: input.variants || [],
    gstRate: input.gstRate ?? 5,
    tags: input.tags || [],
    isFeatured: input.isFeatured ?? false,
    isAvailable: input.isAvailable ?? true,
    sortOrder: input.sortOrder ?? 0,
    preparationMinutes: input.preparationMinutes,
    archivedAt: null,
  });

  // Record initial price history
  if (actor) {
    const priceHistories = [];
    priceHistories.push({
      itemId: item._id,
      variantName: null,
      oldPrice: 0,
      newPrice: basePrice,
      changedBy: new Types.ObjectId(actor.id),
      changedAt: new Date(),
    });

    if (item.variants && item.variants.length > 0) {
      for (const variant of item.variants) {
        priceHistories.push({
          itemId: item._id,
          variantName: variant.name,
          oldPrice: 0,
          newPrice: variant.price,
          changedBy: new Types.ObjectId(actor.id),
          changedAt: new Date(),
        });
      }
    }

    await MenuPriceHistory.insertMany(priceHistories);
  }

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.create',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: { name: item.name, basePrice: item.basePrice },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const populated = await MenuItem.findById(item._id).populate('category', 'name slug').lean();

  res.status(201).json({
    success: true,
    data: {
      ...populated,
      id: item._id.toString(),
    },
  });
}

export async function updateItem(req: Request, res: Response) {
  const { id } = req.params;
  const input = req.body as UpdateMenuItemInput;
  const actor = req.user;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  if (input.name && input.name.trim() !== item.name) {
    let baseSlug = slugify(input.name);
    let slug = baseSlug;
    let counter = 1;
    while (await MenuItem.findOne({ _id: { $ne: item._id }, slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    item.name = input.name.trim();
    item.slug = slug;
  }

  if (input.categoryId) {
    const category = await Category.findOne({ _id: input.categoryId, archivedAt: null });
    if (!category) {
      throw new AppError('Target category does not exist or has been archived', 400);
    }
    item.category = new Types.ObjectId(input.categoryId);
  }

  if (input.description !== undefined) item.description = input.description.trim();
  if (input.foodType !== undefined) item.foodType = input.foodType;
  if (input.gstRate !== undefined) item.gstRate = input.gstRate;
  if (input.tags !== undefined) item.tags = input.tags;
  if (input.isFeatured !== undefined) item.isFeatured = input.isFeatured;
  if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
  if (input.preparationMinutes !== undefined) item.preparationMinutes = input.preparationMinutes;

  await item.save();

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.update',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: { updates: input },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const populated = await MenuItem.findById(item._id).populate('category', 'name slug').lean();

  res.status(200).json({
    success: true,
    data: {
      ...populated,
      id: item._id.toString(),
    },
  });
}

export async function updateItemPrice(req: Request, res: Response) {
  const { id } = req.params;
  const input = req.body as UpdatePriceInput;
  const actor = req.user;

  if (!actor) {
    throw new AppError('Unauthorized', 401);
  }

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  const priceHistories: Array<{
    itemId: Types.ObjectId;
    variantName: string | null;
    oldPrice: number;
    newPrice: number;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }> = [];

  // Determine new base price and updated variants
  let newBasePrice = item.basePrice;
  if (input.variants && input.variants.length > 0) {
    const defaultVariant = input.variants.find((v) => v.isDefault);
    if (defaultVariant) {
      newBasePrice = defaultVariant.price;
    }

    // Check each variant's price change against current variants
    const currentVariantMap = new Map<string, number>(
      item.variants.map((v) => [v.name.toLowerCase(), v.price])
    );

    for (const v of input.variants) {
      const oldPrice = currentVariantMap.get(v.name.toLowerCase()) ?? 0;
      if (oldPrice !== v.price) {
        priceHistories.push({
          itemId: item._id,
          variantName: v.name,
          oldPrice,
          newPrice: v.price,
          changedBy: new Types.ObjectId(actor.id),
          changedAt: new Date(),
        });
      }
    }

    item.variants = input.variants;
  } else if (input.basePrice !== undefined) {
    newBasePrice = input.basePrice;
  }

  if (newBasePrice !== item.basePrice) {
    priceHistories.push({
      itemId: item._id,
      variantName: null,
      oldPrice: item.basePrice,
      newPrice: newBasePrice,
      changedBy: new Types.ObjectId(actor.id),
      changedAt: new Date(),
    });
    item.basePrice = newBasePrice;
  }

  await item.save();

  if (priceHistories.length > 0) {
    await MenuPriceHistory.insertMany(priceHistories);
  }

  await auditService.log({
    actorId: actor.id,
    actorName: actor.name,
    action: 'menu.item.price_change',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: {
      oldBasePrice: priceHistories[0]?.oldPrice,
      newBasePrice: item.basePrice,
      changesCount: priceHistories.length,
    },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const populated = await MenuItem.findById(item._id).populate('category', 'name slug').lean();

  res.status(200).json({
    success: true,
    data: {
      ...populated,
      id: item._id.toString(),
    },
  });
}

export async function updateItemAvailability(req: Request, res: Response) {
  const { id } = req.params;
  const { isAvailable } = req.body as UpdateAvailabilityInput;
  const actor = req.user;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  item.isAvailable = isAvailable;
  await item.save();

  realtimeService.emit(
    REALTIME_EVENTS.MENU_AVAILABILITY_CHANGED,
    [REALTIME_ROOMS.MENU, REALTIME_ROOMS.POS, REALTIME_ROOMS.KITCHEN],
    {
      menuItemId: item._id.toString(),
      isAvailable: item.isAvailable,
    }
  );

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.availability',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: { isAvailable },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    data: {
      id: item._id.toString(),
      isAvailable: item.isAvailable,
    },
    message: `Item marked as ${isAvailable ? 'available' : 'out of stock'}`,
  });
}

export async function archiveItem(req: Request, res: Response) {
  const { id } = req.params;
  const actor = req.user;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  item.archivedAt = new Date();
  item.isActive = false;
  await item.save();

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.archive',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: { name: item.name },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    message: `Menu item "${item.name}" archived successfully`,
  });
}

export async function reorderItems(req: Request, res: Response) {
  const { items } = req.body as ReorderMenuItemsInput;
  const actor = req.user;

  const bulkOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { sortOrder: item.sortOrder } },
    },
  }));

  await MenuItem.bulkWrite(bulkOps);

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.reorder',
    entityType: 'MenuItem',
    metadata: { count: items.length },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    message: 'Menu items reordered successfully',
  });
}

export async function uploadItemImage(req: Request, res: Response) {
  const { id } = req.params;
  const actor = req.user;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  if (!req.file || !req.file.buffer) {
    throw new AppError('Image file is required', 400);
  }

  // Process image with Sharp and validate magic bytes
  const { fullBuffer, thumbBuffer } = await processMenuImage(req.file.buffer);

  // If item already had an image, remove old files
  if (item.image?.full) {
    await defaultStorageProvider.deleteImage({
      full: item.image.full,
      thumbnail: item.image.thumbnail,
    });
  }

  const storedResult = await defaultStorageProvider.saveImage(
    fullBuffer,
    thumbBuffer,
    item.slug || 'menu-item'
  );

  item.image = storedResult;
  await item.save();

  await auditService.log({
    actorId: actor?.id,
    actorName: actor?.name,
    action: 'menu.item.image_upload',
    entityType: 'MenuItem',
    entityId: item._id.toString(),
    metadata: { image: storedResult },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json({
    success: true,
    data: {
      id: item._id.toString(),
      image: item.image,
    },
    message: 'Image uploaded and processed successfully',
  });
}

export async function deleteItemImage(req: Request, res: Response) {
  const { id } = req.params;
  const actor = req.user;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  if (item.image) {
    await defaultStorageProvider.deleteImage({
      full: item.image.full,
      thumbnail: item.image.thumbnail,
    });
    item.image = undefined;
    await item.save();

    await auditService.log({
      actorId: actor?.id,
      actorName: actor?.name,
      action: 'menu.item.image_delete',
      entityType: 'MenuItem',
      entityId: item._id.toString(),
      metadata: {},
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  res.status(200).json({
    success: true,
    message: 'Item image deleted successfully',
  });
}

export async function getPriceHistory(req: Request, res: Response) {
  const { id } = req.params;

  const item = await MenuItem.findById(id);
  if (!item) {
    throw new AppError('Menu item not found', 404);
  }

  const history = await MenuPriceHistory.find({ itemId: item._id })
    .populate('changedBy', 'name username role')
    .sort({ changedAt: -1 })
    .lean();

  const formatted = history.map((h) => ({
    ...h,
    id: h._id.toString(),
  }));

  res.status(200).json({
    success: true,
    data: formatted,
  });
}
