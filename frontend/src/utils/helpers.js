export const formatPrice = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n ?? 0);

// Lấy message lỗi chuẩn từ backend { status, message }
export const errMsg = (e) => e.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';

export const ORDER_STATUS = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export const STATUS_LABEL = {
  Pending: 'Chờ xử lý',
  Processing: 'Đang xử lý',
  Shipped: 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
};

export const STATUS_COLOR = {
  Pending: 'bg-amber-100 text-amber-800',
  Processing: 'bg-blue-100 text-blue-800',
  Shipped: 'bg-indigo-100 text-indigo-800',
  Delivered: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-slate-200 text-slate-600',
};

export const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Kiểm tra sách có đang trong thời gian Flash Sale hiệu lực không
export const isBookFlashSaleActive = (book) => {
  if (!book) return false;
  if (typeof book.isFlashSaleActive === 'boolean') return book.isFlashSaleActive;
  if (!book.isFlashSale || !book.flashSaleEndDate) return false;
  const now = new Date();
  const start = book.flashSaleStartDate ? new Date(book.flashSaleStartDate) : null;
  const end = new Date(book.flashSaleEndDate);
  if (start && now < start) return false;
  return now <= end;
};

// Lấy giá cuối cùng của sách (tính cả giá Flash Sale giảm 50%)
export const getBookFinalPrice = (book) => {
  if (!book) return 0;
  if (isBookFlashSaleActive(book)) {
    const discount = book.flashSaleDiscount || 50;
    return Math.round(book.price * (1 - discount / 100));
  }
  return book.discountPrice ?? book.price;
};

// Tính thời gian còn lại đến thời điểm đích (cho countdown timer)
export const getTimeLeft = (targetDate) => {
  if (!targetDate) return { hours: 0, minutes: 0, seconds: 0, total: 0, isEnded: true };
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0, isEnded: true };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { hours, minutes, seconds, total: diff, isEnded: false };
};