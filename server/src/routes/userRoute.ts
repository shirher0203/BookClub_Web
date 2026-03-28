import 'express-async-errors';
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getProfile, profileImageUpload, updateProfile } from '../controllers/userController';

const router = Router();

/**
 * @openapi
 * /users/profile:
 *   put:
 *     summary: Update current user profile (optional profile image)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               profileImage: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated user (password excluded) }
 *       400: { description: Validation or uniqueness error }
 *       401: { description: Unauthorized }
 *       404: { description: User not found }
 */
router.put('/profile', authMiddleware, profileImageUpload.single('profileImage'), updateProfile);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get public user profile by id
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User (password excluded) }
 *       404: { description: User not found }
 */
router.get('/:id', getProfile);

export default router;
