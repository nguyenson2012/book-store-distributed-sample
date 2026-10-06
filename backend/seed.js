import 'dotenv/config';
import mongoose from 'mongoose';
import Book from './modules/books/book.model.js';
import Cart from './modules/cart/cart.model.js';
import Order from './modules/orders/order.model.js';

// Chặn chạy nhầm trên production (script này xóa toàn bộ dữ liệu)
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Không được chạy seed ở môi trường production');
  process.exit(1);
}

// Hàm rút gọn để khai báo sách ngắn gọn hơn
const b = (title, author, category, price, discountPrice, stock, description) => ({
  title, author, category, price, discountPrice, stock, description,
});

const BOOKS = [
  // Văn học
  b('Dế Mèn Phiêu Lưu Ký', 'Tô Hoài', 'Văn học', 68000, 55000, 120, 'Tác phẩm kinh điển của văn học thiếu nhi Việt Nam.'),
  b('Số Đỏ', 'Vũ Trọng Phụng', 'Văn học', 75000, 62000, 80, 'Tiểu thuyết trào phúng nổi tiếng về xã hội thành thị đầu thế kỷ 20.'),
  b('Tôi Thấy Hoa Vàng Trên Cỏ Xanh', 'Nguyễn Nhật Ánh', 'Văn học', 125000, 99000, 200, 'Câu chuyện tuổi thơ ở một làng quê miền Trung.'),
  b('Mắt Biếc', 'Nguyễn Nhật Ánh', 'Văn học', 110000, 89000, 150, 'Chuyện tình đơn phương day dứt của Ngạn dành cho Hà Lan.'),
  b('Nhà Giả Kim', 'Paulo Coelho', 'Văn học', 79000, 65000, 300, 'Hành trình đi tìm kho báu và ý nghĩa cuộc sống của cậu bé chăn cừu Santiago.'),
  b('Harry Potter và Hòn Đá Phù Thủy', 'J.K. Rowling', 'Thiếu nhi', 135000, 115000, 90, 'Phần đầu tiên trong loạt truyện phù thủy nổi tiếng thế giới.'),

  // Kỹ năng sống
  b('Đắc Nhân Tâm', 'Dale Carnegie', 'Kỹ năng sống', 86000, 69000, 250, 'Nghệ thuật đối nhân xử thế và giao tiếp.'),
  b('Atomic Habits', 'James Clear', 'Kỹ năng sống', 189000, 159000, 180, 'Xây dựng thói quen tốt, loại bỏ thói quen xấu bằng những thay đổi nhỏ.'),
  b('Tư Duy Nhanh Và Chậm', 'Daniel Kahneman', 'Kỹ năng sống', 199000, 169000, 70, 'Hai hệ thống tư duy chi phối cách chúng ta đưa ra quyết định.'),

  // Kinh tế
  b('Nghĩ Giàu Làm Giàu', 'Napoleon Hill', 'Kinh tế', 98000, 79000, 140, 'Những nguyên tắc tư duy tạo nên thành công tài chính.'),
  b('Cha Giàu Cha Nghèo', 'Robert T. Kiyosaki', 'Kinh tế', 95000, 76000, 160, 'Bài học về tiền bạc và đầu tư từ hai người cha có quan điểm trái ngược.'),

  // Khoa học
  b('Sapiens: Lược Sử Loài Người', 'Yuval Noah Harari', 'Khoa học', 229000, 189000, 100, 'Lịch sử loài người từ thời nguyên thủy đến hiện đại.'),
  b('Lược Sử Thời Gian', 'Stephen Hawking', 'Khoa học', 120000, null, 60, 'Giải thích vũ trụ, hố đen và thời gian cho độc giả phổ thông.'),

  // Công nghệ
  b('Clean Code', 'Robert C. Martin', 'Công nghệ', 450000, 380000, 40, 'Nghệ thuật viết mã sạch, dễ đọc và dễ bảo trì.'),
  b('The Pragmatic Programmer', 'Andrew Hunt, David Thomas', 'Công nghệ', 520000, null, 25, 'Những thực hành thực tế giúp lập trình viên trở nên chuyên nghiệp hơn.'),

  // Trinh thám
  b('Sherlock Holmes Toàn Tập', 'Arthur Conan Doyle', 'Trinh thám', 280000, 230000, 5, 'Tuyển tập các vụ án của thám tử lừng danh Sherlock Holmes.'),
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Đã kết nối MongoDB');

  // Xóa dữ liệu cũ
  await Promise.all([
    Order.deleteMany(),
    Cart.deleteMany(),
    Book.deleteMany(),
  ]);
  console.log('🗑️  Đã xóa dữ liệu cũ');

  // Chạy validator của schema (VD: discountPrice < price)
  if (process.env.PRODUCT_SERVICE_URL) {
    console.log('📚 Bỏ seed sách trên monolith — chạy `npm run seed` trong product-service');
  } else {
    const books = await Book.insertMany(BOOKS);
    console.log(`📚 Đã tạo ${books.length} cuốn sách`);
  }

  console.log('ℹ️  Tài khoản admin/customer do auth-service quản lý — chạy `npm run seed` trong auth-service');
};

const main = async () => {
  try {
    // `npm run seed:destroy` chỉ xóa dữ liệu, không nạp lại
    if (process.argv.includes('--destroy')) {
      await mongoose.connect(process.env.MONGO_URI);
      await Promise.all([Order.deleteMany(), Cart.deleteMany(), Book.deleteMany()]);
      console.log('🗑️  Đã xóa toàn bộ dữ liệu');
    } else {
      await run();
    }
  } catch (err) {
    console.error('❌ Seed thất bại:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main();