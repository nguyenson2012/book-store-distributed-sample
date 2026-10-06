import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';

// Copy collection `users` từ DB monolith sang DB riêng của auth-service.
//  - Idempotent: upsert theo _id, chạy lại nhiều lần an toàn
//  - Giữ nguyên _id (các service khác tham chiếu user theo _id) và hash mật khẩu
//  - KHÔNG xoá/sửa gì ở DB nguồn
// Dùng:  npm run migrate           (copy thật)
//        npm run migrate -- --dry-run   (chỉ đếm, không ghi)

const sourceUri = process.env.MONOLITH_MONGO_URI;
const destUri = process.env.MONGO_URI;
const dryRun = process.argv.includes('--dry-run');

if (!sourceUri || !destUri) {
  console.error('Cần MONOLITH_MONGO_URI (DB monolith) và MONGO_URI (DB auth-service)');
  process.exit(1);
}

const source = await mongoose.createConnection(sourceUri).asPromise();
const sourceDbName = source.db.databaseName;
const destConn = await mongoose.createConnection(destUri).asPromise();
const destDbName = destConn.db.databaseName;
await destConn.close();

console.log(`🔎 Nguồn: ${sourceDbName}.users  →  Đích: ${destDbName}.users`);
if (sourceDbName === destDbName) {
  console.error('❌ DB nguồn và đích trùng nhau — đặt MONGO_URI của auth-service sang DB khác (vd: /bookstore_auth)');
  process.exit(1);
}

const docs = await source.db.collection('users').find({}).toArray();
console.log(`📦 Đọc ${docs.length} user từ monolith`);

if (dryRun) {
  console.log('🧪 --dry-run: không ghi gì vào DB đích');
} else {
  await mongoose.connect(destUri);
  await User.syncIndexes(); // tạo unique index email trên DB mới
  if (docs.length) {
    // collection-level => bỏ qua pre('save'), không hash lại password
    const res = await User.collection.bulkWrite(
      docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } }))
    );
    console.log(`✍️  upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}, matched: ${res.matchedCount}`);
  }
  const total = await User.countDocuments();
  console.log(`✅ ${destDbName}.users hiện có ${total} user (nguồn: ${docs.length})`);
  await mongoose.disconnect();
}

await source.close();
process.exit(0);
