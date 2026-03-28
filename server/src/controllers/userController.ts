import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import { User as UserModel } from '../models/userModel';

const uploadsDir = path.join(__dirname, '../../public/uploads/profiles');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const userId = req.user?.id ?? 'anon';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

export const profileImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function getAuthenticatedUserId(req: Request): string | undefined {
  return req.user?.id;
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  const user = await UserModel.findById(id).select('-password').lean();
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  res.status(200).json(user);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const authId = getAuthenticatedUserId(req);
  if (!authId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const user = await UserModel.findById(authId);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  const { username: rawUsername, email: rawEmail } = req.body as {
    username?: unknown;
    email?: unknown;
  };

  if (rawUsername !== undefined) {
    if (typeof rawUsername !== 'string' || !rawUsername.trim()) {
      res.status(400).json({ message: 'username must be a non-empty string.' });
      return;
    }
    const nextUsername = rawUsername.trim();
    if (nextUsername !== user.username) {
      const taken = await UserModel.findOne({ username: nextUsername, _id: { $ne: user._id } }).select('_id').lean();
      if (taken) {
        res.status(400).json({ message: 'Username already taken.' });
        return;
      }
      user.username = nextUsername;
    }
  }

  if (rawEmail !== undefined) {
    if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
      res.status(400).json({ message: 'email must be a non-empty string.' });
      return;
    }
    const nextEmail = rawEmail.trim().toLowerCase();
    if (nextEmail !== user.email) {
      const taken = await UserModel.findOne({ email: nextEmail, _id: { $ne: user._id } }).select('_id').lean();
      if (taken) {
        res.status(400).json({ message: 'Email already taken.' });
        return;
      }
      user.email = nextEmail;
    }
  }

  const file = req.file as Express.Multer.File | undefined;
  if (file) {
    user.profileImage = `/uploads/profiles/${file.filename}`;
  }

  await user.save();

  const updated = await UserModel.findById(user._id).select('-password').lean();
  res.status(200).json(updated);
}
