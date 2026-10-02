import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../store/cartSlice';
import { formatPrice } from '../utils/helpers';

// Ảnh bìa: dùng URL nếu có, ngược lại hiện khung màu với chữ cái đầu
export function Cover({ book, className = '' }) {
  if (book.coverImage?.startsWith('http')) {
    return <img src={book.coverImage} alt={book.title} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500 text-5xl font-bold text-white ${className}`}>
      {book.title[0]}
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
  const finalPrice = book.discountPrice ?? book.price;

  return (
    <div className="card flex flex-col overflow-hidden !p-0">
      <Link to={`/books/${book._id}`}>
        <Cover book={book} className="h-52 w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase text-indigo-500">{book.category}</span>
        <Link to={`/books/${book._id}`} className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600">
          {book.title}
        </Link>
        <span className="text-sm text-slate-500">{book.author}</span>

        <div className="mt-auto pt-3">
          <span className="font-bold text-rose-600">{formatPrice(finalPrice)}</span>
          {book.discountPrice != null && (
            <span className="ml-2 text-sm text-slate-400 line-through">{formatPrice(book.price)}</span>
          )}
        </div>

        <button className="btn mt-2" disabled={book.stock === 0} onClick={() => add(book._id)}>
          {book.stock === 0 ? 'Hết hàng' : added ? 'Đã thêm ✓' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}