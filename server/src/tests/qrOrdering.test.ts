import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { Category } from '../modules/menu/models/Category';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { Table } from '../modules/tables/table.model';
import { Order } from '../modules/orders/models/order.model';
import { CustomerSubmission } from '../modules/orders/models/customerSubmission.model';
import { authService } from '../modules/auth/auth.service';
import { Role } from '../modules/auth/permissions';
import { settingService } from '../modules/settings/setting.service';
import { phoneRetentionService } from '../services/phoneRetention.service';

describe('QR Dine-In Self-Ordering Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    settingService.clearCache();
    await Order.syncIndexes();
    await CustomerSubmission.syncIndexes();
  });

  async function createStaffAndLogin(username: string, role: Role) {
    const passwordHash = await authService.hashPassword('Password@123');
    const user = await User.create({
      name: `${role} Staff`,
      username,
      passwordHash,
      role,
      isActive: true,
    });

    const token = authService.generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    return { token, user };
  }

  async function seedTestEnvironment() {
    const table = await Table.create({
      number: 5,
      label: 'Window Booth 5',
      capacity: 4,
      zone: 'window',
      isReservable: true,
      isActive: true,
      sortOrder: 1,
      qrToken: 'test-table-token-5',
    });

    const cat = await Category.create({
      name: 'Drinks',
      slug: 'drinks',
      sortOrder: 1,
      isActive: true,
    });

    const coffee = await MenuItem.create({
      name: 'Artisan Pour Over',
      slug: 'artisan-pour-over',
      category: cat._id,
      foodType: 'veg',
      basePrice: 15000, // ₹150
      variants: [
        { name: 'Light Roast', price: 15000, isDefault: true },
        { name: 'Dark Roast', price: 18000, isDefault: false },
      ],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 1,
    });

    const bagel = await MenuItem.create({
      name: 'Cream Cheese Bagel',
      slug: 'cream-cheese-bagel',
      category: cat._id,
      foodType: 'veg',
      basePrice: 20000, // ₹200
      variants: [],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 2,
    });

    return { table, coffee, bagel };
  }

  it('1. Concurrency: Two customers submitting simultaneously on the same free table', async () => {
    const { table, coffee, bagel } = await seedTestEnvironment();

    const req1 = request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Customer A',
        customerPhone: '9876543210',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 1 }],
        idempotencyKey: 'concurrent-1',
      });

    const req2 = request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Customer B',
        customerPhone: '9876543211',
        lines: [{ menuItemId: bagel._id.toString(), qty: 2 }],
        idempotencyKey: 'concurrent-2',
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.statusToken).toBeDefined();
    expect(res2.body.data.statusToken).toBeDefined();

    // Verify both ended up in exactly one open table order
    const orders = await Order.find({ tableId: table._id });
    expect(orders.length).toBe(1);
    const order = orders[0];
    expect(order.kots.length).toBe(2);
    expect(order.items.length).toBe(2);
    expect(order.hasUnacknowledgedCustomerSubmission).toBe(true);
  });

  it('2. Staff adding items while customer submits items concurrently', async () => {
    const { table, coffee, bagel } = await seedTestEnvironment();
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');

    // Customer places first order
    const custRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Customer Sitting',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Dark Roast', qty: 1 }],
        idempotencyKey: 'cust-first',
      });
    expect(custRes.status).toBe(201);

    const openOrder = await Order.findOne({ tableId: table._id, status: 'open' });
    expect(openOrder).not.toBeNull();

    // Concurrent customer submit + staff adding items to the open order
    const custReq = request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Customer Sitting',
        lines: [{ menuItemId: bagel._id.toString(), qty: 1 }],
        idempotencyKey: 'cust-second',
      });

    const staffReq = request(app)
      .post(`/api/orders/${openOrder!._id}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        idempotencyKey: 'staff-concurrent-key-1',
        items: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 1, unitPrice: 15000 }],
      });

    const [cRes, sRes] = await Promise.all([custReq, staffReq]);
    expect(cRes.status).toBe(201);
    expect(sRes.status).toBe(200);

    const refreshedOrder = await Order.findById(openOrder!._id);
    expect(refreshedOrder!.items.length).toBe(3);
  });

  it('3. Idempotency: exact same payload and key returns identical result without duplicate items', async () => {
    const { table, coffee } = await seedTestEnvironment();

    const payload = {
      table: table.number,
      token: table.qrToken,
      customerName: 'Rohan Sharma',
      lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 2 }],
      idempotencyKey: 'unique-idempotency-key-1234',
    };

    const res1 = await request(app).post('/api/public/qr/orders').send(payload);
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/public/qr/orders').send(payload);
    expect(res2.status).toBe(201);

    expect(res2.body.data.submissionId).toBe(res1.body.data.submissionId);
    expect(res2.body.data.statusToken).toBe(res1.body.data.statusToken);
    expect(res2.body.data.kotNo).toBe(res1.body.data.kotNo);

    // Database check: exactly 1 KOT, 1 item
    const order = await Order.findOne({ tableId: table._id });
    expect(order!.kots.length).toBe(1);
    expect(order!.items.length).toBe(1);
  });

  it('4. Honeypot: returns silent fake 200 OK without creating any database records', async () => {
    const { table, coffee } = await seedTestEnvironment();

    const res = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Spam Bot',
        lines: [{ menuItemId: coffee._id.toString(), qty: 1 }],
        idempotencyKey: 'bot-key-1',
        honeypot: 'spam-bot-trap-value',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const submissions = await CustomerSubmission.find({});
    expect(submissions.length).toBe(0);

    const orders = await Order.find({});
    expect(orders.length).toBe(0);
  });

  it('5. Limits & Abuse controls: lines limit, qty limit, and table submission throttles', async () => {
    const { table, coffee, bagel } = await seedTestEnvironment();

    // 5a. Reject > 10 qty per line
    const qtyRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Abusive User',
        lines: [{ menuItemId: coffee._id.toString(), qty: 11 }],
        idempotencyKey: 'over-qty',
      });
    expect(qtyRes.status).toBe(400);
    expect(qtyRes.body.error.message).toMatch(/quantity/i);

    // 5b. Throttling: max 3 submissions per table per 10 minutes
    for (let i = 1; i <= 3; i++) {
      const okRes = await request(app)
        .post('/api/public/qr/orders')
        .send({
          table: table.number,
          token: table.qrToken,
          customerName: `Customer ${i}`,
          lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 1 }],
          idempotencyKey: `sub-${i}`,
        });
      expect(okRes.status).toBe(201);
    }

    // 4th submission within 10 minutes should be blocked
    const throttleRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Customer 4',
        lines: [{ menuItemId: bagel._id.toString(), qty: 1 }],
        idempotencyKey: 'sub-4',
      });
    expect(throttleRes.status).toBe(429);
    expect(throttleRes.body.error.message).toMatch(/too many submissions from this table/i);
  });

  it('6. Runtime Kill Switch: pause and resume permissions and ordering lockout', async () => {
    const { table, coffee } = await seedTestEnvironment();
    const { token: managerToken } = await createStaffAndLogin('manager1', 'manager');
    const { token: partnerToken } = await createStaffAndLogin('partner1', 'partner');

    // Manager pauses QR ordering
    const pauseRes = await request(app)
      .patch('/api/settings/qr-ordering')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ enabled: false, message: 'Kitchen running at full capacity' });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.enabled).toBe(false);

    // Customer attempts to get context -> shows paused
    const contextRes = await request(app)
      .get(`/api/public/qr/context?table=${table.number}&t=${table.qrToken}`);
    expect(contextRes.status).toBe(200);
    expect(contextRes.body.data.orderingEnabled).toBe(false);
    expect(contextRes.body.data.reason).toBe('paused');
    expect(contextRes.body.data.pauseMessage).toBe('Kitchen running at full capacity');

    // Customer attempts to order -> 400 Bad Request
    const orderRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Eager Customer',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 1 }],
        idempotencyKey: 'eager-order-1',
      });
    expect(orderRes.status).toBe(400);
    expect(orderRes.body.error.code).toBe('QR_ORDERING_PAUSED');

    // Manager attempts to resume -> 403 Forbidden (Only partner can resume)
    const mgrResumeRes = await request(app)
      .patch('/api/settings/qr-ordering')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ enabled: true });
    expect(mgrResumeRes.status).toBe(403);

    // Partner resumes -> 200 OK
    const partnerResumeRes = await request(app)
      .patch('/api/settings/qr-ordering')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ enabled: true });
    expect(partnerResumeRes.status).toBe(200);
    expect(partnerResumeRes.body.data.enabled).toBe(true);
  });

  it('7. 60-Second Undo Window: cancellation allowed before kitchen starts, rejected once preparing', async () => {
    const { table, coffee } = await seedTestEnvironment();
    const { token: chefToken } = await createStaffAndLogin('chef1', 'kitchen');

    // Customer places order
    const subRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Indecisive Guest',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 1 }],
        idempotencyKey: 'undo-test-1',
      });
    expect(subRes.status).toBe(201);
    const statusToken = subRes.body.data.statusToken;

    // Check status: undoAllowed should be true
    const statusRes = await request(app).get(`/api/public/qr/status/${statusToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.undoAllowed).toBe(true);
    expect(statusRes.body.data.kotStatus).toBe('new');

    // Cancel within window
    const cancelRes = await request(app).post(`/api/public/qr/status/${statusToken}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.message).toMatch(/successfully cancelled/i);

    // Status is now cancelled and cannot be cancelled again
    const reStatusRes = await request(app).get(`/api/public/qr/status/${statusToken}`);
    expect(reStatusRes.body.data.kotStatus).toBe('cancelled');
    expect(reStatusRes.body.data.undoAllowed).toBe(false);

    // Second order: kitchen starts prep before cancel
    const subRes2 = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Too Late Guest',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Dark Roast', qty: 1 }],
        idempotencyKey: 'undo-test-2',
      });
    expect(subRes2.status).toBe(201);
    const statusToken2 = subRes2.body.data.statusToken;

    const order = await Order.findOne({ tableId: table._id });
    const kot2 = order!.kots[order!.kots.length - 1];

    // Chef moves KOT to 'preparing'
    const prepRes = await request(app)
      .post(`/api/kitchen/kots/${kot2.kotId}/status`)
      .set('Authorization', `Bearer ${chefToken}`)
      .send({ to: 'preparing', expectedFrom: 'new' });
    expect(prepRes.status).toBe(200);

    // Customer tries to cancel -> 409 Conflict (kitchen preparation started)
    const lateCancelRes = await request(app).post(`/api/public/qr/status/${statusToken2}/cancel`);
    expect(lateCancelRes.status).toBe(409);
    expect(lateCancelRes.body.error.message).toMatch(/kitchen has already started your order/i);
  });

  it('8. Data Minimization: status endpoint excludes phone, prices, and GST', async () => {
    const { table, coffee } = await seedTestEnvironment();

    const subRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Privacy Conscious',
        customerPhone: '9988776655',
        lines: [{ menuItemId: coffee._id.toString(), variantName: 'Light Roast', qty: 2, note: 'extra hot' }],
        idempotencyKey: 'privacy-1',
      });

    const statusToken = subRes.body.data.statusToken;
    const statusRes = await request(app).get(`/api/public/qr/status/${statusToken}`);

    expect(statusRes.status).toBe(200);
    const data = statusRes.body.data;

    // Allowed customer-facing data
    expect(data.tableNumber).toBe(table.number);
    expect(data.kotStatus).toBe('new');
    expect(data.items[0].nameSnapshot).toBe('Artisan Pour Over');
    expect(data.items[0].variantName).toBe('Light Roast');
    expect(data.items[0].qty).toBe(2);
    expect(data.items[0].note).toBe('extra hot');

    // Strictly forbidden fields in customer status DTO
    expect(data.customerPhone).toBeUndefined();
    expect(data.price).toBeUndefined();
    expect(data.totalPrice).toBeUndefined();
    expect(data.gstRate).toBeUndefined();
    expect(data.items[0].price).toBeUndefined();
    expect(data.items[0].gstRate).toBeUndefined();
  });

  it('9. 90-Day Retention Purge: anonymizes old customer phone numbers while preserving order', async () => {
    const { table, coffee } = await seedTestEnvironment();

    const subRes = await request(app)
      .post('/api/public/qr/orders')
      .send({
        table: table.number,
        token: table.qrToken,
        customerName: 'Old Customer',
        customerPhone: '9123456780',
        lines: [{ menuItemId: coffee._id.toString(), qty: 1 }],
        idempotencyKey: 'old-sub-1',
      });
    expect(subRes.status).toBe(201);

    const submissionBefore = await CustomerSubmission.findOne({
      submissionId: subRes.body.data.submissionId,
    });
    expect(submissionBefore!.customerPhone).toBe('+919123456780');

    // Run purge service simulating 95 days in the future
    const simulatedDateInFuture = new Date(Date.now() + 95 * 24 * 60 * 60 * 1000);
    const { purgedCount } = await phoneRetentionService.purgeExpiredCustomerPhones(simulatedDateInFuture);
    expect(purgedCount).toBe(1);

    const submissionAfter = await CustomerSubmission.findOne({
      submissionId: subRes.body.data.submissionId,
    });
    expect(submissionAfter!.customerPhone).toBeNull();
    expect(submissionAfter!.customerName).toBe('Old Customer');
  });
});
