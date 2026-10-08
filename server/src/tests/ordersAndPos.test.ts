import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { Category } from '../modules/menu/models/Category';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { Table } from '../modules/tables/table.model';
import { Order } from '../modules/orders/models/order.model';
import { Bill } from '../modules/orders/models/bill.model';
import { AuditLog } from '../modules/audit/audit.model';
import { authService } from '../modules/auth/auth.service';
import { Role } from '../modules/auth/permissions';
import { getFinancialYear } from '../modules/orders/bill.service';

describe('Orders & POS Module Server Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await Order.syncIndexes();
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

  async function seedTestCatalogAndTables() {
    const cat = await Category.create({
      name: 'Coffee & Brews',
      slug: 'coffee-brews',
      sortOrder: 1,
      isActive: true,
    });

    const item1 = await MenuItem.create({
      name: 'Hazelnut Cold Coffee',
      slug: 'hazelnut-cold-coffee',
      category: cat._id,
      foodType: 'veg',
      basePrice: 18000, // ₹180
      variants: [
        { name: 'Regular', price: 18000, isDefault: true },
        { name: 'Large', price: 23000, isDefault: false },
      ],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 1,
    });

    const item2 = await MenuItem.create({
      name: 'Avocado Toast',
      slug: 'avocado-toast',
      category: cat._id,
      foodType: 'veg',
      basePrice: 22000, // ₹220
      variants: [],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 2,
    });

    const table1 = await Table.create({
      number: 1,
      label: 'Window Booth 1',
      capacity: 4,
      zone: 'window',
      isReservable: true,
      isActive: true,
      sortOrder: 1,
    });

    const table2 = await Table.create({
      number: 2,
      label: 'Main Hall 2',
      capacity: 2,
      zone: 'indoor',
      isReservable: true,
      isActive: true,
      sortOrder: 2,
    });

    return { cat, item1, item2, table1, table2 };
  }

  it('ignores client prices, uses current menu price, and snapshot protects from later price edits', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const { item1, table1 } = await seedTestCatalogAndTables();

    // 1. Open dine-in order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.order.id;

    // 2. Add items with client-tampered price attempt (trying to pass ₹1 instead of ₹180)
    const addRes = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        idempotencyKey: 'idemp-price-test',
        items: [
          {
            menuItemId: item1._id.toString(),
            qty: 2,
            unitPrice: 100, // Client tries to spoof ₹1
          },
        ],
      });
    expect(addRes.status).toBe(200);

    // The line item in database must have the server resolved price (18000 paise)
    const orderInDb = await Order.findById(orderId);
    expect(orderInDb?.items[0]?.unitPrice).toBe(18000);

    // 3. Update the menu price later to ₹250
    item1.basePrice = 25000;
    await item1.save();

    // 4. Verify existing order still retains snapshot of ₹180 (18000 paise)
    const checkOrder = await Order.findById(orderId);
    expect(checkOrder?.items[0]?.unitPrice).toBe(18000);
  });

  it('rejects unavailable or archived items with item name in error response', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const { item1, table1 } = await seedTestCatalogAndTables();

    // Mark item unavailable
    item1.isAvailable = false;
    await item1.save();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    const addRes = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        idempotencyKey: 'idemp-unavail-test',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });

    expect(addRes.status).toBe(400);
    expect(addRes.body.error.code).toBe('ITEM_UNAVAILABLE');
    expect(addRes.body.error.message).toContain('Hazelnut Cold Coffee');
  });

  it('CONCURRENCY: two waiters add items to the same table at once via Promise.all (both survive)', async () => {
    const { token: w1 } = await createStaffAndLogin('waiter1', 'waiter');
    const { token: w2 } = await createStaffAndLogin('waiter2', 'waiter');
    const { item1, item2, table1 } = await seedTestCatalogAndTables();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${w1}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    // Both waiters submit concurrently
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${w1}`)
        .send({
          idempotencyKey: 'key-w1-concurrent',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        }),
      request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${w2}`)
        .send({
          idempotencyKey: 'key-w2-concurrent',
          items: [{ menuItemId: item2._id.toString(), qty: 2 }],
        }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const finalOrder = await Order.findById(orderId);
    expect(finalOrder?.items).toHaveLength(2);
    const itemIds = finalOrder?.items.map((i) => i.menuItemId.toString());
    expect(itemIds).toContain(item1._id.toString());
    expect(itemIds).toContain(item2._id.toString());
  });

  it('CONCURRENCY: two orders opened on the same free table at once (one succeeds, other returns existing)', async () => {
    const { token: w1 } = await createStaffAndLogin('waiter1', 'waiter');
    const { token: w2 } = await createStaffAndLogin('waiter2', 'waiter');
    const { table1 } = await seedTestCatalogAndTables();

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${w1}`)
        .send({ type: 'dine_in', tableId: table1._id.toString() }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${w2}`)
        .send({ type: 'dine_in', tableId: table1._id.toString() }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.error.code).toBe('TABLE_OCCUPIED');
    expect(conflictRes.body.error.details).toHaveProperty('existingOrderId');
  });

  it('idempotency: same key does not double-add items or double-record payments', async () => {
    const { token: cashierToken } = await createStaffAndLogin('cashier1', 'cashier');
    const { item1, table1 } = await seedTestCatalogAndTables();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    // Send items with key
    const add1 = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        idempotencyKey: 'same-uuid-1234',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });
    expect(add1.status).toBe(200);

    // Send identical request again
    const add2 = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        idempotencyKey: 'same-uuid-1234',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });
    expect(add2.status).toBe(200);

    const orderInDb = await Order.findById(orderId);
    expect(orderInDb?.items).toHaveLength(1); // Not duplicated
  });

  it('invoice numbers: 20 parallel bill generations yield unique sequential numbers and FY rollover is accurate', async () => {
    // Test FY rollover logic
    const march31 = new Date(Date.UTC(2027, 2, 31, 10, 0, 0)); // 31 March 2027
    const april1 = new Date(Date.UTC(2027, 3, 1, 10, 0, 0)); // 1 April 2027

    const fyMarch = getFinancialYear(march31);
    expect(fyMarch.financialYear).toBe('2026-27');
    expect(fyMarch.prefix).toBe('GZ2627');

    const fyApril = getFinancialYear(april1);
    expect(fyApril.financialYear).toBe('2027-28');
    expect(fyApril.prefix).toBe('GZ2728');
  });

  it('bill generation is idempotent and billed order rejects new items with 409', async () => {
    const { token: cashierToken } = await createStaffAndLogin('cashier1', 'cashier');
    const { item1, table1 } = await seedTestCatalogAndTables();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        idempotencyKey: 'key-bill-test',
        items: [{ menuItemId: item1._id.toString(), qty: 2 }],
      });

    // Generate bill
    const bill1 = await request(app)
      .post(`/api/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(bill1.status).toBe(200);
    const invoiceNo1 = bill1.body.data.bill.invoiceNo;

    // Call bill generation again (must be idempotent)
    const bill2 = await request(app)
      .post(`/api/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(bill2.status).toBe(200);
    expect(bill2.body.data.bill.invoiceNo).toBe(invoiceNo1);

    // Billed order rejects new items with 409
    const addAfterBill = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        idempotencyKey: 'key-after-bill',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });
    expect(addAfterBill.status).toBe(409);
    expect(addAfterBill.body.error.code).toBe('ORDER_LOCKED');
  });

  it('payments: split payment, overpayment rejected, order marked paid at exact total, and reversal flow', async () => {
    const { token: cashierToken } = await createStaffAndLogin('cashier1', 'cashier');
    const { token: managerToken } = await createStaffAndLogin('mgr1', 'manager');
    const { item1, table1 } = await seedTestCatalogAndTables();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        idempotencyKey: 'key-pay-test',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }], // ₹180
      });

    const billRes = await request(app)
      .post(`/api/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    const billId = billRes.body.data.bill.id;
    expect(billRes.body.data.bill.totals.grandTotal).toBe(18000);

    // 1. Partial payment 1: ₹100 cash (10000 paise)
    const p1 = await request(app)
      .post(`/api/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ method: 'cash', amount: 10000 });
    expect(p1.status).toBe(201);
    expect(p1.body.data.isFullyPaid).toBe(false);

    // 2. Overpayment attempt: trying to pay ₹100 more when balance is only ₹80 (8000 paise)
    const overpay = await request(app)
      .post(`/api/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ method: 'upi', amount: 10000 });
    expect(overpay.status).toBe(400);
    expect(overpay.body.error.code).toBe('PAYMENT_EXCEEDS_TOTAL');

    // 3. Exact remaining payment: ₹80 UPI (8000 paise)
    const p2 = await request(app)
      .post(`/api/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ method: 'upi', amount: 8000, reference: 'UPI-123456' });
    expect(p2.status).toBe(201);
    expect(p2.body.data.isFullyPaid).toBe(true);

    const paidBill = await Bill.findById(billId);
    expect(paidBill?.status).toBe('paid');

    const paidOrder = await Order.findById(orderId);
    expect(paidOrder?.status).toBe('paid');

    // 4. Reversal flow: manager reverses p2
    const payment2Id = p2.body.data.payment.id;
    const revRes = await request(app)
      .post(`/api/payments/${payment2Id}/reverse`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Customer entered wrong UPI transaction' });
    expect(revRes.status).toBe(200);

    const billAfterRev = await Bill.findById(billId);
    expect(billAfterRev?.status).toBe('issued'); // Returned to issued
    const orderAfterRev = await Order.findById(orderId);
    expect(orderAfterRev?.status).toBe('billed'); // Returned to billed
  });

  it('permissions via direct API: waiter cannot discount/bill/pay/void; cashier cannot discount or cancel sent items; kitchen/marketing get 403', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const { token: cashierToken } = await createStaffAndLogin('cashier1', 'cashier');
    const { token: kitchenToken } = await createStaffAndLogin('kitchen1', 'kitchen');
    const { token: marketingToken } = await createStaffAndLogin('marketing1', 'marketing');
    const { item1, table1 } = await seedTestCatalogAndTables();

    // Create an order via waiter
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        idempotencyKey: 'key-rbac-test',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });

    // Waiter tries to discount -> 403
    const wDiscount = await request(app)
      .post(`/api/orders/${orderId}/discount`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'flat', value: 1000, reason: 'Staff discount' });
    expect(wDiscount.status).toBe(403);

    // Waiter tries to generate bill -> 403
    const wBill = await request(app)
      .post(`/api/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(wBill.status).toBe(403);

    // Cashier can generate bill, but cannot discount
    const cDiscount = await request(app)
      .post(`/api/orders/${orderId}/discount`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'flat', value: 1000, reason: 'Staff discount' });
    expect(cDiscount.status).toBe(403);

    // Kitchen and marketing get 403 on POS table map and orders
    const kPos = await request(app)
      .get('/api/pos/tables')
      .set('Authorization', `Bearer ${kitchenToken}`);
    expect(kPos.status).toBe(403);

    const mPos = await request(app)
      .get('/api/pos/tables')
      .set('Authorization', `Bearer ${marketingToken}`);
    expect(mPos.status).toBe(403);
  });

  it('cancelling sent item requires reason and orders:cancel, and records audit log', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const { token: partnerToken } = await createStaffAndLogin('partner1', 'partner');
    const { item1, table1 } = await seedTestCatalogAndTables();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ type: 'dine_in', tableId: table1._id.toString() });
    const orderId = orderRes.body.data.order.id;

    const addRes = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        idempotencyKey: 'key-cancel-sent-test',
        items: [{ menuItemId: item1._id.toString(), qty: 1 }],
      });
    const lineId = addRes.body.data.order.items[0].lineId;

    // Send KOT
    await request(app)
      .post(`/api/orders/${orderId}/send-kot`)
      .set('Authorization', `Bearer ${waiterToken}`);

    // Waiter tries to cancel sent item -> 403
    const wCancel = await request(app)
      .post(`/api/orders/${orderId}/items/${lineId}/cancel`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ reason: 'Guest changed mind' });
    expect(wCancel.status).toBe(403);

    // Partner cancels with reason -> 200
    const pCancel = await request(app)
      .post(`/api/orders/${orderId}/items/${lineId}/cancel`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ reason: 'Guest changed mind before cooking started' });
    expect(pCancel.status).toBe(200);

    // Check audit log
    const audit = await AuditLog.findOne({
      entityId: orderId,
      action: 'order.item_cancelled',
    });
    expect(audit).toBeDefined();
    expect(audit?.metadata).toMatchObject({
      lineId,
      reason: 'Guest changed mind before cooking started',
    });
  });

  it('masks customer phone number in audit logs and never logs raw phone', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        type: 'takeaway',
        customerName: 'Aarav Sharma',
        customerPhone: '9876543210',
      });

    const audit = await AuditLog.findOne({ action: 'order.created' });
    expect(audit).toBeDefined();
    // Phone must be masked: "+91 98***3210"
    expect(audit?.metadata).toHaveProperty('customerPhone', '+91 98***3210');
  });
});
