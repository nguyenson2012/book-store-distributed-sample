import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bookRoutes from './routes/book.routes.js';
import internalRoutes from './routes/internal.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(helmet());
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'product-service' }));

app.use('/api/v1/books', bookRoutes);
app.use('/internal/v1', internalRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
