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

// Middleware
app.use(cors());

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
