import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt, { type Secret } from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import userRoute from '../routes/userRoute';
import { User } from '../models/userModel';

function signAccessToken(userId: string, username: string, email: string, secret: string): string {
  return jwt.sign({ userId, username, email }, secret as Secret, { expiresIn: '15m' });
}

describe('Users (profile)', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Express;
  let jwtSecret: string;

  beforeAll(async () => {
    jwtSecret =
      process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
        ? process.env.JWT_SECRET
        : 'test-user-jwt-secret';
    process.env.JWT_SECRET = jwtSecret;

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/users', userRoute);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('GET /api/users/:id', () => {
    it('should return 200 and user without password', async () => {
      const user = await User.create({
        username: 'public_user',
        email: 'pub@test.com',
        password: 'hashed',
        profileImage: '',
      });

      const res = await request(app).get(`/api/users/${user._id.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(user._id.toString());
      expect(res.body.username).toBe('public_user');
      expect(res.body.email).toBe('pub@test.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 404 when user does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/users/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should return 200 and update username and email', async () => {
      const user = await User.create({
        username: 'old_name',
        email: 'old@test.com',
        password: 'hash',
        profileImage: '',
      });
      const token = signAccessToken(user._id.toString(), user.username, user.email, jwtSecret);

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'new_name', email: 'new@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('new_name');
      expect(res.body.email).toBe('new@test.com');
      expect(res.body).not.toHaveProperty('password');

      const fromDb = await User.findById(user._id).lean();
      expect(fromDb?.username).toBe('new_name');
      expect(fromDb?.email).toBe('new@test.com');
    });

    it('should return 400 when updating to a username taken by another user', async () => {
      await User.create({
        username: 'taken_name',
        email: 'taken@test.com',
        password: 'hash',
        profileImage: '',
      });
      const user = await User.create({
        username: 'my_name',
        email: 'me@test.com',
        password: 'hash',
        profileImage: '',
      });
      const token = signAccessToken(user._id.toString(), user.username, user.email, jwtSecret);

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'taken_name' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/username/i);

      const fromDb = await User.findById(user._id).lean();
      expect(fromDb?.username).toBe('my_name');
    });

    it('should return 400 when updating to an email taken by another user', async () => {
      await User.create({
        username: 'other_user',
        email: 'taken@test.com',
        password: 'hash',
        profileImage: '',
      });
      const user = await User.create({
        username: 'my_name2',
        email: 'me2@test.com',
        password: 'hash',
        profileImage: '',
      });
      const token = signAccessToken(user._id.toString(), user.username, user.email, jwtSecret);

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'taken@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/email/i);

      const fromDb = await User.findById(user._id).lean();
      expect(fromDb?.email).toBe('me2@test.com');
    });

    it('should return 200 and set profileImage when file uploaded', async () => {
      const user = await User.create({
        username: 'pic_user',
        email: 'pic@test.com',
        password: 'hash',
        profileImage: '',
      });
      const token = signAccessToken(user._id.toString(), user.username, user.email, jwtSecret);

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .field('username', 'pic_user')
        .attach('profileImage', Buffer.from('fake-png'), 'avatar.png');

      expect(res.status).toBe(200);
      expect(res.body.profileImage).toMatch(/^\/uploads\/profiles\//);
      expect(res.body.profileImage).toMatch(/\.png$/i);

      const absPath = path.join(
        __dirname,
        '../../public/uploads/profiles',
        path.basename(res.body.profileImage as string)
      );
      expect(fs.existsSync(absPath)).toBe(true);

      await fs.promises.unlink(absPath).catch(() => undefined);
    });
  });
});
