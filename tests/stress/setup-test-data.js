import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Nạp .env nếu có bằng tính năng built-in của Node 20+
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.resolve('../../backend/.env'));
  } catch (e) {}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5003';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:5002';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('🔧 [Setup] Bắt đầu chuẩn bị dữ liệu cho Stress Test...');

async function run() {
  // 1. Lấy danh sách sách từ Product Service
  console.log(`📡 [1/4] Đang lấy danh sách sách từ Product Service (${PRODUCT_SERVICE_URL})...`);
  let bookId = '';
  let bookTitle = '';
  try {
    const res = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/books?limit=5`);
    const data = await res.json();
    if (data.data?.books?.length > 0) {
      const book = data.data.books[0];
      bookId = book._id || book.id;
      bookTitle = book.title;
      console.log(`📚 Sách test: "${bookTitle}" (ID: ${bookId}, Stock: ${book.stock})`);
    } else {
      console.warn('⚠️  Không tìm thấy sách nào trong catalog.');
    }
  } catch (err) {
    console.error('❌ Không thể kết nối tới Product Service:', err.message);
  }

  // 2. Đăng nhập / Lấy JWT token cho khách hàng & Admin
  console.log(`🔐 [2/4] Đang đăng nhập tài khoản mẫu trên Auth Service (${AUTH_SERVICE_URL})...`);
  let customerToken = '';
  let adminToken = '';
  const userTokens = [];

  // Login customer mẫu
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@bookstore.com', password: 'Customer@123' }),
    });
    const data = await res.json();
    const token = data.accessToken || data.data?.accessToken;
    if (token) {
      customerToken = token;
      userTokens.push(customerToken);
      console.log('✅ Đăng nhập Customer mẫu thành công');
    } else {
      console.warn('⚠️  Customer login failed:', data.message || data);
    }
  } catch (err) {
    console.warn('⚠️  Customer login error:', err.message);
  }

  // Login Admin mẫu
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@bookstore.com', password: 'Admin@123456' }),
    });
    const data = await res.json();
    const token = data.accessToken || data.data?.accessToken;
    if (token) {
      adminToken = token;
      console.log('✅ Đăng nhập Admin mẫu thành công');
    } else {
      console.warn('⚠️  Admin login failed:', data.message || data);
    }
  } catch (err) {
    console.warn('⚠️  Admin login error:', err.message);
  }

  // 3. Chuẩn bị giỏ hàng cho Customer trên Backend
  if (customerToken && bookId) {
    console.log(`🛒 [3/4] Chuẩn bị giỏ hàng trên Backend Monolith (${BACKEND_URL})...`);
    try {
      // Làm sạch giỏ hàng cũ nếu có
      await fetch(`${BACKEND_URL}/api/v1/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ bookId, quantity: 1 }),
      });
      console.log('✅ Đã thêm sách vào giỏ hàng sẵn sàng cho test checkout');
    } catch (err) {
      console.warn('⚠️  Lỗi chuẩn bị giỏ hàng:', err.message);
    }
  }

  // 4. Lưu cấu hình ra file JSON để k6 nạp vào
  const config = {
    authServiceUrl: AUTH_SERVICE_URL,
    productServiceUrl: PRODUCT_SERVICE_URL,
    backendUrl: BACKEND_URL,
    testBookId: bookId,
    testBookTitle: bookTitle,
    customerToken: customerToken,
    adminToken: adminToken,
    userTokens: userTokens.length > 0 ? userTokens : [customerToken],
  };

  const configPath = path.join(DATA_DIR, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\n🎉 [4/4] Đã tạo file cấu hình cho k6 tại: ${configPath}`);
  console.log('Sẵn sàng thực thi các kịch bản test bằng k6!\n');
}

run().catch(console.error);
