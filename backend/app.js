import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import bookRoutes from './modules/books/book.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(helmet());
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));

// Xác thực & hồ sơ user (/auth/*) do Auth Service phục vụ; monolith xác thực qua authClient.validateToken
// Mỗi module = một nhóm route độc lập (dễ tách microservice sau này)
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;