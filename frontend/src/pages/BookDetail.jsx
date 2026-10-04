import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi } from '../services/api';
import { Cover, useAddToCart } from '../components/BookCard';
import { errMsg, formatPrice, isBookFlashSaleActive, getBookFinalPrice, getTimeLeft } from '../utils/helpers';

export default function BookDetail() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, isEnded: true });
  const { add, added } = useAddToCart();

  useEffect(() => {
    catalogApi.get(`/books/${id}`)
      .then(({ data }) => setBook(data.data.book))
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  useEffect(() => {
    if (!book || !isBookFlashSaleActive(book)) return;
    const updateCountdown = () => {
      setTimeLeft(getTimeLeft(book.flashSaleEndDate));
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [book]);

  if (error) return <p className="p-10 text-center text-red-600">{error}</p>;
  if (!book) return <p className="p-10 text-center text-slate-500">Đang tải...</p>;

  const isFlash = isBookFlashSaleActive(book);
  const finalPrice = getBookFinalPrice(book);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">← Quay lại cửa hàng</Link>

      {/* Banner Flash Sale nổi bật nếu sách đang Flash Sale */}
      {isFlash && !timeLeft.isEnded && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">⚡</span>
            <div>
              <div className="text-lg font-black uppercase tracking-wide">GIỜ VÀNG FLASH SALE - GIẢM 50%</div>
              <p className="text-xs text-rose-100">Giá khuyến mãi đặc biệt có giới hạn thời gian</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase text-rose-100">Kết thúc sau:</span>
            <div className="flex gap-1 text-sm font-bold">
              <span className="rounded bg-black/40 px-2 py-1">{pad(timeLeft.hours)}</span>
              <span>:</span>
              <span className="rounded bg-black/40 px-2 py-1">{pad(timeLeft.minutes)}</span>
              <span>:</span>
              <span className="rounded bg-black/40 px-2 py-1">{pad(timeLeft.seconds)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card mt-4 grid gap-8 md:grid-cols-3">
        <div className="relative">
          <Cover book={book} className="h-80 w-full rounded-lg" />
          {isFlash && (
            <div className="absolute top-3 left-3 rounded-md bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-md">
              ⚡ -50% SALE
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-indigo-500">{book.category}</span>
          <h1 className="mt-1 text-3xl font-bold">{book.title}</h1>
          <p className="mt-1 text-slate-500">Tác giả: {book.author}</p>
          <p className="mt-1 text-sm text-slate-500">
            ⭐ {book.ratingsAverage} ({book.ratingsQuantity} đánh giá)
          </p>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-rose-600">{formatPrice(finalPrice)}</span>
            {(isFlash || book.discountPrice != null) && (
              <span className="text-lg text-slate-400 line-through">{formatPrice(book.price)}</span>
            )}
            {isFlash && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                ⚡ Giảm 50%
              </span>
            )}
          </div>

          <p className="mt-4 leading-relaxed text-slate-700">{book.description}</p>
          <p className="mt-3 text-sm text-slate-500">
            {book.stock > 0 ? `Còn ${book.stock} cuốn trong kho` : 'Tạm hết hàng'}
          </p>

          {book.stock > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <input type="number" min="1" max={book.stock} value={qty} className="input !w-24"
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
              <button className="btn" onClick={() => add(book._id, qty)}>
                {added ? 'Đã thêm ✓' : 'Thêm vào giỏ'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}