import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import internalRoutes from './routes/internal.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

// Cloud Run / reverse proxy: cần để rate-limit và cookie secure hoạt động đúng
app.set('trust proxy', 1);

app.use(helmet());
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Health check (Docker / Cloud Run probe)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Giới hạn brute-force cho route đăng nhập/đăng ký
// (bỏ qua /validate: các service khác gọi liên tục từ vài IP cố định)
app.use(
  '/api/v1/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 100, skip: (req) => req.path === '/validate' })
);
app.use('/api/v1/auth', authRoutes);

// Service-to-service (x-internal-key)
app.use('/internal/v1', internalRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
