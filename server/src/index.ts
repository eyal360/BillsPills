import express from 'express';
import cors from 'cors';
import { logger } from './lib/logger';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth';
import { propertiesRouter } from './routes/properties';
import { billsRouter } from './routes/bills';
import { chatRouter } from './routes/chat';
import { adminRouter } from './routes/admin';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

logger.info(`Starting server in ${process.env.NODE_ENV} mode...`);

// Global error handlers
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception!', err);
  // Give it a bit of time to log before exiting
  setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors());

// Simple request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '20mb' })); // This line was not explicitly changed in the provided snippet, keeping it as is from original.

// Routes
app.use('/api/auth', authRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/bills', billsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  logger.info(`🚀 BillsPills server running on port ${PORT}`);
});

export default app;
