import { Router } from 'express';
import { search } from '../controllers/searchController';

const router = Router();

/**
 * @openapi
 * /search:
 *   get:
 *     summary: Search users and/or posts (non-AI)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search text
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [users, posts, all] }
 *         description: users | posts | all (default all)
 *     responses:
 *       200: { description: users and/or posts (max 10 each for type=all) }
 *       400: { description: Invalid type }
 */
router.get('/', search);

export default router;
