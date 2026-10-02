import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, removeFromCart } from '../store/cartSlice';
import { Cover } from '../components/BookCard';
import { formatPrice } from '../utils/helpers';

export default function Cart() {
  const { items, totalPrice } = useSelector((s) => s.cart);
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();

  if (!user) {
    return (
      <div className="p-16 text-center">
        <p className="mb-4 text-slate-600">Vui lòng đăng nhập để xem giỏ hàng.</p>
        <Link to="/login" className="btn">Đăng nhập</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-16 text-center">
        <p className="mb-4 text-slate-600">Giỏ hàng đang trống.</p>
        <Link to="/" className="btn">Tiếp tục mua sắm</Link>
      </div>
    );
  }

  const run = async (action) => {
    const res = await dispatch(action);
    if (res.error) alert(res.payload);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Giỏ hàng</h1>

      <div className="space-y-3">
        {items.map((item) => {
          const book = item.bookId; // đã populate: { _id, title, coverImage, stock }
          if (!book) return null; // sách đã bị admin xóa
          return (
            <div key={book._id} className="card flex items-center gap-4">
              <Cover book={book} className="h-20 w-14 rounded text-xl" />
              <div className="flex-1">
                <Link to={`/books/${book._id}`} className="font-semibold hover:text-indigo-600">{book.title}</Link>
                <p className="text-sm text-slate-500">{formatPrice(item.price)} / cuốn</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">SL: {item.quantity}</span>
                {/* Backend chỉ có API cộng dồn; muốn giảm thì xóa rồi thêm lại */}
                <button className="btn-outline !px-3" disabled={item.quantity >= book.stock}
                  onClick={() => run(addToCart({ bookId: book._id, quantity: 1 }))}>+</button>
              </div>

              <span className="w-28 text-right font-semibold">{formatPrice(item.price * item.quantity)}</span>
              <button className="text-sm text-red-600 hover:underline"
                onClick={() => run(removeFromCart(book._id))}>Xóa</button>
            </div>
          );
        })}
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <span className="text-lg">Tổng cộng:</span>
        <span className="text-2xl font-bold text-rose-600">{formatPrice(totalPrice)}</span>
      </div>
      <div className="mt-4 text-right">
        <Link to="/checkout" className="btn">Tiến hành thanh toán</Link>
      </div>
    </div>
  );
}