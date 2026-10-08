import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { authService } from '../modules/auth/auth.service';
import { approvalService } from '../modules/approvals/approval.service';

describe('Manager Approvals Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function createUsers() {
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
      phone: '9876543210',
    });

    const waiter = await User.create({
      name: 'Cafe Waiter',
      username: 'waiter1',
      passwordHash,
      role: 'waiter',
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

    const waiterToken = authService.generateAccessToken({
      userId: waiter._id.toString(),
      role: 'waiter',
      username: 'waiter1',
    });

    return { partner, manager, waiter, partnerToken, managerToken, waiterToken };
  }

  it('rejects trivial approval PINs and sets valid 6-digit PIN with password confirmation', async () => {
    const { managerToken } = await createUsers();

    // 1. Rejects 4-digit or non-6-digit PIN
    const resShort = await request(app)
      .post('/api/auth/approval-pin')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '1234' });
    expect(resShort.status).toBe(400);

    // 2. Rejects sequential PIN (123456)
    const resSeq = await request(app)
      .post('/api/auth/approval-pin')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '123456' });
    expect(resSeq.status).toBe(400);
    expect(resSeq.body.error.message).toMatch(/sequential/i);

    // 3. Rejects repeated PIN (111111)
    const resRep = await request(app)
      .post('/api/auth/approval-pin')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '111111' });
    expect(resRep.status).toBe(400);

    // 4. Sets valid non-trivial PIN (e.g. 849201)
    const resValid = await request(app)
      .post('/api/auth/approval-pin')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '849201' });
    expect(resValid.status).toBe(200);
    expect(resValid.body.success).toBe(true);
  });

  it('allows staff to list active approvers (id and name only)', async () => {
    const { waiterToken, manager, partner } = await createUsers();

    const res = await request(app)
      .get('/api/approvals/approvers')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map((a: { id: string }) => a.id);
    expect(ids).toContain(manager._id.toString());
    expect(ids).toContain(partner._id.toString());
  });

  it('issues single-use approval token bound to action, entityId, and params', async () => {
    const { manager, waiter, waiterToken } = await createUsers();
    await approvalService.setApprovalPin(manager._id.toString(), 'Pass@1234', '849201');

    // Waiter requests manager approval
    const res = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        approverId: manager._id.toString(),
        pin: '849201',
        action: 'discount.apply',
        entityId: 'ord_123',
        params: { type: 'percent', value: 15, reason: 'Birthday' },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const token = res.body.data.approvalToken;
    expect(typeof token).toBe('string');

    // 1. Token consumption succeeds with exact matching parameters
    const consumed = await approvalService.consumeApprovalToken({
      rawToken: token,
      action: 'discount.apply',
      entityId: 'ord_123',
      params: { type: 'percent', value: 15, reason: 'Birthday' },
      userId: waiter._id.toString(),
    });
    expect(consumed.approverId).toBe(manager._id.toString());

    // 2. Token reuse is blocked (single-use CAS)
    await expect(
      approvalService.consumeApprovalToken({
        rawToken: token,
        action: 'discount.apply',
        entityId: 'ord_123',
        params: { type: 'percent', value: 15, reason: 'Birthday' },
        userId: waiter._id.toString(),
      })
    ).rejects.toThrow(/invalid, expired, already consumed/i);
  });

  it('rejects approval token when entityId or parameters do not match', async () => {
    const { manager, waiter, waiterToken } = await createUsers();
    await approvalService.setApprovalPin(manager._id.toString(), 'Pass@1234', '849201');

    const res = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        approverId: manager._id.toString(),
        pin: '849201',
        action: 'discount.apply',
        entityId: 'ord_123',
        params: { type: 'percent', value: 15, reason: 'Birthday' },
      });

    const token = res.body.data.approvalToken;

    // Tampered entityId
    await expect(
      approvalService.consumeApprovalToken({
        rawToken: token,
        action: 'discount.apply',
        entityId: 'ord_DIFFERENT',
        params: { type: 'percent', value: 15, reason: 'Birthday' },
        userId: waiter._id.toString(),
      })
    ).rejects.toThrow();

    // Tampered params (value changed from 15 to 25)
    await expect(
      approvalService.consumeApprovalToken({
        rawToken: token,
        action: 'discount.apply',
        entityId: 'ord_123',
        params: { type: 'percent', value: 25, reason: 'Birthday' },
        userId: waiter._id.toString(),
      })
    ).rejects.toThrow();
  });

  it('locks out approver PIN after 5 consecutive failed attempts for 15 minutes', async () => {
    const { manager, waiterToken } = await createUsers();
    await approvalService.setApprovalPin(manager._id.toString(), 'Pass@1234', '849201');

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/approvals')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          approverId: manager._id.toString(),
          pin: '999999', // wrong pin
          action: 'discount.apply',
          entityId: 'ord_123',
        });
      expect(res.status).toBe(401);
    }

    // 5th attempt triggers lockout
    const res5 = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        approverId: manager._id.toString(),
        pin: '999999',
        action: 'discount.apply',
        entityId: 'ord_123',
      });
    expect(res5.status).toBe(429);
    expect(res5.body.error.code).toBe('APPROVAL_PIN_LOCKED');

    // Even with the correct PIN, requests are rejected while locked
    const resLocked = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        approverId: manager._id.toString(),
        pin: '849201', // correct pin
        action: 'discount.apply',
        entityId: 'ord_123',
      });
    expect(resLocked.status).toBe(429);
    expect(resLocked.body.error.code).toBe('APPROVAL_PIN_LOCKED');
  });
});
