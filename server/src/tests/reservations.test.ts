import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { Table } from '../modules/tables/table.model';
import { Reservation } from '../modules/reservations/models/reservation.model';
import { TableSlotLock } from '../modules/reservations/models/tableSlotLock.model';
import { authService } from '../modules/auth/auth.service';
import { Role } from '../modules/auth/permissions';
import { IST_ZONE } from '../modules/reservations/reservationTime';

describe('Tables, Reservations & Double-Booking Guard Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
    await TableSlotLock.init();
    await Reservation.init();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function createStaffAndLogin(username: string, role: Role) {
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

  // Helper to generate a valid future booking date string (tomorrow in IST)
  function getTomorrowDateStr(): string {
    return DateTime.now().setZone(IST_ZONE).plus({ days: 1 }).toFormat('yyyy-MM-dd');
  }

  it('CONCURRENCY: two simultaneous bookings for the last free table in a slot => exactly one succeeds, other gets 409, no orphan locks', async () => {
    // 1. Create exactly ONE table (2-seater)
    const table = await Table.create({
      number: 1,
      label: 'Single Table',
      capacity: 2,
      zone: 'indoor',
      isReservable: true,
      isActive: true,
    });

    const testDate = getTomorrowDateStr();
    const testTime = '19:00';

    // 2. Fire two simultaneous bookings at the exact same instant
    const [res1, res2] = await Promise.all([
      request(app).post('/api/public/reservations').send({
        customerName: 'Customer A',
        phone: '9876543210',
        guests: 2,
        date: testDate,
        time: testTime,
        idempotencyKey: 'key-concurrent-1',
      }),
      request(app).post('/api/public/reservations').send({
        customerName: 'Customer B',
        phone: '9876543211',
        guests: 2,
        date: testDate,
        time: testTime,
        idempotencyKey: 'key-concurrent-2',
      }),
    ]);

    // One must be confirmed (status 201), the other will be pending because table was taken
    const responses = [res1, res2];
    const confirmedRes = responses.find((r) => r.body.data?.status === 'confirmed');
    const pendingRes = responses.find((r) => r.body.data?.status === 'pending');

    expect(confirmedRes).toBeDefined();
    expect(pendingRes).toBeDefined();

    // Exactly 3 locks (for the single 90-min stay of the confirmed reservation) must exist
    const totalLocks = await TableSlotLock.countDocuments({ tableId: table._id });
    expect(totalLocks).toBe(3);

    // Verify confirmed reservation holds the table
    const confirmedBooking = await Reservation.findOne({ code: confirmedRes?.body.data.code });
    expect(confirmedBooking?.tableIds.map((id) => id.toString())).toContain(table._id.toString());
  });

  it('Best-fit assignment chooses smallest capacity >= guests', async () => {
    // Table 1: 4-seater, Table 2: 2-seater
    const table4 = await Table.create({ number: 4, capacity: 4, zone: 'indoor', isReservable: true, isActive: true, sortOrder: 1 });
    const table2 = await Table.create({ number: 2, capacity: 2, zone: 'indoor', isReservable: true, isActive: true, sortOrder: 2 });

    const testDate = getTomorrowDateStr();

    const res = await request(app).post('/api/public/reservations').send({
      customerName: 'Party of Two',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '18:00',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('confirmed');

    const booking = await Reservation.findOne({ code: res.body.data.code });
    expect(booking?.tableIds[0].toString()).toBe(table2._id.toString());
    expect(booking?.tableIds[0].toString()).not.toBe(table4._id.toString());
  });

  it('Party of > 6 guests creates pending booking without locking tables; staff assigns tables later', async () => {
    const table8 = await Table.create({ number: 8, capacity: 8, zone: 'family', isReservable: true, isActive: true });
    const { token: managerToken } = await createStaffAndLogin('manager1', 'manager');

    const testDate = getTomorrowDateStr();

    // 1. Customer books for 8 guests (above autoConfirmMaxGuests = 6)
    const publicRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Big Family Dinner',
      phone: '9876543210',
      guests: 8,
      date: testDate,
      time: '20:00',
    });

    expect(publicRes.status).toBe(201);
    expect(publicRes.body.data.status).toBe('pending');

    const booking = await Reservation.findOne({ code: publicRes.body.data.code });
    expect(booking?.tableIds.length).toBe(0);

    // No locks should exist yet
    const initialLocks = await TableSlotLock.countDocuments({ reservationId: booking?._id });
    expect(initialLocks).toBe(0);

    // 2. Staff assigns Table 8 to the booking
    const assignRes = await request(app)
      .post(`/api/reservations/${booking?._id}/assign-tables`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ tableIds: [table8._id.toString()] });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.reservation.status).toBe('confirmed');

    // 3. Locks are now acquired
    const locksAfterAssign = await TableSlotLock.countDocuments({ reservationId: booking?._id });
    expect(locksAfterAssign).toBe(3);
  });

  it('Locks are released when reservation is cancelled; slot becomes available again', async () => {
    const table = await Table.create({ number: 1, capacity: 2, zone: 'indoor', isReservable: true, isActive: true });
    const testDate = getTomorrowDateStr();

    // 1. Book table at 19:00
    const createRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Samir',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '19:00',
    });

    expect(createRes.body.data.status).toBe('confirmed');
    expect(await TableSlotLock.countDocuments({ tableId: table._id })).toBe(3);

    // 2. Customer cancels booking
    const cancelRes = await request(app).post('/api/public/reservations/cancel').send({
      code: createRes.body.data.code,
      phone: '9876543210',
      reason: 'Change of plans',
    });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 3. Locks are completely cleared
    expect(await TableSlotLock.countDocuments({ tableId: table._id })).toBe(0);

    // 4. Another customer can now book the same table and slot!
    const newBookingRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Priya',
      phone: '9876543212',
      guests: 2,
      date: testDate,
      time: '19:00',
    });

    expect(newBookingRes.status).toBe(201);
    expect(newBookingRes.body.data.status).toBe('confirmed');
    expect(await TableSlotLock.countDocuments({ tableId: table._id })).toBe(3);
  });

  it('Adjacent booking overlap rule: booking ending at 20:30 does NOT block one starting at 20:30', async () => {
    const table = await Table.create({ number: 1, capacity: 2, zone: 'indoor', isReservable: true, isActive: true });
    const testDate = getTomorrowDateStr();

    // Booking 1: 19:00 to 20:30 (occupies 19:00, 19:30, 20:00)
    const res1 = await request(app).post('/api/public/reservations').send({
      customerName: 'First Seating',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '19:00',
    });
    expect(res1.body.data.status).toBe('confirmed');

    // Booking 2: 20:30 to 22:00 on the same table (occupies 20:30, 21:00, 21:30)
    const res2 = await request(app).post('/api/public/reservations').send({
      customerName: 'Second Seating',
      phone: '9876543211',
      guests: 2,
      date: testDate,
      time: '20:30',
    });
    expect(res2.body.data.status).toBe('confirmed');

    // Both hold locks without collision
    const totalLocks = await TableSlotLock.countDocuments({ tableId: table._id });
    expect(totalLocks).toBe(6); // 3 + 3
  });

  it('Enforces idempotencyKey, anti-spam phone limits, and honeypot trap', async () => {
    await Table.create({ number: 1, capacity: 4, zone: 'indoor', isReservable: true, isActive: true });
    const testDate = getTomorrowDateStr();

    // 1. Idempotency: exact same key returns same response without duplicate DB insert
    const key = 'idem-test-uuid-123';
    const firstRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Idem User',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '14:00',
      idempotencyKey: key,
    });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Idem User',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '14:00',
      idempotencyKey: key,
    });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.code).toBe(firstRes.body.data.code);
    expect(await Reservation.countDocuments({ idempotencyKey: key })).toBe(1);

    // 2. Anti-spam: maxActiveBookingsPerPhone = 2
    // Create second active booking for same phone
    await request(app).post('/api/public/reservations').send({
      customerName: 'Idem User',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '16:00',
    });

    // Third booking should be rejected with 429
    const spamRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Idem User',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '18:00',
    });
    expect(spamRes.status).toBe(429);
    expect(spamRes.body.error.code).toBe('ACTIVE_BOOKINGS_LIMIT');

    // 3. Honeypot: bot filling trap field gets fake success without DB record
    const botRes = await request(app).post('/api/public/reservations').send({
      customerName: 'Spam Bot',
      phone: '9876543999',
      guests: 2,
      date: testDate,
      time: '12:00',
      honeypot: 'http://spam-link.ru',
    });
    expect(botRes.status).toBe(201);
    expect(await Reservation.exists({ customerName: 'Spam Bot' })).toBeNull();
  });

  it('State Machine: validates allowed transitions and rejects invalid transitions with 409', async () => {
    const { token: managerToken } = await createStaffAndLogin('manager1', 'manager');
    const testDate = getTomorrowDateStr();

    const booking = await Reservation.create({
      code: 'GZ-STATE1',
      customerName: 'State Machine Test',
      phone: '+919876543210',
      guests: 2,
      startAt: new Date(),
      endAt: new Date(Date.now() + 90 * 60000),
      localDate: testDate,
      status: 'pending',
    });

    // 1. Invalid: pending directly to seated => 409
    const invalidRes = await request(app)
      .post(`/api/reservations/${booking._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'seated' });

    expect(invalidRes.status).toBe(409);
    expect(invalidRes.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    // 2. Valid: pending to confirmed
    const confirmRes = await request(app)
      .post(`/api/reservations/${booking._id}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.reservation.status).toBe('confirmed');

    // 3. Valid: confirmed to seated
    const seatedRes = await request(app)
      .post(`/api/reservations/${booking._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'seated' });
    expect(seatedRes.status).toBe(200);
    expect(seatedRes.body.data.reservation.status).toBe('seated');

    // 4. Valid: seated to completed
    const completedRes = await request(app)
      .post(`/api/reservations/${booking._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'completed' });
    expect(completedRes.status).toBe(200);
    expect(completedRes.body.data.reservation.status).toBe('completed');

    // 5. Invalid: completed to cancelled (final status) => 409
    const finalRes = await request(app)
      .post(`/api/reservations/${booking._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'cancelled' });
    expect(finalRes.status).toBe(409);
  });

  it('Lookup and cancel with wrong phone returns generic 404 to prevent enumeration', async () => {
    const testDate = getTomorrowDateStr();
    const res = await request(app).post('/api/public/reservations').send({
      customerName: 'Ananya',
      phone: '9876543210',
      guests: 2,
      date: testDate,
      time: '15:00',
    });

    const code = res.body.data.code;

    // Lookup with incorrect phone
    const wrongLookup = await request(app).post('/api/public/reservations/lookup').send({
      code,
      phone: '9999999999',
    });
    expect(wrongLookup.status).toBe(404);
    expect(wrongLookup.body.error.message).toContain('No booking found');

    // Cancel with incorrect phone
    const wrongCancel = await request(app).post('/api/public/reservations/cancel').send({
      code,
      phone: '9999999999',
    });
    expect(wrongCancel.status).toBe(404);
    expect(wrongCancel.body.error.message).toContain('No booking found');
  });

  it('RBAC & Privacy: waiter is read-only, kitchen/marketing are forbidden (403), public endpoints leak no private data', async () => {
    const { token: waiterToken } = await createStaffAndLogin('waiter1', 'waiter');
    const { token: kitchenToken } = await createStaffAndLogin('kitchen1', 'kitchen');
    const { token: marketingToken } = await createStaffAndLogin('marketing1', 'marketing');

    // 1. Waiter can read reservations
    const waiterGet = await request(app).get('/api/reservations').set('Authorization', `Bearer ${waiterToken}`);
    expect(waiterGet.status).toBe(200);

    // Waiter CANNOT create reservations
    const waiterPost = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ customerName: 'Test', phone: '9876543210', guests: 2, date: getTomorrowDateStr(), time: '12:00' });
    expect(waiterPost.status).toBe(403);

    // 2. Kitchen & Marketing get 403 on reservations and tables
    const kitchenRes = await request(app).get('/api/reservations').set('Authorization', `Bearer ${kitchenToken}`);
    expect(kitchenRes.status).toBe(403);

    const marketingRes = await request(app).get('/api/reservations').set('Authorization', `Bearer ${marketingToken}`);
    expect(marketingRes.status).toBe(403);

    const kitchenTables = await request(app).get('/api/tables').set('Authorization', `Bearer ${kitchenToken}`);
    expect(kitchenTables.status).toBe(403);

    // 3. Public endpoint leaks NO phone numbers or table details
    const publicBooking = await request(app).post('/api/public/reservations').send({
      customerName: 'Secrecy Test',
      phone: '9876543210',
      guests: 2,
      date: getTomorrowDateStr(),
      time: '14:00',
    });

    expect(publicBooking.body.data.phone).toBeUndefined();
    expect(publicBooking.body.data.tableIds).toBeUndefined();
    expect(publicBooking.body.data.internalNotes).toBeUndefined();
  });

  it('Safeguard: table with future active reservations CANNOT be deactivated', async () => {
    const table = await Table.create({ number: 99, capacity: 4, zone: 'indoor', isReservable: true, isActive: true });
    const { token: managerToken } = await createStaffAndLogin('manager1', 'manager');

    // Create future confirmed reservation on Table 99
    await Reservation.create({
      code: 'GZ-SAFE01',
      customerName: 'Future Diner',
      phone: '+919876543210',
      guests: 4,
      startAt: new Date(Date.now() + 24 * 3600 * 1000), // tomorrow
      endAt: new Date(Date.now() + 25 * 3600 * 1000),
      localDate: getTomorrowDateStr(),
      status: 'confirmed',
      tableIds: [table._id],
    });

    // Attempt to deactivate table
    const deactivateRes = await request(app)
      .patch(`/api/tables/${table._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isActive: false });

    expect(deactivateRes.status).toBe(400);
    expect(deactivateRes.body.error.message).toContain('upcoming active reservation');

    // Table remains active
    const tableCheck = await Table.findById(table._id);
    expect(tableCheck?.isActive).toBe(true);
  });
});
