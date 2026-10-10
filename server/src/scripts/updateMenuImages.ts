import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { connectDB } from '../config/db';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { logger } from '../utils/logger';

interface ItemImageSource {
  name: string;
  url: string;
}

const IMAGE_SOURCES: ItemImageSource[] = [
  {
    name: 'Hazelnut Cappuccino',
    url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Café Mocha',
    url: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Biscoff Caramel Frappe',
    url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Iced Vietnamese Shakerato',
    url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Crispy Paneer Makhani Burger',
    url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Smoky BBQ Grilled Chicken Sandwich',
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Truffle Mushroom & Cheese Melt',
    url: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Egg & Jalapeño Breakfast Brioche',
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Peri-Peri Crinkle Fries',
    url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Cheesy Jalapeño Poppers',
    url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Crispy Chicken Tenders',
    url: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Warm Belgian Chocolate Brownie',
    url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Lotus Biscoff Baked Cheesecake',
    url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
  },
];

async function updateMenuImages() {
  await connectDB();
  logger.info('Connected to database to update menu images...');

  const uploadsDir = path.resolve(process.cwd(), 'uploads/menu');
  await fs.mkdir(uploadsDir, { recursive: true });

  for (const src of IMAGE_SOURCES) {
    const item = await MenuItem.findOne({ name: src.name });
    if (!item) {
      logger.warn({ name: src.name }, 'Menu item not found in DB, skipping');
      continue;
    }

    if (item.image?.thumbnail && item.image?.full) {
      logger.info({ name: src.name }, 'Item already has image, skipping');
      continue;
    }

    try {
      logger.info({ name: src.name, url: src.url }, 'Downloading image...');
      const res = await fetch(src.url);
      if (!res.ok) {
        throw new Error(`Failed to download image: HTTP ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Process full & thumbnail WebP buffers
      const [fullBuffer, thumbBuffer] = await Promise.all([
        sharp(inputBuffer)
          .rotate()
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toBuffer(),
        sharp(inputBuffer)
          .rotate()
          .resize({ width: 400, height: 400, fit: 'cover', position: 'center' })
          .webp({ quality: 75, effort: 4 })
          .toBuffer(),
      ]);

      const timestamp = Date.now();
      const cleanSlug = item.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fullFileName = `${cleanSlug}_${timestamp}_full.webp`;
      const thumbFileName = `${cleanSlug}_${timestamp}_thumb.webp`;

      await Promise.all([
        fs.writeFile(path.join(uploadsDir, fullFileName), fullBuffer),
        fs.writeFile(path.join(uploadsDir, thumbFileName), thumbBuffer),
      ]);

      item.image = {
        full: `/uploads/menu/${fullFileName}`,
        thumbnail: `/uploads/menu/${thumbFileName}`,
      };

      await item.save();
      logger.info({ name: item.name, image: item.image }, 'Successfully saved image for menu item');
    } catch (err) {
      logger.error({ name: src.name, err }, 'Failed to process image for menu item');
    }
  }

  logger.info('Menu images update finished.');
  process.exit(0);
}

updateMenuImages().catch((err) => {
  logger.error({ err }, 'updateMenuImages script failed');
  process.exit(1);
});
