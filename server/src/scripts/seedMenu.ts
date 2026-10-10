import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Category } from '../modules/menu/models/Category';
import { MenuItem, FoodType, MenuTag, GstRate } from '../modules/menu/models/MenuItem';
import { MenuPriceHistory } from '../modules/menu/models/MenuPriceHistory';
import { User } from '../modules/auth/models/User';
import { slugify } from '../modules/menu/menu.utils';
import { logger } from '../utils/logger';

interface SeedCategory {
  name: string;
  description: string;
  sortOrder: number;
}

interface SeedItem {
  name: string;
  categoryName: string;
  description: string;
  foodType: FoodType;
  basePrice: number; // in paise
  variants?: Array<{ name: string; price: number; isDefault: boolean }>;
  gstRate?: GstRate;
  image?: { full: string; thumbnail: string };
  tags?: MenuTag[];
  isFeatured?: boolean;
  preparationMinutes?: number;
  sortOrder: number;
}

const CATEGORIES: SeedCategory[] = [
  {
    name: 'Hot Brews',
    description: 'Freshly roasted single-origin Arabica & Robusta espresso selections',
    sortOrder: 1,
  },
  {
    name: 'Cold Brews & Frappes',
    description: 'Slow-steeped cold brews and velvety blended coffee frappes',
    sortOrder: 2,
  },
  {
    name: 'Gourmet Burgers & Sandwiches',
    description: 'Toasted brioche & sourdough sandwiches loaded with house sauces',
    sortOrder: 3,
  },
  {
    name: 'Loaded Bites & Finger Food',
    description: 'Crispy finger foods, loaded wedges, and sharable munchies',
    sortOrder: 4,
  },
  {
    name: 'Artisanal Desserts',
    description: 'Decadent cheesecakes, warm fudge brownies, and sweet treats',
    sortOrder: 5,
  },
];

