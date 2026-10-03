import 'dotenv/config'; // phải nạp env trước khi import các file dùng process.env
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';

const PORT = process.env.PORT || 5001;

await connectDB();
connectRabbitMQ(); // Kết nối RabbitMQ bất đồng bộ — không block server start
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Bắt lỗi promise không được xử lý => tắt server êm thấm
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});