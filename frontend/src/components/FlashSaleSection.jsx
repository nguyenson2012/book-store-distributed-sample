import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Cover, useAddToCart } from './BookCard';
import { formatPrice, getTimeLeft, isBookFlashSaleActive, getBookFinalPrice } from '../utils/helpers';

export default function FlashSaleSection() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, isEnded: true });
  const { add, added } = useAddToCart();

  useEffect(() => {
    let ignore = false;
    api
      .get('/books/flash-sale')
      .then(({ data }) => {
        if (ignore) return;
        const validBooks = (data.data.books || []).filter(isBookFlashSaleActive);
        setBooks(validBooks);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Tính countdown dựa trên cuốn sách có thời hạn kết thúc gần nhất
  useEffect(() => {
    if (books.length === 0) return;

    // Tìm hạn kết thúc sớm nhất
    const earliestEnd = books.reduce((earliest, b) => {
      if (!b.flashSaleEndDate) return earliest;
      const bEnd = new Date(b.flashSaleEndDate).getTime();
      return earliest ? Math.min(earliest, bEnd) : bEnd;
    }, null);

    if (!earliestEnd) return;

    const updateTimer = () => {
      const remaining = getTimeLeft(earliestEnd);
      setTimeLeft(remaining);

      // Nếu hết giờ, lọc lại danh sách sách
      if (remaining.isEnded) {
        setBooks((prev) => prev.filter(isBookFlashSaleActive));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [books]);

  if (loading || books.length === 0 || timeLeft.isEnded) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 p-6 text-white shadow-xl shadow-rose-950/10">
      {/* Header Flash Sale */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-3xl shadow-inner animate-pulse">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black uppercase tracking-wider text-yellow-300 drop-shadow-xs">
                GIỜ VÀNG FLASH SALE
              </h2>
              <span className="rounded-full bg-yellow-400 px-2.5 py-0.5 text-xs font-black text-slate-900 uppercase">
                GIẢM 50%
              </span>
            </div>
            <p className="text-xs text-rose-100 sm:text-sm">
              Săn ngay các tựa sách hay với mức giảm giá sốc nửa giá!
            </p>
          </div>
        </div>

        {/* Đồng hồ đếm ngược */}
        <div className="flex items-center gap-2 rounded-xl bg-black/30 px-4 py-2 backdrop-blur-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-200">
            Kết thúc sau:
          </span>
          <div className="flex items-center gap-1 font-mono text-base font-black">
            <span className="rounded-md bg-white px-2 py-0.5 text-slate-900 shadow-xs">
              {pad(timeLeft.hours)}
            </span>
            <span className="text-yellow-300">:</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-slate-900 shadow-xs">
              {pad(timeLeft.minutes)}
            </span>
            <span className="text-yellow-300">:</span>
            <span className="rounded-md bg-yellow-400 px-2 py-0.5 text-slate-900 shadow-xs">
              {pad(timeLeft.seconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Danh sách sách Flash Sale */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((book) => {
          const finalPrice = getBookFinalPrice(book);
          return (
            <div
              key={book._id}
              className="group flex flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Ảnh bìa + Nhãn 50% */}
              <div className="relative overflow-hidden">
                <Link to={`/books/${book._id}`}>
                  <Cover
                    book={book}
                    className="h-48 w-full transition duration-300 group-hover:scale-105"
                  />
                </Link>
                <div className="absolute left-2 top-2 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-black uppercase text-white shadow-md">
                  ⚡ -50%
                </div>
              </div>

              {/* Thông tin */}
              <div className="flex flex-1 flex-col p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  {book.category}
                </span>
                <Link
                  to={`/books/${book._id}`}
                  className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900 hover:text-rose-600"
                >
                  {book.title}
                </Link>
                <span className="text-xs text-slate-500">{book.author}</span>

                {/* Giá */}
                <div className="mt-auto pt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-black text-rose-600">
                      {formatPrice(finalPrice)}
                    </span>
                    <span className="text-xs text-slate-400 line-through">
                      {formatPrice(book.price)}
                    </span>
                  </div>

                  {/* Thanh số lượng / Trạng thái bán */}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                      <span>Đang bán chạy 🔥</span>
                      <span className="text-rose-600 font-bold">Còn {book.stock} cuốn</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-600"
                        style={{
                          width: `${Math.min(100, Math.max(25, (book.stock / (book.stock + 10)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  className="btn mt-3 !bg-rose-600 hover:!bg-rose-700 !py-1.5 !text-xs font-bold shadow-xs"
                  disabled={book.stock === 0}
                  onClick={() => add(book._id)}
                >
                  {book.stock === 0 ? 'Tạm hết hàng' : added ? 'Đã thêm ✓' : '⚡ Mua ngay -50%'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
