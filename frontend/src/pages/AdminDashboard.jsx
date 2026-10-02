import { useEffect, useState } from 'react';
import api from '../services/api';
import { errMsg, formatPrice, ORDER_STATUS, STATUS_COLOR, STATUS_LABEL } from '../utils/helpers';

const EMPTY = { title: '', author: '', category: '', price: '', discountPrice: '', stock: '', description: '' };

function BooksTab() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = () => api.get('/books', { params: { limit: 50 } }).then(({ data }) => setBooks(data.data.books));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
    // discountPrice rỗng thì không gửi (tránh lỗi ép kiểu ở backend)
    if (form.discountPrice) payload.discountPrice = Number(form.discountPrice);
    else delete payload.discountPrice;

    try {
      await api.post('/books', payload);
      setForm(EMPTY);
      setError('');
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const remove = async (id) => {
    if (!confirm('Xóa cuốn sách này?')) return;
    try {
      await api.delete(`/books/${id}`);
      load();
    } catch (err) {
      alert(errMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid gap-3 md:grid-cols-3">
        <h2 className="font-bold md:col-span-3">Thêm sách mới</h2>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-3">{error}</p>}
        <input className="input" placeholder="Tên sách" required value={form.title} onChange={set('title')} />
        <input className="input" placeholder="Tác giả" required value={form.author} onChange={set('author')} />
        <input className="input" placeholder="Danh mục" required value={form.category} onChange={set('category')} />
        <input className="input" type="number" min="0" placeholder="Giá gốc" required value={form.price} onChange={set('price')} />
        <input className="input" type="number" min="0" placeholder="Giá khuyến mãi (tùy chọn)" value={form.discountPrice} onChange={set('discountPrice')} />
        <input className="input" type="number" min="0" placeholder="Tồn kho" required value={form.stock} onChange={set('stock')} />
        <textarea className="input md:col-span-3" rows="2" placeholder="Mô tả" value={form.description} onChange={set('description')} />
        <button className="btn md:col-span-3">Thêm sách</button>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th className="p-3">Tên sách</th><th>Danh mục</th><th>Giá</th><th>Kho</th><th></th></tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b._id} className="border-t">
                <td className="p-3 font-medium">{b.title}</td>
                <td>{b.category}</td>
                <td>{formatPrice(b.discountPrice ?? b.price)}</td>
                <td className={b.stock < 10 ? 'font-semibold text-red-600' : ''}>{b.stock}</td>
                <td className="pr-3 text-right">
                  <button className="text-red-600 hover:underline" onClick={() => remove(b._id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const load = () => api.get('/orders').then(({ data }) => setOrders(data.data.orders));
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      load();
    } catch (err) {
      alert(errMsg(err));
    }
  };

  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr><th className="p-3">Mã</th><th>Khách hàng</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const finished = ['Delivered', 'Cancelled'].includes(o.orderStatus); // backend không cho đổi nữa
            return (
              <tr key={o._id} className="border-t">
                <td className="p-3">#{o._id.slice(-6).toUpperCase()}</td>
                <td>{o.userId?.name}<br /><span className="text-xs text-slate-500">{o.userId?.email}</span></td>
                <td>{formatPrice(o.totalAmount)}</td>
                <td>{o.isPaid ? '✅ Đã thanh toán' : o.paymentMethod}</td>
                <td>
                  {finished ? (
                    <span className={`rounded-full px-3 py-1 text-xs ${STATUS_COLOR[o.orderStatus]}`}>{STATUS_LABEL[o.orderStatus]}</span>
                  ) : (
                    <select className="input !w-auto" value={o.orderStatus}
                      onChange={(e) => changeStatus(o._id, e.target.value)}>
                      {ORDER_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('books');
  const tabClass = (t) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">Quản trị</h1>
      <div className="mb-6 flex gap-2">
        <button className={tabClass('books')} onClick={() => setTab('books')}>Sách</button>
        <button className={tabClass('orders')} onClick={() => setTab('orders')}>Đơn hàng</button>
      </div>
      {tab === 'books' ? <BooksTab /> : <OrdersTab />}
    </div>
  );
}