import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import BookCard from '../components/BookCard';
import { errMsg } from '../utils/helpers';

// Backend chưa có endpoint danh mục nên khai báo tạm theo dữ liệu seed
const CATEGORIES = ['Văn học', 'Thiếu nhi', 'Kỹ năng sống', 'Kinh tế', 'Khoa học', 'Công nghệ', 'Trinh thám'];
const SORTS = [
  ['-createdAt', 'Mới nhất'],
  ['price', 'Giá tăng dần'],
  ['-price', 'Giá giảm dần'],
  ['title', 'Tên A → Z'],
];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    search: params.get('search') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
  });

  // Mỗi lần query string đổi => gọi lại API
  const query = params.toString();
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .get('/books', { params: Object.fromEntries(params) })
      .then(({ data }) => {
        if (ignore) return;
        setBooks(data.data.books);
        setPagination(data.pagination);
        setError('');
      })
      .catch((e) => !ignore && setError(errMsg(e)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Cập nhật 1 số tham số; đổi bộ lọc thì về trang 1
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const applyFilters = (e) => {
    e.preventDefault();
    update(form);
  };

  const reset = () => {
    setForm({ search: '', minPrice: '', maxPrice: '' });
    setParams({});
  };

  const page = pagination?.page || 1;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-4">
      {/* Bộ lọc */}
      <aside className="md:col-span-1">
        <form onSubmit={applyFilters} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Tìm kiếm</label>
            <input className="input" placeholder="Tên sách hoặc tác giả"
              value={form.search} onChange={(e) => setForm({ ...form, search: e.target.value })} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Danh mục</label>
            <select className="input" value={params.get('category') || ''}
              onChange={(e) => update({ category: e.target.value })}>
              <option value="">Tất cả</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Khoảng giá (₫)</label>
            <div className="flex gap-2">
              <input type="number" min="0" className="input" placeholder="Từ"
                value={form.minPrice} onChange={(e) => setForm({ ...form, minPrice: e.target.value })} />
              <input type="number" min="0" className="input" placeholder="Đến"
                value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sắp xếp</label>
            <select className="input" value={params.get('sort') || '-createdAt'}
              onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button className="btn flex-1">Áp dụng</button>
            <button type="button" className="btn-outline" onClick={reset}>Xóa</button>
          </div>
        </form>
      </aside>

      {/* Danh sách */}
      <section className="md:col-span-3">
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <p className="py-20 text-center text-slate-500">Đang tải sách...</p>
        ) : books.length === 0 ? (
          <p className="py-20 text-center text-slate-500">Không tìm thấy sách phù hợp.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">{pagination?.total} kết quả</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {books.map((b) => <BookCard key={b._id} book={b} />)}
            </div>

            {pagination?.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button className="btn-outline" disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}>← Trước</button>
                <span className="text-sm">Trang {page} / {pagination.totalPages}</span>
                <button className="btn-outline" disabled={page >= pagination.totalPages}
                  onClick={() => update({ page: String(page + 1) })}>Sau →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}