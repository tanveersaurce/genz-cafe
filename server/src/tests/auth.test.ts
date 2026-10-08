import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { connectTestDb, clearTestDb, closeTestDb } from './testDb';
import { User } from '../modules/auth/models/User';
import { RefreshToken } from '../modules/auth/models/RefreshToken';
import { authService, hashToken } from '../modules/auth/auth.service';

describe('Auth & RBAC Test Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('successful login: returns accessToken and sets httpOnly refresh cookie', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    await User.create({
      name: 'Test Partner',
      username: 'partner1',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const res = await request(app).post('/api/auth/login').send({
      username: 'partner1',
      password: 'Secret@1234',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toMatchObject({
      username: 'partner1',
      role: 'partner',
    });
    // Ensure passwordHash is never returned
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
  });

  it('wrong password or unknown user returns generic invalid credentials error', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    await User.create({
      name: 'Test Partner',
      username: 'partner1',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    // 1. Wrong password
    const wrongPassRes = await request(app).post('/api/auth/login').send({
      username: 'partner1',
      password: 'WrongPassword',
    });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.error.message).toBe('Invalid username or password');

    // 2. Unknown user
    const unknownUserRes = await request(app).post('/api/auth/login').send({
      username: 'nonexistent',
      password: 'Secret@1234',
    });
    expect(unknownUserRes.status).toBe(401);
    expect(unknownUserRes.body.error.message).toBe('Invalid username or password');
  });

  it('account lockout after 5 consecutive failed login attempts', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    await User.create({
      name: 'Locked User',
      username: 'targetuser',
      passwordHash,
      role: 'cashier',
      isActive: true,
    });

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({
        username: 'targetuser',
        password: 'IncorrectPassword',
      });
      expect(res.status).toBe(401);
    }

    // 6th attempt: should now be locked
    const lockedRes = await request(app).post('/api/auth/login').send({
      username: 'targetuser',
      password: 'Secret@1234', // Even with correct password
    });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(lockedRes.body.error.message).toContain('Account is temporarily locked');
  });

  it('inactive user is blocked from logging in', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    await User.create({
      name: 'Deactivated User',
      username: 'deactivated',
      passwordHash,
      role: 'waiter',
      isActive: false,
    });

    const res = await request(app).post('/api/auth/login').send({
      username: 'deactivated',
      password: 'Secret@1234',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('deactivated');
  });

  it('refresh token rotation works as expected', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    const user = await User.create({
      name: 'Partner User',
      username: 'partner_rot',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const { rawRefreshToken: initialRawToken } = await authService.createSession(user);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${initialRawToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');

    const newCookies = res.headers['set-cookie'];
    expect(newCookies).toBeDefined();

    // Verify old token is marked revoked and has replacedByTokenHash in database
    const oldTokenDoc = await RefreshToken.findOne({ tokenHash: hashToken(initialRawToken) });
    expect(oldTokenDoc?.revokedAt).toBeDefined();
    expect(oldTokenDoc?.replacedByTokenHash).toBeDefined();
  });

  it('reuse of a revoked refresh token revokes all user sessions (token theft detection)', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    const user = await User.create({
      name: 'Compromised User',
      username: 'compromised',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    // Session 1 and Session 2 (e.g. tablet & mobile)
    const { rawRefreshToken: token1 } = await authService.createSession(user);
    const { rawRefreshToken: token2 } = await authService.createSession(user);

    // Legitimate rotation of token 1
    const rotRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);
    expect(rotRes.status).toBe(200);

    // Malicious attacker tries to use revoked token 1 again
    const theftRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);

    expect(theftRes.status).toBe(401);
    expect(theftRes.body.error.message.toLowerCase()).toContain('security violation');

    // Verify session 2 was ALSO revoked due to theft detection
    const token2Doc = await RefreshToken.findOne({ tokenHash: hashToken(token2) });
    expect(token2Doc?.revokedAt).toBeDefined();
  });

  it('permission denied (403) for waiter on /api/users', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    const waiter = await User.create({
      name: 'Waiter Staff',
      username: 'waiter1',
      passwordHash,
      role: 'waiter',
      isActive: true,
    });

    const accessToken = authService.generateAccessToken({
      userId: waiter._id.toString(),
      role: 'waiter',
    });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Forbidden');
  });

  it('partner can manage staff and safeguards prevent self-deactivation and last-partner demotion', async () => {
    const passwordHash = await authService.hashPassword('Secret@1234');
    const partner = await User.create({
      name: 'Sole Partner',
      username: 'sole_partner',
      passwordHash,
      role: 'partner',
      isActive: true,
    });

    const partnerToken = authService.generateAccessToken({
      userId: partner._id.toString(),
      role: 'partner',
    });

    // 1. Partner can create a new cashier
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        name: 'New Cashier',
        username: 'cashier1',
        role: 'cashier',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.user.username).toBe('cashier1');
    expect(createRes.body.data).toHaveProperty('temporaryPassword');

    // 2. Safeguard: Partner cannot deactivate themselves
    const selfDeactRes = await request(app)
      .patch(`/api/users/${partner._id}/status`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ isActive: false });

    expect(selfDeactRes.status).toBe(400);
    expect(selfDeactRes.body.error.code).toBe('FORBIDDEN');
    expect(selfDeactRes.body.error.message).toContain('cannot deactivate your own account');

    // 3. Safeguard: Cannot demote the last active partner
    const selfDemoteRes = await request(app)
      .patch(`/api/users/${partner._id}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ role: 'manager' });

    expect(selfDemoteRes.status).toBe(400);
    expect(selfDemoteRes.body.error.message).toContain('cannot demote');
  });
});
