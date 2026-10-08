import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { authService } from '../modules/auth/auth.service';
import { approvalService } from '../modules/approvals/approval.service';

describe('Cash Movements & Daily Closing Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function setupStaff() {
    const passwordHash = await authService.hashPassword('Pass@1234');

    const partner = await User.create({
      name: 'Cafe Partner',
      username: 'partner1',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const manager = await User.create({
      name: 'Cafe Manager',
      username: 'manager1',
      passwordHash,
      role: 'manager',
      isActive: true,
    });

    const cashier = await User.create({
      name: 'Priya Cashier',
      username: 'priya',
      passwordHash,
      role: 'cashier',
      isActive: true,
    });

    const partnerToken = authService.generateAccessToken({
      userId: partner._id.toString(),
      role: 'partner',
      username: 'partner1',
    });

    const managerToken = authService.generateAccessToken({
      userId: manager._id.toString(),
      role: 'manager',
      username: 'manager1',
    });

    const cashierToken = authService.generateAccessToken({
      userId: cashier._id.toString(),
      role: 'cashier',
      username: 'priya',
    });

    return { partner, manager, cashier, partnerToken, managerToken, cashierToken };
  }

  it('cashier can record regular cash in and cash out up to ₹2,000 without approval', async () => {
    const { cashierToken } = await setupStaff();

    // Cash in: ₹500.00 (50,000 paise)
    const resIn = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        type: 'in',
        amount: 50000,
        category: 'float_in',
        reason: 'Added change to register',
      });

    expect(resIn.status).toBe(201);
    expect(resIn.body.data.movement.type).toBe('in');
    expect(resIn.body.data.movement.amount).toBe(50000);

    // Cash out: ₹1,500.00 (150,000 paise) <= ₹2,000 limit
    const resOut = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        type: 'out',
        amount: 150000,
        category: 'purchase',
        reason: 'Milk and ice purchase',
      });

    expect(resOut.status).toBe(201);
    expect(resOut.body.data.movement.amount).toBe(150000);
  });

  it('cashier cash out > ₹2,000 requires manager approval token', async () => {
    const { cashierToken, manager } = await setupStaff();
    await approvalService.setApprovalPin(manager._id.toString(), 'Pass@1234', '849201');

    // 1. Without approval token -> 403 APPROVAL_REQUIRED
    const resFail = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        type: 'out',
        amount: 300000, // ₹3,000.00 > ₹2,000 threshold
        category: 'purchase',
        reason: 'Bulk coffee beans supply',
      });

    expect(resFail.status).toBe(403);
    expect(resFail.body.error.code).toBe('APPROVAL_REQUIRED');

    // 2. Request manager approval token
    const resApproval = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        approverId: manager._id.toString(),
        pin: '849201',
        action: 'cash.out_large',
        entityId: 'cash_drawer',
        params: { amount: 300000, reason: 'Bulk coffee beans supply' },
      });

    expect(resApproval.status).toBe(201);
    const approvalToken = resApproval.body.data.approvalToken;

    // 3. Retry with approval token -> Succeeds
    const resSuccess = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        type: 'out',
        amount: 300000,
        category: 'purchase',
        reason: 'Bulk coffee beans supply',
        approvalToken,
      });

    expect(resSuccess.status).toBe(201);
    expect(resSuccess.body.data.movement.amount).toBe(300000);
  });

  it('manager can reverse a recorded cash movement with reason', async () => {
    const { cashierToken, managerToken } = await setupStaff();

    const resIn = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        type: 'in',
        amount: 20000,
        category: 'float_in',
        reason: 'Duplicate entry by mistake',
      });

    const movementId = resIn.body.data.movement._id;

    // Reversal without reason fails
    const resNoReason = await request(app)
      .post(`/api/cash-movements/${movementId}/reverse`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: '' });
    expect(resNoReason.status).toBe(400);

    // Reversal with valid reason succeeds
    const resRev = await request(app)
      .post(`/api/cash-movements/${movementId}/reverse`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Correcting double entry error' });

    expect(resRev.status).toBe(200);
    expect(resRev.body.data.movement.status).toBe('reversed');
  });

  it('closing preview enforces blind count for cashier and shows full numbers for manager', async () => {
    const { cashierToken, managerToken } = await setupStaff();
    const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

    // 1. Cashier preview (blind count)
    const resCashier = await request(app)
      .get(`/api/closing/preview?date=${today}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(resCashier.status).toBe(200);
    expect(resCashier.body.data.isBlindCount).toBe(true);
    expect(resCashier.body.data.expected).toBeUndefined();
    expect(resCashier.body.data.salesSummary).toBeUndefined();
    expect(resCashier.body.data.openingCash).toBeDefined();

    // 2. Manager preview (full figures)
    const resManager = await request(app)
      .get(`/api/closing/preview?date=${today}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(resManager.status).toBe(200);
    expect(resManager.body.data.isBlindCount).toBe(false);
    expect(resManager.body.data.expected).toBeDefined();
    expect(resManager.body.data.salesSummary).toBeDefined();
  });

  it('submits daily closing, enforces discrepancy note, and locks DAY_CLOSED', async () => {
    const { managerToken, partnerToken } = await setupStaff();
    const today = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');

    // Submit closing with discrepancy > ₹50 without note fails
    const resNoNote = await request(app)
      .post('/api/closing')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        localDate: today,
        countedCash: 180000, // ₹1,800.00 vs expected ₹2,000.00 (diff -₹200)
        cashRetained: 180000,
        cashHandedOver: 0,
      });

    expect(resNoNote.status).toBe(400);
    expect(resNoNote.body.error.code).toBe('CLOSING_NOTE_REQUIRED');

    // Submit closing with explanatory note succeeds
    const resClose = await request(app)
      .post('/api/closing')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        localDate: today,
        countedCash: 180000,
        cashRetained: 180000,
        cashHandedOver: 0,
        note: 'Short by ₹200 due to cash drawer discrepancy',
      });

    expect(resClose.status).toBe(201);
    expect(resClose.body.data.closing.status).toBe('closed');
    expect(resClose.body.data.closing.difference).toBe(-20000);

    // GUARD: Attempting to record cash movement for a closed day returns 409 DAY_CLOSED
    const resBlocked = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: 'in',
        amount: 5000,
        category: 'other',
        reason: 'Late transaction',
      });

    expect(resBlocked.status).toBe(409);
    expect(resBlocked.body.error.code).toBe('DAY_CLOSED');

    // Partner can reopen the day with a mandatory reason
    const resReopen = await request(app)
      .post(`/api/closing/${today}/reopen`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ reason: 'Audit revision required by partner' });

    expect(resReopen.status).toBe(200);
    expect(resReopen.body.data.closing.status).toBe('reopened');

    // After reopening, cash movements are permitted again
    const resPermitted = await request(app)
      .post('/api/cash-movements')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: 'in',
        amount: 5000,
        category: 'other',
        reason: 'Permitted after reopening',
      });

    expect(resPermitted.status).toBe(201);
  });
});