const ITEMS: SeedItem[] = [
  // 1. Hot Brews
  {
    name: 'Classic Espresso',
    categoryName: 'Hot Brews',
    description: 'A concentrated shot of pure dark-roast coffee with rich hazelnut crema.',
    foodType: 'veg',
    basePrice: 12000, // ₹120
    variants: [
      { name: 'Single Shot', price: 12000, isDefault: true },
      { name: 'Double Shot (Doppio)', price: 16000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/classic-espresso_1791552801412_full.webp',
      thumbnail: '/uploads/menu/classic-espresso_1791552801412_thumb.webp',
    },
    tags: ['bestseller'],
    isFeatured: true,
    preparationMinutes: 4,
    sortOrder: 1,
  },
  {
    name: 'Hazelnut Cappuccino',
    categoryName: 'Hot Brews',
    description: 'Steamed milk and velvety espresso infused with toasted hazelnut notes.',
    foodType: 'veg',
    basePrice: 19000, // ₹190
    variants: [
      { name: 'Regular (250ml)', price: 19000, isDefault: true },
      { name: 'Large (350ml)', price: 23000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/hazelnut-cappuccino_1791554417799_full.webp',
      thumbnail: '/uploads/menu/hazelnut-cappuccino_1791554417799_thumb.webp',
    },
    tags: ['chef_special', 'bestseller'],
    isFeatured: true,
    preparationMinutes: 5,
    sortOrder: 2,
  },
  {
    name: 'Café Mocha',
    categoryName: 'Hot Brews',
    description: 'Rich dark Belgian cocoa melted into double espresso with microfoam milk.',
    foodType: 'veg',
    basePrice: 21000, // ₹210
    variants: [
      { name: 'Regular', price: 21000, isDefault: true },
      { name: 'Large', price: 25000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/caf-mocha_1791554418304_full.webp',
      thumbnail: '/uploads/menu/caf-mocha_1791554418304_thumb.webp',
    },
    tags: ['new'],
    isFeatured: false,
    preparationMinutes: 6,
    sortOrder: 3,
  },

  // 2. Cold Brews & Frappes
  {
    name: 'Vanilla Sweet Cream Cold Brew',
    categoryName: 'Cold Brews & Frappes',
    description: '18-hour cold brew topped with house-whipped vanilla sweet cream.',
    foodType: 'veg',
    basePrice: 22000, // ₹220
    gstRate: 5,
    image: {
      full: '/uploads/menu/vanilla-sweet-cream-cold-brew_1791553626241_full.webp',
      thumbnail: '/uploads/menu/vanilla-sweet-cream-cold-brew_1791553626241_thumb.webp',
    },
    tags: ['bestseller'],
    isFeatured: true,
    preparationMinutes: 5,
    sortOrder: 1,
  },
  {
    name: 'Biscoff Caramel Frappe',
    categoryName: 'Cold Brews & Frappes',
    description: 'Blended espresso with Lotus Biscoff spread, crushed cookies, and caramel drizzle.',
    foodType: 'veg',
    basePrice: 26000, // ₹260
    variants: [
      { name: 'Regular (350ml)', price: 26000, isDefault: true },
      { name: 'Jumbo (500ml)', price: 31000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/biscoff-caramel-frappe_1791554418878_full.webp',
      thumbnail: '/uploads/menu/biscoff-caramel-frappe_1791554418878_thumb.webp',
    },
    tags: ['bestseller', 'chef_special'],
    isFeatured: true,
    preparationMinutes: 7,
    sortOrder: 2,
  },
  {
    name: 'Iced Vietnamese Shakerato',
    categoryName: 'Cold Brews & Frappes',
    description: 'Dark roast espresso shaken vigorously over ice with sweetened condensed milk.',
    foodType: 'veg',
    basePrice: 20000, // ₹200
    gstRate: 5,
    image: {
      full: '/uploads/menu/iced-vietnamese-shakerato_1791554419267_full.webp',
      thumbnail: '/uploads/menu/iced-vietnamese-shakerato_1791554419267_thumb.webp',
    },
    tags: ['new'],
    isFeatured: false,
    preparationMinutes: 5,
    sortOrder: 3,
  },

  // 3. Gourmet Burgers & Sandwiches
  {
    name: 'Crispy Paneer Makhani Burger',
    categoryName: 'Gourmet Burgers & Sandwiches',
    description: 'Golden spiced paneer patty glazed with butter makhani gravy on toasted brioche.',
    foodType: 'veg',
    basePrice: 24000, // ₹240
    gstRate: 5,
    image: {
      full: '/uploads/menu/crispy-paneer-makhani-burger_1791554419555_full.webp',
      thumbnail: '/uploads/menu/crispy-paneer-makhani-burger_1791554419555_thumb.webp',
    },
    tags: ['bestseller'],
    isFeatured: true,
    preparationMinutes: 12,
    sortOrder: 1,
  },
  {
    name: 'Smoky BBQ Grilled Chicken Sandwich',
    categoryName: 'Gourmet Burgers & Sandwiches',
    description: 'Herb-grilled chicken breast, melted cheddar, caramelized onions on rustic sourdough.',
    foodType: 'non_veg',
    basePrice: 28000, // ₹280
    gstRate: 5,
    image: {
      full: '/uploads/menu/smoky-bbq-grilled-chicken-sandwich_1791554419850_full.webp',
      thumbnail: '/uploads/menu/smoky-bbq-grilled-chicken-sandwich_1791554419850_thumb.webp',
    },
    tags: ['chef_special'],
    isFeatured: true,
    preparationMinutes: 15,
    sortOrder: 2,
  },
  {
    name: 'Truffle Mushroom & Cheese Melt',
    categoryName: 'Gourmet Burgers & Sandwiches',
    description: 'Sautéed portobello and button mushrooms, mozzarella, truffle aioli on panini.',
    foodType: 'veg',
    basePrice: 26000, // ₹260
    gstRate: 5,
    image: {
      full: '/uploads/menu/truffle-mushroom-cheese-melt_1791554420307_full.webp',
      thumbnail: '/uploads/menu/truffle-mushroom-cheese-melt_1791554420307_thumb.webp',
    },
    tags: ['chef_special'],
    isFeatured: false,
    preparationMinutes: 12,
    sortOrder: 3,
  },
  {
    name: 'Egg & Jalapeño Breakfast Brioche',
    categoryName: 'Gourmet Burgers & Sandwiches',
    description: 'Double fluffy scrambled eggs, pickled jalapeños, cheddar cheese, and chipotle mayo.',
    foodType: 'egg',
    basePrice: 21000, // ₹210
    gstRate: 5,
    image: {
      full: '/uploads/menu/egg-jalape-o-breakfast-brioche_1791554420515_full.webp',
      thumbnail: '/uploads/menu/egg-jalape-o-breakfast-brioche_1791554420515_thumb.webp',
    },
    tags: ['spicy'],
    isFeatured: false,
    preparationMinutes: 10,
    sortOrder: 4,
  },

  // 4. Loaded Bites & Finger Food
  {
    name: 'Peri-Peri Crinkle Fries',
    categoryName: 'Loaded Bites & Finger Food',
    description: 'Crispy crinkle-cut fries tossed in hot African peri-peri seasoning with garlic dip.',
    foodType: 'veg',
    basePrice: 15000, // ₹150
    variants: [
      { name: 'Regular', price: 15000, isDefault: true },
      { name: 'Large Bucket', price: 21000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/peri-peri-crinkle-fries_1791555047041_full.webp',
      thumbnail: '/uploads/menu/peri-peri-crinkle-fries_1791555047041_thumb.webp',
    },
    tags: ['spicy', 'bestseller'],
    isFeatured: true,
    preparationMinutes: 8,
    sortOrder: 1,
  },
  {
    name: 'Cheesy Jalapeño Poppers',
    categoryName: 'Loaded Bites & Finger Food',
    description: 'Crispy crumbed bites bursting with molten cheddar, mozzarella, and fiery peppers.',
    foodType: 'veg',
    basePrice: 22000, // ₹220
    gstRate: 5,
    image: {
      full: '/uploads/menu/cheesy-jalape-o-poppers_1791554421128_full.webp',
      thumbnail: '/uploads/menu/cheesy-jalape-o-poppers_1791554421128_thumb.webp',
    },
    tags: ['spicy'],
    isFeatured: false,
    preparationMinutes: 9,
    sortOrder: 2,
  },
  {
    name: 'Crispy Chicken Tenders',
    categoryName: 'Loaded Bites & Finger Food',
    description: 'Southern spiced tender chicken strips fried golden, served with honey mustard.',
    foodType: 'non_veg',
    basePrice: 27000, // ₹270
    gstRate: 5,
    image: {
      full: '/uploads/menu/crispy-chicken-tenders_1791554421429_full.webp',
      thumbnail: '/uploads/menu/crispy-chicken-tenders_1791554421429_thumb.webp',
    },
    tags: ['bestseller'],
    isFeatured: true,
    preparationMinutes: 12,
    sortOrder: 3,
  },

  // 5. Artisanal Desserts
  {
    name: 'Warm Belgian Chocolate Brownie',
    categoryName: 'Artisanal Desserts',
    description: 'Gooey dark chocolate fudge brownie with walnuts, served warm with chocolate drizzle.',
    foodType: 'egg',
    basePrice: 18000, // ₹180
    variants: [
      { name: 'Classic Brownie', price: 18000, isDefault: true },
      { name: 'Brownie à la Mode (with Ice Cream)', price: 23000, isDefault: false },
    ],
    gstRate: 5,
    image: {
      full: '/uploads/menu/warm-belgian-chocolate-brownie_1791554421814_full.webp',
      thumbnail: '/uploads/menu/warm-belgian-chocolate-brownie_1791554421814_thumb.webp',
    },
    tags: ['bestseller'],
    isFeatured: true,
    preparationMinutes: 5,
    sortOrder: 1,
  },
  {
    name: 'Lotus Biscoff Baked Cheesecake',
    categoryName: 'Artisanal Desserts',
    description: 'New York style velvety baked cheesecake crowned with cookie butter and biscuit crumb.',
    foodType: 'veg',
    basePrice: 25000, // ₹250
    gstRate: 5,
    image: {
      full: '/uploads/menu/lotus-biscoff-baked-cheesecake_1791554422067_full.webp',
      thumbnail: '/uploads/menu/lotus-biscoff-baked-cheesecake_1791554422067_thumb.webp',
    },
    tags: ['chef_special', 'bestseller'],
    isFeatured: true,
    preparationMinutes: 4,
    sortOrder: 2,
  },
];

async function seedMenu() {
  await connectDB();

  logger.info('Starting idempotent menu seed process...');

  // Find partner admin user to associate initial price changes
  const admin = await User.findOne({ role: 'partner' });
  const adminId = admin?._id;

  // 1. Seed Categories
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();

  for (const catData of CATEGORIES) {
    const slug = slugify(catData.name);
    let category = await Category.findOne({ slug });

    if (!category) {
      category = await Category.create({
        name: catData.name,
        slug,
        description: catData.description,
        sortOrder: catData.sortOrder,
        isActive: true,
        archivedAt: null,
      });
      logger.info({ name: category.name }, 'Created category');
    } else {
      category.name = catData.name;
      category.description = catData.description;
      category.sortOrder = catData.sortOrder;
      category.archivedAt = null;
      category.isActive = true;
      await category.save();
      logger.info({ name: category.name }, 'Updated category');
    }

    categoryMap.set(catData.name, category._id);
  }

  // 2. Seed Menu Items
  for (const itemData of ITEMS) {
    const categoryId = categoryMap.get(itemData.categoryName);
    if (!categoryId) {
      logger.warn({ category: itemData.categoryName }, 'Category not found for item, skipping');
      continue;
    }

    const slug = slugify(itemData.name);
    let item = await MenuItem.findOne({ slug });

    // Enforce default variant price rule
    let basePrice = itemData.basePrice;
    if (itemData.variants && itemData.variants.length > 0) {
      const defaultVariant = itemData.variants.find((v) => v.isDefault);
      if (defaultVariant) {
        basePrice = defaultVariant.price;
      }
    }

    if (!item) {
      item = await MenuItem.create({
        name: itemData.name,
        slug,
        description: itemData.description,
        category: categoryId,
        foodType: itemData.foodType,
        basePrice,
        variants: itemData.variants || [],
        gstRate: itemData.gstRate ?? 5,
        image: itemData.image,
        tags: itemData.tags || [],
        isFeatured: itemData.isFeatured ?? false,
        isAvailable: true,
        isActive: true,
        archivedAt: null,
        sortOrder: itemData.sortOrder,
        preparationMinutes: itemData.preparationMinutes,
      });

      // Price history
      if (adminId) {
        const histories = [];
        histories.push({
          itemId: item._id,
          variantName: null,
          oldPrice: 0,
          newPrice: basePrice,
          changedBy: adminId,
          changedAt: new Date(),
        });
        if (item.variants && item.variants.length > 0) {
          for (const v of item.variants) {
            histories.push({
              itemId: item._id,
              variantName: v.name,
              oldPrice: 0,
              newPrice: v.price,
              changedBy: adminId,
              changedAt: new Date(),
            });
          }
        }
        await MenuPriceHistory.insertMany(histories);
      }

      logger.info({ name: item.name }, 'Created menu item');
    } else {
      item.name = itemData.name;
      item.description = itemData.description;
      item.category = categoryId;
      item.foodType = itemData.foodType;
      item.basePrice = basePrice;
      item.variants = itemData.variants || [];
      item.gstRate = itemData.gstRate ?? 5;
      item.tags = itemData.tags || [];
      item.isFeatured = itemData.isFeatured ?? false;
      item.sortOrder = itemData.sortOrder;
      item.preparationMinutes = itemData.preparationMinutes;
      if (itemData.image && (!item.image || !item.image.thumbnail)) {
        item.image = itemData.image;
      }
      item.archivedAt = null;
      item.isActive = true;
      await item.save();
      logger.info({ name: item.name }, 'Updated menu item');
    }
  }

  logger.info('Menu seeding completed successfully!');
  await mongoose.disconnect();
}

seedMenu().catch((err) => {
  logger.error({ err }, 'Menu seeding failed');
  process.exit(1);
});
