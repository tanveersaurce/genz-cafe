import { Request, Response } from 'express';
import crypto from 'crypto';
import { Category } from './models/Category';
import { MenuItem } from './models/MenuItem';

export async function getPublicMenu(req: Request, res: Response) {
  // 1. Fetch active, non-archived categories sorted by sortOrder
  const categories = await Category.find({
    isActive: true,
    archivedAt: null,
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  // 2. Fetch active, non-archived items sorted by sortOrder
  const items = await MenuItem.find({
    isActive: true,
    archivedAt: null,
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  // 3. Group items by category and strip internal fields
  const categoryMap = new Map<string, Array<Record<string, unknown>>>();
  for (const cat of categories) {
    categoryMap.set(cat._id.toString(), []);
  }

  for (const item of items) {
    const catId = item.category.toString();
    const list = categoryMap.get(catId);
    if (list) {
      list.push({
        id: item._id.toString(),
        name: item.name,
        slug: item.slug,
        description: item.description,
        foodType: item.foodType,
        basePrice: item.basePrice, // in paise
        variants: item.variants.map((v) => ({
          name: v.name,
          price: v.price,
          isDefault: v.isDefault,
        })),
        gstRate: item.gstRate,
        image: item.image,
        tags: item.tags,
        isFeatured: item.isFeatured,
        isAvailable: item.isAvailable, // kitchen availability toggle (in-stock or out-of-stock)
        preparationMinutes: item.preparationMinutes,
        sortOrder: item.sortOrder,
      });
    }
  }

  const resultCategories = categories.map((cat) => ({
    id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    image: cat.image,
    sortOrder: cat.sortOrder,
    items: categoryMap.get(cat._id.toString()) || [],
  }));

  const payload = {
    success: true,
    data: {
      categories: resultCategories,
      totalItems: items.length,
    },
  };

  const payloadString = JSON.stringify(payload);
  const etag = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).send(payloadString);
}
