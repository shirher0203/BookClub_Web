import { Request, Response } from 'express';
import { Comment } from '../models/commentModel';
import { Post } from '../models/postModel';

function getReqUser(req: Request): { id: string } | undefined {
  return (req as Request & { user?: { id: string } }).user;
}

export async function createComment(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { postId, text } = req.body;
  if (!postId || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ message: 'postId and text are required' });
    return;
  }
  const post = await Post.findById(postId);
  if (!post) {
    res.status(404).json({ message: 'Post not found' });
    return;
  }
  const comment = await Comment.create({
    postId,
    userId: user.id,
    text: text.trim(),
  });
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
  const populated = await Comment.findById(comment._id)
    .populate('userId', 'username profileImage _id')
    .lean();
  res.status(201).json(populated);
}

export async function getCommentsByPostId(req: Request, res: Response): Promise<void> {
  const { postId } = req.query;
  if (!postId || typeof postId !== 'string') {
    res.status(400).json({ message: 'postId query is required' });
    return;
  }
  const comments = await Comment.find({ postId })
    .sort({ createdAt: 1 })
    .populate('userId', 'username profileImage _id')
    .lean();
  res.status(200).json(comments);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  const comment = await Comment.findById(id);
  if (!comment) {
    res.status(404).json({ message: 'Comment not found' });
    return;
  }
  if (comment.userId.toString() !== user.id) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  await comment.deleteOne();
  await Post.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -1 } });
  res.status(204).send();
}
