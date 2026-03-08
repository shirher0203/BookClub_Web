import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  createComment,
  getCommentsByPostId,
  deleteComment,
} from '../controllers/commentController';

const router = Router();

/**
 * @openapi
 * /comments:
 *   post:
 *     summary: Create a comment on a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, text]
 *             properties:
 *               postId: { type: string }
 *               text: { type: string }
 *     responses:
 *       201: { description: Comment created }
 *       400: { description: postId and text required }
 *       401: { description: Unauthorized }
 *       404: { description: Post not found }
 */
router.post('/', authMiddleware, createComment);

/**
 * @openapi
 * /comments:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of comments sorted by createdAt }
 *       400: { description: postId query required }
 */
router.get('/', getCommentsByPostId);

/**
 * @openapi
 * /comments/{id}:
 *   delete:
 *     summary: Delete a comment (author only)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Comment deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Comment not found }
 */
router.delete('/:id', authMiddleware, deleteComment);

export default router;
