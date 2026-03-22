/**
 * Load `.env` before any other app imports that read `process.env`.
 */
import dotenv from 'dotenv';

dotenv.config();
