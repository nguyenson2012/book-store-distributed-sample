import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';

// Seed tài khoản admin + customer mẫu cho DB của auth-service.
// An toàn: chỉ tạo nếu email chưa tồn tại, KHÔNG xoá user nào. `--reset` mới xoá toàn bộ users.
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Không được chạy seed ở môi trường production');
  process.exit(1);
}

const ADMIN = {
  name: 'Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@bookstore.com',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
  role: 'admin',
  emailVerified: true,
};

const CUSTOMER = {
  name: 'Nguyễn Văn A',
  email: 'customer@bookstore.com',
  password: 'Customer@123',
  role: 'customer',
  emailVerified: true,
  addresses: [
    { fullName: 'Nguyễn Văn A', phone: '0900000000', street: '1 Đại Cồ Việt', city: 'Hà Nội', isDefault: true },
  ],
};

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Đã kết nối ${mongoose.connection.name}`);

  if (process.argv.includes('--reset')) {
    await User.deleteMany();
    console.log('🗑️  Đã xóa toàn bộ users');
  }

  for (const u of [ADMIN, CUSTOMER]) {
    if (await User.exists({ email: u.email })) {
      console.log(`⏭️  Bỏ qua (đã tồn tại): ${u.email}`);
    } else {
      await User.create(u); // create() để hook pre('save') băm mật khẩu bcrypt
      console.log(`👤 Đã tạo: ${u.email}`);
    }
  }

  console.log('\n──────── Thông tin đăng nhập ────────');
  console.log(`Admin    : ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`Customer : ${CUSTOMER.email} / ${CUSTOMER.password}`);
} catch (err) {
  console.error('❌ Seed thất bại:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
