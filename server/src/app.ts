import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import cors from 'cors';
import mongoose from 'mongoose';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import aiRoute from './routes/aiRoute';
import authRoute from './routes/authRoute';
import searchRoute from './routes/searchRoute';
import postRoute from './routes/postRoute';
import commentRoute from './routes/commentRoute';
import userRoute from './routes/userRoute';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const serverRoot = path.resolve(
  __dirname,
  __dirname.includes(`${path.sep}dist${path.sep}`) ? '../..' : '..'
);
app.use('/uploads', express.static(path.join(serverRoot, 'public/uploads')));

app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);
app.use('/api/posts', postRoute);
app.use('/api/comments', commentRoute);
app.use('/api/ai', aiRoute);
app.use('/api/search', searchRoute);

app.get('/api/health', (_req, res) => {
  res.json({
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    uptime: process.uptime(),
  });
});

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'BookClub API', version: '1.0.0' },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [path.join(__dirname, 'routes/*.ts'), path.join(__dirname, 'routes/*.js')],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const clientDist = path.join(serverRoot, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  const status =
    (err as { statusCode?: number }).statusCode ??
    (err as { status?: number }).status ??
    500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(status).json({ message });
});

export default app;
