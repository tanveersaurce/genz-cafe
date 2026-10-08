import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { RefreshToken } from '../modules/auth/models/RefreshToken';
import { authService } from '../modules/auth/auth.service';
import { deviceService } from '../modules/devices/device.service';

describe('Fast PIN Login & Trusted Devices Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function setupStaffAndDevice() {
    const passwordHash = await authService.hashPassword('Pass@1234');

    const partner = await User.create({
      name: 'Cafe Partner',
      username: 'partner1',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const waiter = await User.create({
      name: 'Rohan Waiter',
      username: 'rohan',
      passwordHash,
      role: 'waiter',
      isActive: true,
    });

    const cashier = await User.create({
      name: 'Priya Cashier',
      username: 'priya',
      passwordHash,
      role: 'cashier',
      isActive: true,
    });

    const marketing = await User.create({
      name: 'Marketing Staff',
      username: 'marketing1',
      passwordHash,
      role: 'marketing',
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
      username: 'rohan',
    });

    return { partner, waiter, cashier, marketing, partnerToken, waiterToken };
  }

  it('rejects trivial 4-digit PINs and sets valid 4-digit PIN with password check', async () => {
    const { waiterToken } = await setupStaffAndDevice();

    // Rejects sequential (1234)
    const resSeq = await request(app)
      .post('/api/auth/login-pin')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '1234' });
    expect(resSeq.status).toBe(400);

    // Rejects repeated (0000)
    const resRep = await request(app)
      .post('/api/auth/login-pin')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '0000' });
    expect(resRep.status).toBe(400);

    // Sets valid PIN (7492)
    const resValid = await request(app)
      .post('/api/auth/login-pin')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ currentPassword: 'Pass@1234', pin: '7492' });
    expect(resValid.status).toBe(200);
    expect(resValid.body.success).toBe(true);
  });

  it('registers trusted device with partner password verification and sets device cookie', async () => {
    const { partnerToken } = await setupStaffAndDevice();

    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        name: 'POS Terminal 1',
        password: 'Pass@1234',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('POS Terminal 1');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('device_token='))).toBe(true);
  });

  it('/api/auth/pin/users returns only eligible staff (waiter, cashier, kitchen) on a trusted device and omits partner/marketing', async () => {
    const { partner, waiter, cashier } = await setupStaffAndDevice();
    await authService.setLoginPin(waiter._id.toString(), 'Pass@1234', '7492');
    await authService.setLoginPin(cashier._id.toString(), 'Pass@1234', '8591');

    // Without device cookie -> 401 DEVICE_UNREGISTERED
    const resNoDev = await request(app).get('/api/auth/pin/users');
    expect(resNoDev.status).toBe(401);
    expect(resNoDev.body.error.code).toBe('DEVICE_UNREGISTERED');

    // Register device
    const { rawToken } = await deviceService.registerDevice({
      name: 'Counter Tab',
      partnerId: partner._id.toString(),
      partnerPassword: 'Pass@1234',
    });

    const res = await request(app)
      .get('/api/auth/pin/users')
      .set('Cookie', [`device_token=${rawToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const usernames = res.body.data.users.map((u: { username: string }) => u.username);
    expect(usernames).toContain('rohan');
    expect(usernames).toContain('priya');
    expect(usernames).not.toContain('partner1');
    expect(usernames).not.toContain('marketing1');
  });

  it('allows fast PIN login on a trusted device and issues 12h session bound to device', async () => {
    const { partner, waiter } = await setupStaffAndDevice();
    await authService.setLoginPin(waiter._id.toString(), 'Pass@1234', '7492');

    // Register device
    const { rawToken, device } = await deviceService.registerDevice({
      name: 'Counter Tab',
      partnerId: partner._id.toString(),
      partnerPassword: 'Pass@1234',
    });

    // Login with PIN on trusted terminal
    const res = await request(app)
      .post('/api/auth/pin/login')
      .set('Cookie', [`device_token=${rawToken}`])
      .send({
        userId: waiter._id.toString(),
        pin: '7492',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('rohan');
    expect(res.body.data.accessToken).toBeDefined();

    // Verify session recorded with deviceId
    const storedToken = await RefreshToken.findOne({
      userId: waiter._id,
      deviceId: device._id,
    });
    expect(storedToken).not.toBeNull();
    expect(storedToken?.loginMethod).toBe('pin');
  });

  it('rejects PIN login from an untrusted device (missing or invalid cookie)', async () => {
    const { waiter } = await setupStaffAndDevice();
    await authService.setLoginPin(waiter._id.toString(), 'Pass@1234', '7492');

    // Attempt PIN login without device cookie -> 401 DEVICE_UNREGISTERED
    const resNoCookie = await request(app)
      .post('/api/auth/pin/login')
      .send({
        userId: waiter._id.toString(),
        pin: '7492',
      });

    expect(resNoCookie.status).toBe(401);
    expect(resNoCookie.body.error.code).toBe('DEVICE_UNREGISTERED');

    // Attempt with invalid device cookie -> 401 DEVICE_REVOKED
    const resBadCookie = await request(app)
      .post('/api/auth/pin/login')
      .set('Cookie', ['device_token=random-invalid-token'])
      .send({
        userId: waiter._id.toString(),
        pin: '7492',
      });

    expect(resBadCookie.status).toBe(401);
    expect(resBadCookie.body.error.code).toBe('DEVICE_REVOKED');
  });

  it('locks out staff PIN login after 5 consecutive failed attempts', async () => {
    const { partner, waiter } = await setupStaffAndDevice();
    await authService.setLoginPin(waiter._id.toString(), 'Pass@1234', '7492');

    const { rawToken } = await deviceService.registerDevice({
      name: 'Terminal 2',
      partnerId: partner._id.toString(),
      partnerPassword: 'Pass@1234',
    });

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/auth/pin/login')
        .set('Cookie', [`device_token=${rawToken}`])
        .send({
          userId: waiter._id.toString(),
          pin: '9999', // wrong pin
        });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt locks user
    const res5 = await request(app)
      .post('/api/auth/pin/login')
      .set('Cookie', [`device_token=${rawToken}`])
      .send({
        userId: waiter._id.toString(),
        pin: '9999',
      });
    expect(res5.status).toBe(429);
    expect(res5.body.error.code).toBe('PIN_LOCKED');

    // Locked even with right PIN
    const resLocked = await request(app)
      .post('/api/auth/pin/login')
      .set('Cookie', [`device_token=${rawToken}`])
      .send({
        userId: waiter._id.toString(),
        pin: '7492',
      });
    expect(resLocked.status).toBe(429);
    expect(resLocked.body.error.code).toBe('PIN_LOCKED');
  });

  it('revoking trusted device terminates all active sessions associated with it', async () => {
    const { partner, waiter, partnerToken } = await setupStaffAndDevice();
    await authService.setLoginPin(waiter._id.toString(), 'Pass@1234', '7492');

    const { rawToken, device } = await deviceService.registerDevice({
      name: 'Terminal 3',
      partnerId: partner._id.toString(),
      partnerPassword: 'Pass@1234',
    });

    // Create session on this device
    await request(app)
      .post('/api/auth/pin/login')
      .set('Cookie', [`device_token=${rawToken}`])
      .send({
        userId: waiter._id.toString(),
        pin: '7492',
      });

    // Partner revokes device
    const resRevoke = await request(app)
      .post(`/api/devices/${device._id}/revoke`)
      .set('Authorization', `Bearer ${partnerToken}`);

    expect(resRevoke.status).toBe(200);

    // Active refresh token should now be revoked
    const revokedTokens = await RefreshToken.find({
      deviceId: device._id,
      revokedAt: { $ne: null },
    });
    expect(revokedTokens.length).toBeGreaterThan(0);
  });
});
