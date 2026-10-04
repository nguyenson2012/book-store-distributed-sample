import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectMeili } from './config/meili.js';
import { connectRedis } from './config/redis.js';
import Book from './models/book.model.js';
import { indexBooks } from './services/search.service.js';

const PORT = process.env.PORT || 5002;

await connectDB();
connectRedis();
await connectMeili();

try {
  const books = await Book.find();
  if (books.length) {
    await indexBooks(books);
    console.log(`🔎 Đã đồng bộ ${books.length} sách lên Meilisearch`);
  }
} catch (err) {
  console.error('Không reindex lúc start:', err.message);
}

const server = app.listen(PORT, () => console.log(`🚀 Product Service running on port ${PORT}`));

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});
