import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectMeili } from './config/meili.js';
import { connectRedis } from './config/redis.js';
import Book from './models/book.model.js';
import { indexBooks } from './services/search.service.js';

const PORT = process.env.PORT || 5002;

// 1. Lắng nghe ngay lập tức trên PORT để vượt qua Cloud Run Startup Probe
const server = app.listen(PORT, () => {
  console.log(`🚀 Product Service running on port ${PORT}`);
});

// 2. Khởi tạo các kết nối dịch vụ bất đồng bộ (không block startup probe)
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
  }

  try {
    connectRedis();
  } catch (err) {
    console.error('❌ Lỗi kết nối Redis:', err.message);
  }

  try {
    await connectMeili();
    const books = await Book.find().catch(() => []);
    if (books.length) {
      await indexBooks(books);
      console.log(`🔎 Đã đồng bộ ${books.length} sách lên Meilisearch`);
    }
  } catch (err) {
    console.warn('⚠️ Meilisearch khởi tạo chưa sẵn sàng:', err.message);
  }
})();

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
