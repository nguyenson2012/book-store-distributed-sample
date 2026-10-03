import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { startConsumer } from './consumer.js';
import { handleOrderPlaced } from './handlers/order-placed.handler.js';
import { handleOrderDelivered } from './handlers/order-delivered.handler.js';

// Map routing key → handler
const EVENT_HANDLERS = {
  'order.placed': handleOrderPlaced,
  'order.delivered': handleOrderDelivered,
};

async function bootstrap() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      BookStore — Notification Service    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // HTTP health check server (Cloud Run tự inject PORT=8080, local dùng 8081 tránh xung đột Colima)
  const PORT = process.env.PORT || 8081;
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'notification-service' }));
  }).listen(PORT, () => {
    console.log(`🌐 Health check server listening on port ${PORT}`);
  });

  // 1. Kết nối MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // 2. Khởi động RabbitMQ consumer
  await startConsumer(EVENT_HANDLERS);

  console.log('');
  console.log('🟢 Notification Service is running. Waiting for events...');
  console.log('   Press Ctrl+C to stop.\n');
}

bootstrap().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
