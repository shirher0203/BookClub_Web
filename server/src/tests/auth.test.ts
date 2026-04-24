import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express, { Request, Response } from 'express';
import jwt, { type Secret } from 'jsonwebtoken';
import authMiddleware from '../middleware/authMiddleware';
import authRoute from '../routes/authRoute';
import { User } from '../models/userModel';
import { RefreshToken } from '../models/tokenModel';

describe('Auth (register/login)', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Express;

  beforeAll(async () => {
    // Ensure JWT env is present for controller execution.
    process.env.JWT_SECRET =
      process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
        ? process.env.JWT_SECRET
        : 'test-jwt-secret';
    process.env.REFRESH_TOKEN_SECRET =
      process.env.REFRESH_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET.trim().length > 0
        ? process.env.REFRESH_TOKEN_SECRET
        : 'test-refresh-secret';
    process.env.ACCESS_TOKEN_EXPIRY =
      process.env.ACCESS_TOKEN_EXPIRY && process.env.ACCESS_TOKEN_EXPIRY.trim().length > 0
        ? process.env.ACCESS_TOKEN_EXPIRY
        : '15m';
    process.env.REFRESH_TOKEN_EXPIRY =
      process.env.REFRESH_TOKEN_EXPIRY && process.env.REFRESH_TOKEN_EXPIRY.trim().length > 0
        ? process.env.REFRESH_TOKEN_EXPIRY
        : '7d';

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoute);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await RefreshToken.deleteMany({});
    await User.deleteMany({});
  });

  describe('POST /register', () => {
    it('should register successfully and exclude password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'john_reader',
        email: 'john@test.com',
        password: 'supersecret',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('username', 'john_reader');
      expect(res.body).toHaveProperty('email', 'john@test.com');
      expect(res.body).not.toHaveProperty('password');

      const inDb = await User.findOne({ email: 'john@test.com' });
      expect(inDb).not.toBeNull();
      expect(inDb?.password).toBeTruthy();
    });

    it('should return 400 on duplicate username', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'same_name',
        email: 'a@test.com',
        password: 'pass1',
      });

      const res = await request(app).post('/api/auth/register').send({
        username: 'same_name',
        email: 'b@test.com',
        password: 'pass2',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/username/i);
    });

    it('should return 400 on duplicate email', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'user1',
        email: 'same@test.com',
        password: 'pass1',
      });

      const res = await request(app).post('/api/auth/register').send({
        username: 'user2',
        email: 'same@test.com',
        password: 'pass2',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email/i);
    });
  });

  describe('POST /login', () => {
    it('should login successfully and return tokens', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'login_user',
        email: 'login@test.com',
        password: 'mypassword',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@test.com',
        password: 'mypassword',
      });

      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.log('Login failed:', res.status, res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.expiresIn).toBe('number');
      expect(res.body.expiresIn).toBeGreaterThan(0);
      expect(res.body.user).toHaveProperty('email', 'login@test.com');
      expect(res.body.user).not.toHaveProperty('password');

      const stored = await RefreshToken.findOne({ token: res.body.refreshToken });
      expect(stored).not.toBeNull();
      expect(stored?.userId).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'wrong_pass_user',
        email: 'wrong@test.com',
        password: 'correctpass',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'wrong@test.com',
        password: 'wrongpass',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 when user not found', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'missing@test.com',
        password: 'whatever',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /refresh', () => {
    it('should rotate refresh token and return new tokens', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'rot_user',
        email: 'rot@test.com',
        password: 'mypassword',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'rot@test.com',
        password: 'mypassword',
      });
      expect(loginRes.status).toBe(200);
      const oldRefresh = loginRes.body.refreshToken as string;

      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: oldRefresh,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.expiresIn).toBe('number');
      expect(res.body.refreshToken).not.toBe(oldRefresh);

      const oldInDb = await RefreshToken.findOne({ token: oldRefresh });
      expect(oldInDb).toBeNull();
      const newInDb = await RefreshToken.findOne({ token: res.body.refreshToken as string });
      expect(newInDb).not.toBeNull();
    });

    it('should return 401 for invalid refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: 'not-a-real-token',
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 for expired refresh token', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'exp_user',
        email: 'exp@test.com',
        password: 'mypassword',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'exp@test.com',
        password: 'mypassword',
      });
      expect(loginRes.status).toBe(200);
      const refreshTok = loginRes.body.refreshToken as string;

      await RefreshToken.updateOne(
        { token: refreshTok },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } }
      );

      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: refreshTok,
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('should logout and revoke refresh token', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'out_user',
        email: 'out@test.com',
        password: 'mypassword',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'out@test.com',
        password: 'mypassword',
      });
      expect(loginRes.status).toBe(200);
      const refreshTok = loginRes.body.refreshToken as string;

      const res = await request(app).post('/api/auth/logout').send({
        refreshToken: refreshTok,
      });
      expect(res.status).toBe(204);

      const inDb = await RefreshToken.findOne({ token: refreshTok });
      expect(inDb).toBeNull();
    });
  });

  describe('authMiddleware', () => {
    let guardedApp: express.Express;

    beforeAll(() => {
      guardedApp = express();
      guardedApp.use(express.json());
      guardedApp.get('/guarded', authMiddleware, (req: Request, res: Response) => {
        res.json({ id: (req as Request & { user?: { id: string } }).user?.id });
      });
    });

    it('returns 401 when the Authorization header is missing', async () => {
      const res = await request(guardedApp).get('/guarded');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    it('returns 401 for a malformed scheme, a bad signature, and a token referencing a deleted user', async () => {
      const malformed = await request(guardedApp)
        .get('/guarded')
        .set('Authorization', 'Basic abc.def.ghi');
      expect(malformed.status).toBe(401);

      const badSig = await request(guardedApp)
        .get('/guarded')
        .set('Authorization', 'Bearer abc.def.ghi');
      expect(badSig.status).toBe(401);

      const orphanId = new mongoose.Types.ObjectId().toString();
      const orphanToken = jwt.sign({ userId: orphanId }, process.env.JWT_SECRET as Secret, {
        expiresIn: '5m',
      });
      const orphan = await request(guardedApp)
        .get('/guarded')
        .set('Authorization', `Bearer ${orphanToken}`);
      expect(orphan.status).toBe(401);
      expect(orphan.body.message).toMatch(/no longer exists/i);
    });
  });
});
