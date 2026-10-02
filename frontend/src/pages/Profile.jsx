import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import { updateProfile } from '../store/authSlice';
import { errMsg, formatPrice, STATUS_COLOR, STATUS_LABEL } from '../utils/helpers';

export default function Profile() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const [name, setName] = useState(user.name);
  const [msg, setMsg] = useState('');
  const [orders, setOrders] = useState([]);

  const loadOrders = () =>
    api.get('/orders/my').then(({ data }) => setOrders(data.data.orders)).catch((e) => setMsg(errMsg(e)));

  useEffect(() => { loadOrders(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const res = await dispatch(updateProfile({ name }));
    setMsg(res.error ? res.payload : 'Đã cập nhật thông tin');
  };

  const cancel = async (id) => {
    if (!confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) return;
    try {
      await api.patch(`/orders/${id}/cancel`);
      loadOrders();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <form onSubmit={save} className="card space-y-3">
        <h1 className="text-xl font-bold">Thông tin cá nhân</h1>
        <p className="text-sm text-slate-500">Email: {user.email}</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="flex items-center gap-3">
          <button className="btn">Lưu thay đổi</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-xl font-bold">Đơn hàng của tôi</h2>
        {orders.length === 0 && <p className="text-slate-500">Bạn chưa có đơn hàng nào.</p>}
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o._id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-500">
                  #{o._id.slice(-6).toUpperCase()} · {new Date(o.createdAt).toLocaleString('vi-VN')}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[o.orderStatus]}`}>
                  {STATUS_LABEL[o.orderStatus]}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.orderItems.map((i) => (
                  <li key={i._id} className="flex justify-between">
                    <span>{i.title} × {i.quantity}</span>
                    <span>{formatPrice(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-bold text-rose-600">{formatPrice(o.totalAmount)}</span>
                {o.orderStatus === 'Pending' && (
                  <button className="text-sm text-red-600 hover:underline" onClick={() => cancel(o._id)}>Hủy đơn</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}