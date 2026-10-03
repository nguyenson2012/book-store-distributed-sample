import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../store/cartSlice';
import { formatPrice, isBookFlashSaleActive, getBookFinalPrice } from '../utils/helpers';

// Ảnh bìa: dùng URL nếu có, fallback sang khung màu nếu ảnh lỗi hoặc không có URL
export function Cover({ book, className = '' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [book?.coverImage]);

  const hasValidImage = Boolean(
    book?.coverImage &&
    book.coverImage !== 'default-cover.jpg' &&
    (book.coverImage.startsWith('http://') ||
     book.coverImage.startsWith('https://') ||
     book.coverImage.startsWith('/') ||
     book.coverImage.startsWith('data:image/'))
  );

  if (hasValidImage && !hasError) {
    return (
      <img
        src={book.coverImage}
        alt={book.title || 'Bìa sách'}
        onError={() => setHasError(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500 text-3xl font-bold text-white select-none ${className}`}>
      {book?.title?.[0] || '📖'}
    </div>
  );
}

// Hook thêm vào giỏ: chưa đăng nhập thì chuyển sang trang login
export function useAddToCart() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const [added, setAdded] = useState(false);

  const add = async (bookId, quantity = 1) => {
    if (!user) return navigate('/login');
    const res = await dispatch(addToCart({ bookId, quantity }));
    if (addToCart.rejected.match(res)) return alert(res.payload);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };
  return { add, added };
}

export default function BookCard({ book }) {
  const { add, added } = useAddToCart();
  const isFlash = isBookFlashSaleActive(book);
  const finalPrice = getBookFinalPrice(book);

  return (
    <div className={`card relative flex flex-col overflow-hidden !p-0 transition hover:shadow-md ${isFlash ? 'ring-2 ring-rose-500/80 shadow-rose-100' : ''}`}>
      {/* Badge Flash Sale */}
      {isFlash && (
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-rose-600 px-2.5 py-1 text-xs font-black uppercase text-white shadow-md">
          <span>⚡</span>
          <span>-50% SALE</span>
        </div>
      )}

      <Link to={`/books/${book._id}`}>
        <Cover book={book} className="h-52 w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase text-indigo-500">{book.category}</span>
          {isFlash && (
            <span className="text-[11px] font-bold text-rose-600 animate-pulse">⚡ Flash Sale</span>
          )}
        </div>

        <Link to={`/books/${book._id}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600">
          {book.title}
        </Link>
        <span className="text-sm text-slate-500">{book.author}</span>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-rose-600">{formatPrice(finalPrice)}</span>
            {(isFlash || book.discountPrice != null) && (
              <span className="text-xs text-slate-400 line-through">{formatPrice(book.price)}</span>
            )}
          </div>
          {isFlash && (
            <div className="mt-1 text-[11px] font-medium text-amber-600 flex items-center gap-1">
              <span>🔥</span> Tiết kiệm 50% giá gốc
            </div>
          )}
        </div>

        <button className="btn mt-2" disabled={book.stock === 0} onClick={() => add(book._id)}>
          {book.stock === 0 ? 'Hết hàng' : added ? 'Đã thêm ✓' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}