import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { Cover, useAddToCart } from '../components/BookCard';
import { errMsg, formatPrice } from '../utils/helpers';

export default function BookDetail() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const { add, added } = useAddToCart();

  useEffect(() => {
    api.get(`/books/${id}`)
      .then(({ data }) => setBook(data.data.book))
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) return <p className="p-10 text-center text-red-600">{error}</p>;
  if (!book) return <p className="p-10 text-center text-slate-500">Đang tải...</p>;

  const finalPrice = book.discountPrice ?? book.price;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">← Quay lại cửa hàng</Link>

      <div className="card mt-4 grid gap-8 md:grid-cols-3">
        <Cover book={book} className="h-80 w-full rounded-lg" />

        <div className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-indigo-500">{book.category}</span>
          <h1 className="mt-1 text-3xl font-bold">{book.title}</h1>
          <p className="mt-1 text-slate-500">Tác giả: {book.author}</p>
          <p className="mt-1 text-sm text-slate-500">
            ⭐ {book.ratingsAverage} ({book.ratingsQuantity} đánh giá)
          </p>

          <div className="mt-4">
            <span className="text-2xl font-bold text-rose-600">{formatPrice(finalPrice)}</span>
            {book.discountPrice != null && (
              <span className="ml-3 text-slate-400 line-through">{formatPrice(book.price)}</span>
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