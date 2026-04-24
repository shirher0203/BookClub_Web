import { Request, Response, RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import { Post } from '../models/postModel';
import { Comment } from '../models/commentModel';

const uploadsDir = path.join(__dirname, '../../public/uploads/posts');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id ?? 'anon';
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${userId}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_IMAGE_MIMETYPES = /^image\/(jpeg|jpg|png|gif|webp)$/i;

const multerUpload = multer({
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
export const uploadImage: RequestHandler = (req, res, next) => {
  multerUpload.single('image')(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid file upload.';
      res.status(400).json({ message });
      return;
    }
    next();
  });
};

function getReqUser(req: Request): { id: string } | undefined {
  return (req as Request & { user?: { id: string } }).user;
}

function validateScore(score: unknown): boolean {
  if (score === undefined || score === null) return true;
  const n = Number(score);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export async function createPost(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { bookName, bookAuthor, genre, score, text } = req.body;
  if (!bookName || typeof bookName !== 'string' || !bookName.trim()) {
    res.status(400).json({ message: 'bookName is required' });
    return;
  }
  if (score !== undefined && score !== null && !validateScore(score)) {
    res.status(400).json({ message: 'score must be between 1 and 5' });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  const imagePath = file ? `/uploads/posts/${file.filename}` : undefined;
  const post = await Post.create({
    userId: user.id,
    bookName: (bookName as string).trim(),
    bookAuthor: bookAuthor != null ? String(bookAuthor).trim() : undefined,
    genre: genre != null ? String(genre).trim() : undefined,
    score: score != null ? Number(score) : undefined,
    text: (text ?? '').trim(),
    image: imagePath,
    likesCount: 0,
    commentsCount: 0,
  });
  const populated = await Post.findById(post._id)
    .populate('userId', 'username profileImage _id')
    .lean();
  res.status(201).json(populated);
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username profileImage _id')
    .lean();
  const total = await Post.countDocuments();
  res.json({ posts, total });
}

export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const { id: userId } = req.params;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    res.status(400).json({ message: 'Invalid user id.' });
    return;
  }
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const posts = await Post.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username profileImage _id')
    .lean();
  const total = await Post.countDocuments({ userId });
  res.json({ posts, total });
}

export async function getPostById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const post = await Post.findById(id)
    .populate('userId', 'username profileImage _id')
    .lean();
  if (!post) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  res.json(post);
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  if (post.userId.toString() !== user.id) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  const { bookName, bookAuthor, genre, score, text } = req.body;
  if (score !== undefined && score !== null && !validateScore(score)) {
    res.status(400).json({ message: 'score must be between 1 and 5' });
    return;
  }
  if (bookName !== undefined) post.bookName = String(bookName).trim();
  if (bookAuthor !== undefined) post.bookAuthor = bookAuthor == null ? undefined : String(bookAuthor).trim();
  if (genre !== undefined) post.genre = genre == null ? undefined : String(genre).trim();
  if (score !== undefined) post.score = score == null ? undefined : Number(score);
  if (text !== undefined) post.text = String(text).trim();
  const file = req.file as Express.Multer.File | undefined;
  if (file) post.image = `/uploads/posts/${file.filename}`;
  await post.save();
  const populated = await Post.findById(post._id)
    .populate('userId', 'username profileImage _id')
    .lean();
  res.json(populated);
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  if (post.userId.toString() !== user.id) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  await Comment.deleteMany({ postId: id });
  await Post.findByIdAndDelete(id);
  res.status(204).send();
}

export async function toggleLike(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  const userId = user.id;
  const isLiked = post.likes.some((oid) => oid.toString() === userId);
  const update = isLiked
    ? { $pull: { likes: userId }, $inc: { likesCount: -1 } }
    : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } };
  const updated = await Post.findByIdAndUpdate(
    id,
    update,
    { new: true }
  )
    .populate('userId', 'username profileImage _id')
    .lean();
  res.status(200).json(updated);
}
