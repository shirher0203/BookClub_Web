import { Request, Response } from 'express';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(q: string): RegExp {
  return new RegExp(escapeRegex(q.trim()), 'i');
}

export async function search(req: Request, res: Response): Promise<void> {
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rawType = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const type = rawType === '' ? 'all' : rawType;

  if (!rawQ) {
    if (type === 'users') {
      res.json({ users: [] });
      return;
    }
    if (type === 'posts') {
      res.json({ posts: [] });
      return;
    }
    res.json({ users: [], posts: [] });
    return;
  }

  const regex = buildRegex(rawQ);

  if (type === 'users') {
    const users = await User.find({ username: regex })
      .limit(10)
      .select('_id username profileImage')
      .lean();
    res.json({
      users: users.map((u) => ({
        _id: u._id.toString(),
        username: u.username,
        profileImage: u.profileImage ?? '',
      })),
    });
    return;
  }

  if (type === 'posts') {
    const posts = await Post.find({
      $or: [{ bookName: regex }, { bookAuthor: regex }],
    })
      .limit(10)
      .sort({ createdAt: -1 })
      .populate('userId', 'username profileImage _id')
      .lean();
    res.json({ posts });
    return;
  }

  if (type === 'all') {
    const [users, posts] = await Promise.all([
      User.find({ username: regex })
        .limit(10)
        .select('_id username profileImage')
        .lean(),
      Post.find({
        $or: [{ bookName: regex }, { bookAuthor: regex }],
      })
        .limit(10)
        .sort({ createdAt: -1 })
        .populate('userId', 'username profileImage _id')
        .lean(),
    ]);
    res.json({
      users: users.map((u) => ({
        _id: u._id.toString(),
        username: u.username,
        profileImage: u.profileImage ?? '',
      })),
      posts,
    });
    return;
  }

  res.status(400).json({ message: 'type must be users, posts, or all' });
}
