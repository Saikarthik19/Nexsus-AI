import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import documentRoutes from './routes/documents';
import evaluationRoutes from './routes/evaluation';
import statsRoutes from './routes/stats';
import operationsRoutes from './routes/operations';
import connectDB from './config/database';
import errorHandler from './middleware/errorHandler';

const app = express();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/operations', operationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use(errorHandler);

// Start
const start = async () => {
  await connectDB();
  const port = process.env.PORT || 5001;
  app.listen(port, () => {
    logger.info(`🚀 NexusAI Server listening on port ${port}`);
  });
};

start();

export default app;
