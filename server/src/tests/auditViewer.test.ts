import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { authService } from '../modules/auth/auth.service';
import { AuditLog } from '../modules/audit/audit.model';
import { sanitizeCsvCell, redactMetadata } from '../modules/audit/auditViewer.service';

describe('Audit Viewer Test Suite', () => {
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

    const waiterToken = authService.generateAccessToken({
      userId: waiter._id.toString(),
      role: 'waiter',
      username: 'waiter1',
    });

    return { partner, waiter, partnerToken, waiterToken };
  }

  it('prohibits any mutation on /api/audit returning 405 Method Not Allowed', async () => {
    const { partnerToken } = await setupStaff();

    const resPost = await request(app)
      .post('/api/audit')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ action: 'tamper' });
    expect(resPost.status).toBe(405);
    expect(resPost.body.error.code).toBe('METHOD_NOT_ALLOWED');

    const resDelete = await request(app)
      .delete('/api/audit')
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(resDelete.status).toBe(405);

    const resPut = await request(app)
      .put('/api/audit/123')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({});
    expect(resPut.status).toBe(405);
  });

  it('restricts /api/audit access strictly to partner role (audit:view)', async () => {
    const { waiterToken, partnerToken } = await setupStaff();

    // Waiter gets 403 Forbidden
    const resWaiter = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(resWaiter.status).toBe(403);

    // Partner gets 200 OK
    const resPartner = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(resPartner.status).toBe(200);
    expect(resPartner.body.success).toBe(true);
  });

  it('redacts sensitive fields and masks phone numbers at read layer', () => {
    const rawMeta = {
      orderId: 'ord_1',
      password: 'plain_password',
      pin: '123456',
      token: 'secret_token',
      apiKeyHash: 'hash123',
      customerPhone: '9876543210',
      nested: {
        pinHash: 'xyz',
        customerMobile: '+919876543210',
        amount: 500,
      },
    };

    const redacted = redactMetadata(rawMeta) as Record<string, unknown> & {
      nested: Record<string, unknown>;
      customerPhone?: string;
    };
    expect(redacted.password).toBeUndefined();
    expect(redacted.pin).toBeUndefined();
    expect(redacted.token).toBeUndefined();
    expect(redacted.apiKeyHash).toBeUndefined();
    expect(redacted.customerPhone).toBe('******3210');
    expect(redacted.nested.pinHash).toBeUndefined();
    expect(redacted.nested.amount).toBe(500);
    expect(redacted.nested.customerMobile).toBe('******3210');
  });

  it('escapes CSV formula injection characters (=, +, -, @)', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
    expect(sanitizeCsvCell('+12345')).toBe('"\' +12345"'.replace(' ', ''));
    expect(sanitizeCsvCell('@cmd')).toBe('"\'@cmd"');
    expect(sanitizeCsvCell('Normal Text')).toBe('"Normal Text"');
  });

  it('supports keyset cursor pagination on createdAt and _id', async () => {
    const { partner, partnerToken } = await setupStaff();

    // Seed 5 audit logs with staggered timestamps
    for (let i = 0; i < 5; i++) {
      await AuditLog.create({
        actorId: partner._id,
        actorName: partner.name,
        action: `test.action_${i}`,
        entityType: 'Test',
        entityId: `id_${i}`,
        createdAt: new Date(Date.now() - (5 - i) * 1000),
      });
    }

    // Page 1 with limit = 2
    const res1 = await request(app)
      .get('/api/audit?limit=2')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.entries.length).toBe(2);
    expect(res1.body.data.hasMore).toBe(true);
    const cursor = res1.body.data.nextCursor;
    expect(cursor).toBeDefined();

    // Page 2 using cursor
    const res2 = await request(app)
      .get(`/api/audit?limit=2&cursor=${encodeURIComponent(cursor)}`)
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.entries.length).toBe(2);
    // Entries should not overlap
    const idsPage1 = res1.body.data.entries.map((e: { _id: string }) => e._id);
    const idsPage2 = res2.body.data.entries.map((e: { _id: string }) => e._id);
    expect(idsPage1.some((id: string) => idsPage2.includes(id))).toBe(false);
  });

  it('streams CSV export with correct headers and download filename', async () => {
    const { partner, partnerToken } = await setupStaff();

    await AuditLog.create({
      actorId: partner._id,
      actorName: partner.name,
      action: 'order.item_cancelled',
      entityType: 'Order',
      entityId: 'ord_99',
      metadata: { reason: 'Customer changed mind' },
    });

    const res = await request(app)
      .get('/api/audit/export.csv')
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="audit-.*\.csv"/);
    expect(res.text).toContain('Timestamp (IST),Actor,Action,Entity Type,Entity ID,IP,User Agent,Metadata');
    expect(res.text).toContain('order.item_cancelled');
  });
});
