import { Request, Response, RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import { User as UserModel } from '../models/userModel';

/** Authenticated requests (JWT / Passport). Local type so ts-node resolves `req.user.id` reliably. */
export interface AuthRequest extends Request {
  user?: { id: string; username?: string; email?: string };
}

/** Package root whether running from `src/` or `dist/src/` (compiled). */
const serverRoot = path.resolve(__dirname, __dirname.includes(`${path.sep}dist${path.sep}`) ? '../../..' : '../..');
const uploadsDir = path.join(serverRoot, 'public/uploads/profiles');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user?.id ?? 'anon';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const ALLOWED_IMAGE_MIMETYPES = /^image\/(jpeg|jpg|png|gif|webp)$/i;

const profileImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMETYPES.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp).'));
  },
});

/** Wraps multer's single() so upload errors are returned as JSON 400 instead of a generic 500. */
export const uploadProfileImage: RequestHandler = (req, res, next) => {
  profileImageUpload.single('profileImage')(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid file upload.';
      res.status(400).json({ message });
      return;
    }
    next();
  });
};

function getAuthenticatedUserId(req: AuthRequest): string | undefined {
  return req.user?.id;
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  try {
    const user = await UserModel.findById(id).select('-password').lean();
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json({
      _id: String(user._id),
      username: user.username,
      email: user.email,
      profileImage: user.profileImage ?? '',
      ...(user.googleId != null && user.googleId !== '' ? { googleId: user.googleId } : {}),
      createdAt: user.createdAt,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.CastError) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    throw err;
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
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
  const rawRemove = (req.body as { removeProfileImage?: unknown }).removeProfileImage;
  const wantsRemove =
    rawRemove === true || rawRemove === 'true' || rawRemove === '1';

  if (file) {
    const previous = user.profileImage;
    user.profileImage = `/uploads/profiles/${file.filename}`;
    if (previous && previous.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(serverRoot, 'public', previous);
      fs.promises.unlink(oldPath).catch(() => undefined);
    }
  } else if (wantsRemove) {
    const previous = user.profileImage;
    user.profileImage = '';
    if (previous && previous.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(serverRoot, 'public', previous);
      fs.promises.unlink(oldPath).catch(() => undefined);
    }
  }

  await user.save();

  const updated = await UserModel.findById(user._id).select('-password').lean();
  res.status(200).json(updated);
}
