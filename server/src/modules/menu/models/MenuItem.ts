import mongoose, { Schema, Document, Types } from 'mongoose';

export const FOOD_TYPES = ['veg', 'non_veg', 'egg'] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

export const GST_RATES = [0, 5, 12, 18] as const;
export type GstRate = (typeof GST_RATES)[number];

export const MENU_TAGS = [
  'bestseller',
  'chef_special',
  'new',
  'spicy',
  'jain',
  'sugar_free',
] as const;
export type MenuTag = (typeof MENU_TAGS)[number];

export interface IMenuItemVariant {
  name: string;
  price: number; // in paise
  isDefault: boolean;
}

export interface IMenuItemImage {
  full: string;
  thumbnail: string;
}

export interface IMenuItem extends Document {
  name: string;
  slug: string;
  description?: string;
  category: Types.ObjectId;
  foodType: FoodType;
  basePrice: number; // in paise, integer >= 0
  variants: IMenuItemVariant[];
  gstRate: GstRate;
  image?: IMenuItemImage;
  tags: MenuTag[];
  isFeatured: boolean;
  isAvailable: boolean;
  isActive: boolean;
  archivedAt?: Date | null;
  sortOrder: number;
  preparationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IMenuItemVariant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Variant price in paise must be non-negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Variant price must be an integer in paise',
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const menuItemSchema = new Schema<IMenuItem>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    foodType: {
      type: String,
      enum: FOOD_TYPES,
      required: true,
      index: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: [0, 'Base price in paise must be non-negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Base price must be an integer in paise',
      },
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    gstRate: {
      type: Number,
      enum: GST_RATES,
      default: 5,
    },
    image: {
      full: { type: String },
      thumbnail: { type: String },
    },
    tags: {
      type: [{ type: String, enum: MENU_TAGS }],
      default: [],
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    preparationMinutes: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for category ordering
menuItemSchema.index({ category: 1, sortOrder: 1 });

// Full-text search index for searching menu items by name or description
menuItemSchema.index({ name: 'text', description: 'text' });

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
