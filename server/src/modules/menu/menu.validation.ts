import { z } from 'zod';
import { FOOD_TYPES, MENU_TAGS } from './models/MenuItem';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const categoryIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid category ID'),
});

export const menuItemIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid menu item ID'),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  description: z.string().trim().max(200, 'Description cannot exceed 200 characters').optional(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const reorderCategoriesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().regex(objectIdRegex, 'Invalid category ID'),
      sortOrder: z.number().int(),
    })
  ).min(1, 'Items list cannot be empty'),
});

const variantItemSchema = z.object({
  name: z.string().trim().min(1, 'Variant name is required'),
  price: z.number().int('Price must be an integer in paise').min(0, 'Price must be non-negative'),
  isDefault: z.boolean().default(false),
});

const validateVariantsRule = (variants?: Array<{ name: string; price: number; isDefault: boolean }>) => {
  if (!variants || variants.length === 0) return true;
  const defaultCount = variants.filter((v) => v.isDefault).length;
  return defaultCount === 1;
};

export const gstRateSchema = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(12),
  z.literal(18),
]);

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().trim().max(300, 'Description cannot exceed 300 characters').optional(),
  categoryId: z.string().regex(objectIdRegex, 'Invalid category ID'),
  foodType: z.enum(FOOD_TYPES, {
    errorMap: () => ({ message: 'Food type must be veg, non_veg, or egg' }),
  }),
  basePrice: z.number().int('Price must be integer in paise').min(0, 'Price must be non-negative'),
  variants: z.array(variantItemSchema).optional(),
  gstRate: gstRateSchema.optional().default(5),
  tags: z.array(z.enum(MENU_TAGS)).optional().default([]),
  isFeatured: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  preparationMinutes: z.number().int().min(0).optional(),
}).refine((data) => validateVariantsRule(data.variants), {
  message: 'If variants are provided, exactly one variant must be marked as default',
  path: ['variants'],
});

export const updateMenuItemSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(300).optional(),
  categoryId: z.string().regex(objectIdRegex, 'Invalid category ID').optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  gstRate: gstRateSchema.optional(),
  tags: z.array(z.enum(MENU_TAGS)).optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  preparationMinutes: z.number().int().min(0).optional(),
});

export const updatePriceSchema = z.object({
  basePrice: z.number().int('Base price must be an integer in paise').min(0).optional(),
  variants: z.array(variantItemSchema).optional(),
}).refine((data) => data.basePrice !== undefined || (data.variants && data.variants.length > 0), {
  message: 'Either basePrice or variants must be provided',
}).refine((data) => validateVariantsRule(data.variants), {
  message: 'If variants are provided, exactly one variant must be marked as default',
  path: ['variants'],
});

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean({ required_error: 'isAvailable status is required' }),
});

export const reorderMenuItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().regex(objectIdRegex, 'Invalid menu item ID'),
      sortOrder: z.number().int(),
    })
  ).min(1, 'Items list cannot be empty'),
});

export const menuItemQuerySchema = z.object({
  category: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  search: z.string().trim().optional(),
  isAvailable: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  includeArchived: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type ReorderMenuItemsInput = z.infer<typeof reorderMenuItemsSchema>;
export type MenuItemQueryInput = z.infer<typeof menuItemQuerySchema>;
