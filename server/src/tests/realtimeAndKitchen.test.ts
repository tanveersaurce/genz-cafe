import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { Category } from '../modules/menu/models/Category';
import { MenuItem } from '../modules/menu/models/MenuItem';
import { Table } from '../modules/tables/table.model';
import { Order } from '../modules/orders/models/order.model';
import { authService } from '../modules/auth/auth.service';
import { Role } from '../modules/auth/permissions';
import { realtimeService } from '../modules/realtime/realtime.service';
import { REALTIME_ROOMS, REALTIME_EVENTS } from '../config/realtimeEvents';

describe('Real-Time Socket.io & Kitchen Display System Test Suite', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    await connectTestDb();
    server = http.createServer(app);
    realtimeService.init(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    serverUrl = `http://localhost:${addr.port}`;
  }, 120000);

  afterAll(async () => {
    await realtimeService.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await Order.syncIndexes();
  });

  async function createStaffAndToken(username: string, role: Role) {
    const passwordHash = await authService.hashPassword('Password@123');
    const user = await User.create({
      name: `${role.toUpperCase()} Staff`,
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

  async function seedCatalogAndTable() {
    const cat = await Category.create({
      name: 'Brews',
      slug: 'brews',
      sortOrder: 1,
      isActive: true,
    });

    const item1 = await MenuItem.create({
      name: 'Iced Cappuccino',
      slug: 'iced-cappuccino',
      category: cat._id,
      foodType: 'veg',
      basePrice: 20000,
      variants: [],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 1,
    });

    const item2 = await MenuItem.create({
      name: 'Garlic Bread',
      slug: 'garlic-bread',
      category: cat._id,
      foodType: 'veg',
      basePrice: 15000,
      variants: [],
      gstRate: 5,
      isAvailable: true,
      isActive: true,
      sortOrder: 2,
    });

    const table = await Table.create({
      number: 4,
      label: 'Table 4 Window',
      capacity: 4,
      zone: 'indoor',
      isActive: true,
    });

    return { item1, item2, table };
  }

  describe('1. Socket Authentication & Permission-Based Room Isolation', () => {
    it('rejects connection when handshake token is missing or invalid', async () => {
      await expect(
        new Promise<void>((resolve, reject) => {
          const socket = ClientSocket(serverUrl, {
            auth: { token: 'invalid.jwt.token' },
            transports: ['websocket'],
            reconnection: false,
          });

          socket.on('connect_error', (_err) => {
            socket.close();
            resolve();
          });

          socket.on('connect', () => {
            socket.close();
            reject(new Error('Should not have connected with invalid token'));
          });
        })
      ).resolves.toBeUndefined();
    });

    it('connects successfully with valid token and routes events based on room permissions', async () => {
      const { token: kitchenToken } = await createStaffAndToken('chef1', 'kitchen');
      const { token: waiterToken } = await createStaffAndToken('waiter1', 'waiter');

      let kitchenSocket: ClientSocketType | null = null;
      let waiterSocket: ClientSocketType | null = null;

      try {
        // Connect Kitchen socket
        kitchenSocket = await new Promise<ClientSocketType>((resolve, reject) => {
          const s = ClientSocket(serverUrl, {
            auth: { token: kitchenToken },
            transports: ['websocket'],
            reconnection: false,
          });
          s.on('connect', () => resolve(s));
          s.on('connect_error', reject);
        });

        // Connect Waiter socket
        waiterSocket = await new Promise<ClientSocketType>((resolve, reject) => {
          const s = ClientSocket(serverUrl, {
            auth: { token: waiterToken },
            transports: ['websocket'],
            reconnection: false,
          });
          s.on('connect', () => resolve(s));
          s.on('connect_error', reject);
        });

        expect(kitchenSocket.connected).toBe(true);
        expect(waiterSocket.connected).toBe(true);

        // Emit an event targeting only REALTIME_ROOMS.KITCHEN
        const kitchenReceivedPromise = new Promise<string>((resolve) => {
          kitchenSocket!.on(REALTIME_EVENTS.KOT_CREATED, (data: { kotId: string }) => {
            resolve(data.kotId);
          });
        });

        let waiterReceived = false;
        waiterSocket.on(REALTIME_EVENTS.KOT_CREATED, () => {
          waiterReceived = true;
        });

        // Emit via RealtimeService
        realtimeService.emit(REALTIME_EVENTS.KOT_CREATED, REALTIME_ROOMS.KITCHEN, {
          kotId: 'kot-test-123',
          kotNo: 'KOT-1',
          orderId: 'order-1',
          orderNo: 'ORD-1',
          tableNumber: 4,
          status: 'new',
          itemCount: 2,
          createdAt: new Date().toISOString(),
        });

        const receivedKotId = await kitchenReceivedPromise;
        expect(receivedKotId).toBe('kot-test-123');

        // Wait brief tick to verify waiter did NOT receive the kitchen-only event
        await new Promise((r) => setTimeout(r, 100));
        expect(waiterReceived).toBe(false);
      } finally {
        kitchenSocket?.close();
        waiterSocket?.close();
      }
    });

    it('emits safely without throwing when socket server encounters an issue', () => {
      expect(() => {
        realtimeService.emit(REALTIME_EVENTS.ORDER_UPDATED, REALTIME_ROOMS.POS, {
          orderId: 'test-order',
          orderNo: 'GZ-1',
          status: 'open',
          runningTotalPaise: 1000,
          version: 1,
        });
      }).not.toThrow();
    });
  });

  describe('2. Kitchen Display Board API & Data Minimization', () => {
    it('restricts /api/kitchen/board to staff with kitchen:view permission', async () => {
      const { token: waiterToken } = await createStaffAndToken('waiter2', 'waiter');
      const { token: kitchenToken } = await createStaffAndToken('chef2', 'kitchen');

      // Waiter cannot view kitchen board
      const res403 = await request(app)
        .get('/api/kitchen/board')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res403.status).toBe(403);

      // Kitchen role can view kitchen board
      const res200 = await request(app)
        .get('/api/kitchen/board')
        .set('Authorization', `Bearer ${kitchenToken}`);
      expect(res200.status).toBe(200);
      expect(res200.body.success).toBe(true);
      expect(Array.isArray(res200.body.data.activeKots)).toBe(true);
    });

    it('enforces strict data minimization (zero prices, zero customer phone, zero GST in DTO)', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: cashierToken } = await createStaffAndToken('cashier1', 'cashier');
      const { token: kitchenToken } = await createStaffAndToken('chef3', 'kitchen');

      // Create Dine-in order with customer phone snapshot
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          type: 'dine_in',
          tableId: table._id.toString(),
          customerName: 'Secret Customer',
          customerPhone: '9876543210',
        });
      const orderId = createRes.body.data.order._id;

      // Add item and send KOT
      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          idempotencyKey: 'idemp-test-1',
          items: [{ menuItemId: item1._id.toString(), qty: 2, note: 'Extra hot' }],
        });

      await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${cashierToken}`);

      // Inspect kitchen board response
      const boardRes = await request(app)
        .get('/api/kitchen/board')
        .set('Authorization', `Bearer ${kitchenToken}`);

      expect(boardRes.status).toBe(200);
      const activeKots = boardRes.body.data.activeKots;
      expect(activeKots.length).toBe(1);

      const ticket = activeKots[0];
      // Operational fields present
      expect(ticket.tableNumber).toBe(4);
      expect(ticket.status).toBe('new');
      expect(ticket.items.length).toBe(1);
      expect(ticket.items[0].name).toBe('Iced Cappuccino');
      expect(ticket.items[0].qty).toBe(2);
      expect(ticket.items[0].note).toBe('Extra hot');

      // Zero financial & PII fields check
      const rawJson = JSON.stringify(ticket);
      expect(rawJson).not.toContain('9876543210');
      expect(rawJson).not.toContain('Secret Customer');
      expect(rawJson).not.toContain('basePrice');
      expect(rawJson).not.toContain('unitPrice');
      expect(rawJson).not.toContain('grossAmount');
      expect(rawJson).not.toContain('gstRate');
      expect(rawJson).not.toContain('gstPaise');
      expect(ticket).not.toHaveProperty('totalPaidPaise');
      expect(ticket).not.toHaveProperty('grandTotal');
    });
  });

  describe('3. KOT State Machine Transitions & Atomic CAS Idempotency', () => {
    it('executes valid transitions (new -> preparing -> ready) and records audit actors', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: cashierToken } = await createStaffAndToken('cashier2', 'cashier');
      const { token: kitchenToken, user: kitchenUser } = await createStaffAndToken('chef4', 'kitchen');

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ type: 'dine_in', tableId: table._id.toString() });
      const orderId = createRes.body.data.order._id;

      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          idempotencyKey: 'idemp-test-2',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        });

      const kotRes = await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${cashierToken}`);
      const kotId = kotRes.body.data.kot.kotId;

      // Transition: new -> preparing
      const prepRes = await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'preparing', expectedFrom: 'new' });

      expect(prepRes.status).toBe(200);
      expect(prepRes.body.data.kot.status).toBe('preparing');
      expect(prepRes.body.data.kot.startedBy.toString()).toBe(kitchenUser._id.toString());
      expect(prepRes.body.data.kot.startedAt).toBeTruthy();

      // Transition: preparing -> ready
      const readyRes = await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'ready', expectedFrom: 'preparing' });

      expect(readyRes.status).toBe(200);
      expect(readyRes.body.data.kot.status).toBe('ready');
      expect(readyRes.body.data.kot.readyBy.toString()).toBe(kitchenUser._id.toString());
      expect(readyRes.body.data.kot.readyAt).toBeTruthy();

      // Bump back / undo: ready -> preparing
      const undoRes = await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'preparing', expectedFrom: 'ready' });

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.data.kot.status).toBe('preparing');
    });

    it('returns idempotent 200 when repeating the same transition', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: cashierToken } = await createStaffAndToken('cashier3', 'cashier');
      const { token: kitchenToken } = await createStaffAndToken('chef5', 'kitchen');

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ type: 'dine_in', tableId: table._id.toString() });
      const orderId = createRes.body.data.order._id;

      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          idempotencyKey: 'idemp-test-3',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        });

      const kotRes = await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${cashierToken}`);
      const kotId = kotRes.body.data.kot.kotId;

      // First call
      await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'preparing', expectedFrom: 'new' });

      // Duplicate retry call
      const retryRes = await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'preparing', expectedFrom: 'new' });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.data.idempotent).toBe(true);
      expect(retryRes.body.data.kot.status).toBe('preparing');
    });

    it('returns 409 Conflict when expectedFrom does not match current database status', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: cashierToken } = await createStaffAndToken('cashier4', 'cashier');
      const { token: kitchenToken } = await createStaffAndToken('chef6', 'kitchen');

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ type: 'dine_in', tableId: table._id.toString() });
      const orderId = createRes.body.data.order._id;

      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          idempotencyKey: 'idemp-test-4',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        });

      const kotRes = await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${cashierToken}`);
      const kotId = kotRes.body.data.kot.kotId;

      // Status in DB is 'new', but client sends expectedFrom: 'preparing'
      const conflictRes = await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'ready', expectedFrom: 'preparing' });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('KOT_STATUS_CONFLICT');
    });
  });

  describe('4. Waiter Ready Notification & Served Workflow', () => {
    it('lists ready KOTs under /api/pos/ready and marks them served via /api/pos/kots/:id/served', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: cashierToken } = await createStaffAndToken('cashier5', 'cashier');
      const { token: kitchenToken } = await createStaffAndToken('chef7', 'kitchen');
      const { token: waiterToken, user: waiterUser } = await createStaffAndToken('waiter3', 'waiter');

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ type: 'dine_in', tableId: table._id.toString() });
      const orderId = createRes.body.data.order._id;

      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          idempotencyKey: 'idemp-test-5',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        });

      const kotRes = await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${cashierToken}`);
      const kotId = kotRes.body.data.kot.kotId;

      // Move to 'ready'
      await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'preparing', expectedFrom: 'new' });

      await request(app)
        .post(`/api/kitchen/kots/${kotId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'ready', expectedFrom: 'preparing' });

      // Waiter checks /api/pos/ready
      const readyRes = await request(app)
        .get('/api/pos/ready')
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(readyRes.status).toBe(200);
      expect(readyRes.body.data.length).toBe(1);
      expect(readyRes.body.data[0].kotId).toBe(kotId);
      expect(readyRes.body.data[0].tableNumber).toBe(4);

      // Waiter marks served
      const serveRes = await request(app)
        .post(`/api/pos/kots/${kotId}/served`)
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(serveRes.status).toBe(200);
      expect(serveRes.body.data.kot.status).toBe('served');
      expect(serveRes.body.data.kot.servedBy.toString()).toBe(waiterUser._id.toString());
      expect(serveRes.body.data.kot.servedAt).toBeTruthy();

      // Re-query ready list: should now be empty
      const emptyReadyRes = await request(app)
        .get('/api/pos/ready')
        .set('Authorization', `Bearer ${waiterToken}`);

      expect(emptyReadyRes.status).toBe(200);
      expect(emptyReadyRes.body.data.length).toBe(0);
    });
  });

  describe('5. Auto-Cancellation Workflow', () => {
    it('automatically transitions KOT status to cancelled when all its items are cancelled', async () => {
      const { item1, table } = await seedCatalogAndTable();
      const { token: partnerToken } = await createStaffAndToken('partner1', 'partner');

      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ type: 'dine_in', tableId: table._id.toString() });
      const orderId = createRes.body.data.order._id;

      await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          idempotencyKey: 'idemp-test-6',
          items: [{ menuItemId: item1._id.toString(), qty: 1 }],
        });

      const kotRes = await request(app)
        .post(`/api/orders/${orderId}/send-kot`)
        .set('Authorization', `Bearer ${partnerToken}`);
      const kotId = kotRes.body.data.kot.kotId;

      // Fetch order to get lineId
      const orderRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${partnerToken}`);
      const lineId = orderRes.body.data.order.items[0].lineId;

      // Cancel the only item in that KOT using correct route
      const cancelRes = await request(app)
        .post(`/api/orders/${orderId}/items/${lineId}/cancel`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ reason: 'Guest changed mind' });

      expect(cancelRes.status).toBe(200);
      const updatedKot = cancelRes.body.data.order.kots.find((k: { kotId: string }) => k.kotId === kotId);
      expect(updatedKot.status).toBe('cancelled');
    });
  });
});
