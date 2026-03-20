import { Router } from 'express';
import { search, analyze } from '../controllers/aiController';

const router = Router();

/**
 * @openapi
 * /ai/search:
 *   get:
 *     summary: AI-powered search (query parsed by LLM, results from MongoDB)
 *     tags: [AI]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Natural language search query
 *     responses:
 *       200: { description: { results, parsedQuery, total } }
 *       429: { description: Too many requests (10/min per IP) }
 */
router.get('/search', search);

/**
 * @openapi
 * /ai/analyze:
 *   post:
 *     summary: Analyze a book review (sentiment, themes, summary)
 *     tags: [AI]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               postId: { type: string }
 *               text: { type: string }
 *     responses:
 *       200: { description: { sentiment, themes, summary } }
 *       400: { description: Provide postId or text }
 *       404: { description: Post not found }
 */
router.post('/analyze', analyze);

export default router;
