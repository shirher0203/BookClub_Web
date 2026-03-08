import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  upload,
} from '../controllers/postController';

const router = Router();

/**
 * @openapi
 * /posts:
 *   get:
 *     summary: Get paginated feed (all posts, newest first)
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Array of posts with total count }
 */
router.get('/', getFeed);

/**
 * @openapi
 * /posts/user/{id}:
 *   get:
 *     summary: Get paginated posts by user
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: skip
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Array of posts for user with total count }
 */
router.get('/user/:id', getUserPosts);

/**
 * @openapi
 * /posts:
 *   post:
 *     summary: Create a new post (book review)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [bookName]
 *             properties:
 *               bookName: { type: string }
 *               bookAuthor: { type: string }
 *               genre: { type: string }
 *               score: { type: number, minimum: 1, maximum: 5 }
 *               text: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: Post created }
 *       400: { description: Validation error (e.g. missing bookName or invalid score) }
 *       401: { description: Unauthorized }
 */
router.post('/', authMiddleware, upload.single('image'), createPost);

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     summary: Get a post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Post with populated user }
 *       404: { description: Post not found }
 */
router.get('/:id', getPostById);

/**
 * @openapi
 * /posts/{id}:
 *   put:
 *     summary: Update a post (author only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               bookName: { type: string }
 *               bookAuthor: { type: string }
 *               genre: { type: string }
 *               score: { type: number, minimum: 1, maximum: 5 }
 *               text: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       200: { description: Post updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not author) }
 *       404: { description: Post not found }
 */
router.put('/:id', authMiddleware, upload.single('image'), updatePost);

/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     summary: Delete a post and its comments (author only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Post deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not author) }
 *       404: { description: Post not found }
 */
router.delete('/:id', authMiddleware, deletePost);

export default router;
