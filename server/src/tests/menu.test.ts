import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { Category } from '../modules/menu/models/Category';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { MenuPriceHistory } from '../modules/menu/models/MenuPriceHistory';
import { authService } from '../modules/auth/auth.service';
import { Role } from '../modules/auth/permissions';

describe('Menu Module & RBAC Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  // Helper to create a user with a given role and return their access token
  async function createStaffAndLogin(username: string, role: Role): Promise<{ token: string; user: InstanceType<typeof User> }> {
    const passwordHash = await authService.hashPassword('Password@123');
    const user = await User.create({
      name: `${role} User`,
      username,
      passwordHash,
      role,
      isActive: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      username,
      password: 'Password@123',
    });

    return { token: res.body.data.accessToken, user };
  }

  it('marketing role can create categories and items, but is FORBIDDEN from updating prices or archiving', async () => {
    const { token: marketingToken } = await createStaffAndLogin('marketing1', 'marketing');

    // 1. Marketing can create category
    const catRes = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        name: 'Artisan Teas',
        description: 'Selected loose leaf brews',
      });

    expect(catRes.status).toBe(201);
    expect(catRes.body.data.slug).toBe('artisan-teas');
    const categoryId = catRes.body.data.id;

    // 2. Marketing can create menu item
    const itemRes = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        name: 'Kashmiri Kahwa',
        categoryId,
        foodType: 'veg',
        basePrice: 18000, // ₹180
        description: 'Green tea infused with saffron, cinnamon, and slivered almonds',
        tags: ['chef_special'],
      });

    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.id;

    // 3. Marketing CANNOT update prices (403 Forbidden)
    const priceRes = await request(app)
      .patch(`/api/menu/items/${itemId}/price`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        basePrice: 20000,
      });

    expect(priceRes.status).toBe(403);

    // 4. Marketing CANNOT archive/delete item (403 Forbidden)
    const deleteItemRes = await request(app)
      .delete(`/api/menu/items/${itemId}`)
      .set('Authorization', `Bearer ${marketingToken}`);

    expect(deleteItemRes.status).toBe(403);

    // 5. Marketing CANNOT archive/delete category (403 Forbidden)
    const deleteCatRes = await request(app)
      .delete(`/api/menu/categories/${categoryId}`)
      .set('Authorization', `Bearer ${marketingToken}`);

    expect(deleteCatRes.status).toBe(403);
  });

  it('kitchen role can toggle availability but cannot edit item details or create items', async () => {
    const { token: _partnerToken } = await createStaffAndLogin('partner_adm', 'partner');
    const { token: kitchenToken } = await createStaffAndLogin('chef1', 'kitchen');

    // Partner creates category and item
    const cat = await Category.create({ name: 'Shakes', slug: 'shakes', sortOrder: 1 });
    const item = await MenuItem.create({
      name: 'Chocolate Shake',
      slug: 'chocolate-shake',
      category: cat._id,
      foodType: 'veg',
      basePrice: 22000,
      isAvailable: true,
    });

    // Kitchen toggles availability to false (out of stock)
    const availRes = await request(app)
      .patch(`/api/menu/items/${item._id}/availability`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ isAvailable: false });

    expect(availRes.status).toBe(200);
    expect(availRes.body.data.isAvailable).toBe(false);

    // Kitchen tries to change item details (403 Forbidden)
    const editRes = await request(app)
      .patch(`/api/menu/items/${item._id}`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ name: 'Dark Chocolate Shake' });

    expect(editRes.status).toBe(403);

    // Kitchen tries to create item (403 Forbidden)
    const createRes = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({
        name: 'New Item',
        categoryId: cat._id.toString(),
        foodType: 'veg',
        basePrice: 10000,
      });

    expect(createRes.status).toBe(403);
  });

  it('waiter role cannot create or edit menu items', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const cat = await Category.create({ name: 'Sides', slug: 'sides', sortOrder: 1 });

    const createRes = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        name: 'Garlic Bread',
        categoryId: cat._id.toString(),
        foodType: 'veg',
        basePrice: 12000,
      });

    expect(createRes.status).toBe(403);
  });

  it('soft-delete rule: category with active items CANNOT be archived', async () => {
    const { token: partnerToken } = await createStaffAndLogin('partner_adm2', 'partner');

    const cat = await Category.create({ name: 'Pizzas', slug: 'pizzas', sortOrder: 1 });
    const item = await MenuItem.create({
      name: 'Margherita Pizza',
      slug: 'margherita-pizza',
      category: cat._id,
      foodType: 'veg',
      basePrice: 35000,
      archivedAt: null,
    });

    // Attempt to delete category when item is active
    const deleteCatRes = await request(app)
      .delete(`/api/menu/categories/${cat._id}`)
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(deleteCatRes.status).toBe(400);
    expect(deleteCatRes.body.error.message).toContain('active menu item');

    // Archive the item first
    const deleteItemRes = await request(app)
      .delete(`/api/menu/items/${item._id}`)
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(deleteItemRes.status).toBe(200);

    // Now category deletion succeeds
    const deleteCatSuccessRes = await request(app)
      .delete(`/api/menu/categories/${cat._id}`)
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(deleteCatSuccessRes.status).toBe(200);

    const updatedCat = await Category.findById(cat._id);
    expect(updatedCat?.archivedAt).not.toBeNull();
    expect(updatedCat?.isActive).toBe(false);
  });

  it('price updates record append-only price history entries', async () => {
    const { token: managerToken, user: managerUser } = await createStaffAndLogin('manager1', 'manager');

    const cat = await Category.create({ name: 'Coffee', slug: 'coffee', sortOrder: 1 });
    const item = await MenuItem.create({
      name: 'Americano',
      slug: 'americano',
      category: cat._id,
      foodType: 'veg',
      basePrice: 15000, // ₹150
    });

    // Update base price to ₹170 (17000 paise)
    const priceRes = await request(app)
      .patch(`/api/menu/items/${item._id}/price`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ basePrice: 17000 });

    expect(priceRes.status).toBe(200);
    expect(priceRes.body.data.basePrice).toBe(17000);

    // Check MenuPriceHistory
    const history = await MenuPriceHistory.find({ itemId: item._id });
    expect(history.length).toBe(1);
    expect(history[0].oldPrice).toBe(15000);
    expect(history[0].newPrice).toBe(17000);
    expect(history[0].changedBy.toString()).toBe(managerUser._id.toString());
  });

  it('public menu returns clean data with ETag and 30s caching', async () => {
    const cat1 = await Category.create({ name: 'Coolers', slug: 'coolers', sortOrder: 1, isActive: true });
    const _cat2 = await Category.create({ name: 'Archived Cat', slug: 'archived-cat', sortOrder: 2, isActive: false, archivedAt: new Date() });

    await MenuItem.create({
      name: 'Mint Mojito',
      slug: 'mint-mojito',
      category: cat1._id,
      foodType: 'veg',
      basePrice: 18000,
      isAvailable: false, // Out of stock, but still returned to public
      isActive: true,
      archivedAt: null,
    });

    await MenuItem.create({
      name: 'Archived Cooler',
      slug: 'archived-cooler',
      category: cat1._id,
      foodType: 'veg',
      basePrice: 14000,
      isActive: false,
      archivedAt: new Date(),
    });

    const res = await request(app).get('/api/public/menu');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    expect(res.headers['etag']).toBeDefined();

    const data = res.body.data;
    // Only 1 active category
    expect(data.categories.length).toBe(1);
    expect(data.categories[0].name).toBe('Coolers');

    // Only 1 active item (archived item excluded, out of stock included)
    const items = data.categories[0].items;
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Mint Mojito');
    expect(items[0].isAvailable).toBe(false);

    // Internal fields stripped
    expect(items[0]).not.toHaveProperty('archivedAt');
    expect(items[0]).not.toHaveProperty('__v');
    expect(items[0]).not.toHaveProperty('createdAt');
    expect(items[0]).not.toHaveProperty('updatedAt');

    // Test 304 Not Modified
    const etag = res.headers['etag'];
    const res304 = await request(app).get('/api/public/menu').set('If-None-Match', etag);
    expect(res304.status).toBe(304);
  });

  it('magic-byte validation rejects spoofed fake image files', async () => {
    const { token: managerToken } = await createStaffAndLogin('manager2', 'manager');
    const cat = await Category.create({ name: 'Bakery', slug: 'bakery', sortOrder: 1 });
    const item = await MenuItem.create({
      name: 'Croissant',
      slug: 'croissant',
      category: cat._id,
      foodType: 'veg',
      basePrice: 16000,
    });

    // Upload a text file with .jpg extension
    const fakeImageBuffer = Buffer.from('This is a text string not an image payload');

    const res = await request(app)
      .post(`/api/menu/items/${item._id}/image`)
      .set('Authorization', `Bearer ${managerToken}`)
      .attach('image', fakeImageBuffer, { filename: 'spoofed.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid image format');
  });
});
