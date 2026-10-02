import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import { clearCart } from '../store/cartSlice';
import { errMsg, formatPrice } from '../utils/helpers';

export default function Checkout() {
  const { items, totalPrice } = useSelector((s) => s.cart);
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Điền sẵn từ địa chỉ mặc định của user (nếu có)
  const def = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
  const [address, setAddress] = useState({
    fullName: def?.fullName || user.name,
    phone: def?.phone || '',
    street: def?.street || '',
    city: def?.city || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) return <Navigate to="/cart" replace />;

  const set = (k) => (e) => setAddress({ ...address, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/orders', { shippingAddress: address, paymentMethod });
      dispatch(clearCart()); // backend đã làm trống giỏ
      navigate('/profile');
    } catch (err) {
      setError(errMsg(err)); // VD: "Một số sách đã hết hàng..."
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-3">
      <form onSubmit={submit} className="card space-y-4 md:col-span-2">
        <h1 className="text-xl font-bold">Thông tin giao hàng</h1>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <input className="input" placeholder="Họ và tên" required value={address.fullName} onChange={set('fullName')} />
        <input className="input" placeholder="Số điện thoại" required value={address.phone} onChange={set('phone')} />
        <input className="input" placeholder="Địa chỉ (số nhà, đường)" required value={address.street} onChange={set('street')} />
        <input className="input" placeholder="Tỉnh / Thành phố" required value={address.city} onChange={set('city')} />

        <div>
          <label className="mb-1 block text-sm font-medium">Phương thức thanh toán</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="COD">Thanh toán khi nhận hàng (COD)</option>
            <option value="Banking">Chuyển khoản ngân hàng</option>
            <option value="Momo">Ví Momo</option>
          </select>
        </div>

        <button className="btn w-full" disabled={submitting}>
          {submitting ? 'Đang đặt hàng...' : 'Đặt hàng'}
        </button>
      </form>

      <aside className="card h-fit">
        <h2 className="mb-3 font-bold">Đơn hàng</h2>
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.bookId?._id} className="flex justify-between gap-2">
              <span className="line-clamp-1">{i.bookId?.title} × {i.quantity}</span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t pt-3 font-bold">
          <span>Tổng</span>
          <span className="text-rose-600">{formatPrice(totalPrice)}</span>
        </div>
      </aside>
    </div>
  );
}