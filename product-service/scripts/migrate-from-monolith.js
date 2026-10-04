import 'dotenv/config';
import mongoose from 'mongoose';
import Book from '../src/models/book.model.js';
import { connectMeili } from '../src/config/meili.js';
import { indexBooks } from '../src/services/search.service.js';

const sourceUri = process.env.MONOLITH_MONGO_URI;
const destUri = process.env.MONGO_URI;

if (!sourceUri || !destUri) {
  console.error('Cần MONOLITH_MONGO_URI (DB cũ) và MONGO_URI (DB product)');
  process.exit(1);
}

const source = await mongoose.createConnection(sourceUri).asPromise();
const docs = await source.db.collection('books').find({}).toArray();
console.log(`📦 Đọc ${docs.length} sách từ monolith`);

await mongoose.connect(destUri);
await Book.deleteMany();
if (docs.length) {
  await Book.collection.insertMany(docs);
  const books = await Book.find();
  await connectMeili();
  await indexBooks(books);
  console.log(`✅ Đã copy + index ${books.length} sách sang Product MongoDB`);
}

await source.close();
await mongoose.disconnect();
process.exit(0);
