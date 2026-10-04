import { useEffect, useState } from 'react';
import api, { catalogWriteApi } from '../services/api';
import { Cover } from '../components/BookCard';
import {
  errMsg,
  formatPrice,
  ORDER_STATUS,
  STATUS_COLOR,
  STATUS_LABEL,
  isBookFlashSaleActive,
  getBookFinalPrice,
  getTimeLeft,
} from '../utils/helpers';

const CATEGORIES = [
  'Văn học',
  'Thiếu nhi',
  'Kỹ năng sống',
  'Kinh tế',
  'Khoa học',
  'Công nghệ',
  'Trinh thám',
  'Lịch sử',
  'Tâm lý',
  'Ngoại ngữ',
];

const EMPTY_BOOK = {
  title: '',
  author: '',
  category: '',
  price: '',
  discountPrice: '',
  stock: '',
  description: '',
  coverImage: '',
};

/**
 * Component nhập URL ảnh bìa: hỗ trợ dán nhanh từ clipboard và xem trước ảnh ngay lập tức
 */
function CoverImageField({ value, onChange, label = 'Ảnh bìa sách' }) {
  const [imgStatus, setImgStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [pasteNotice, setPasteNotice] = useState('');

  const trimmed = (value || '').trim();

  useEffect(() => {
    if (!trimmed || trimmed === 'default-cover.jpg') {
      setImgStatus('idle');
      return;
    }
    setImgStatus('loading');
  }, [trimmed]);

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setPasteNotice('Vui lòng nhấn Ctrl+V / Cmd+V vào ô bên dưới');
        setTimeout(() => setPasteNotice(''), 3500);
        return;
      }
      const text = await navigator.clipboard.readText();
      const clean = text?.trim();
      if (clean) {
        onChange(clean);
        setPasteNotice('Đã dán link từ clipboard! ✓');
      } else {
        setPasteNotice('Bộ nhớ tạm (clipboard) đang trống');
      }
      setTimeout(() => setPasteNotice(''), 3000);
    } catch {
      setPasteNotice('Trình duyệt chưa cấp quyền clipboard, vui lòng nhấn Ctrl+V / Cmd+V');
      setTimeout(() => setPasteNotice(''), 3500);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-xs text-slate-500">Hỗ trợ dán URL ảnh trực tiếp</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="input pr-8"
            placeholder="Dán URL ảnh bìa (VD: https://...)"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Xóa link ảnh"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          className="btn-outline shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
          title="Dán nhanh link ảnh từ bộ nhớ tạm"
        >
          📋 Dán link
        </button>
      </div>

      {pasteNotice && (
        <p className="text-xs font-medium text-indigo-600 animate-pulse">{pasteNotice}</p>
      )}

      {/* Khung xem trước ảnh bìa */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs flex items-center justify-center">
            {trimmed && trimmed !== 'default-cover.jpg' ? (
              <img
                src={trimmed}
                alt="Xem trước bìa"
                className="h-full w-full object-cover"
                onLoad={() => setImgStatus('success')}
                onError={() => setImgStatus('error')}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-1 text-center text-slate-400">
                <span className="text-xl">📖</span>
                <span className="text-[10px] mt-0.5">Mặc định</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1 text-xs">
            <p className="font-semibold text-slate-700">Xem trước ảnh bìa</p>
            {imgStatus === 'success' && (
              <p className="font-medium text-emerald-600 flex items-center gap-1">
                <span>✓</span> Link ảnh hợp lệ và tải thành công
              </p>
            )}
            {imgStatus === 'error' && (
              <p className="font-medium text-rose-600 flex items-center gap-1">
                <span>⚠️</span> Không thể tải ảnh từ link này. Vui lòng kiểm tra lại URL.
              </p>
            )}
            {imgStatus === 'loading' && (
              <p className="font-medium text-indigo-600 animate-pulse">
                Đang kiểm tra ảnh từ URL...
              </p>
            )}
            {imgStatus === 'idle' && (
              <p className="text-slate-500">
                Để trống thì hệ thống sẽ hiển thị ảnh bìa mặc định với chữ cái đầu của sách.
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Mẹo: Chuột phải vào ảnh bất kỳ trên mạng &gt; chọn <i>&quot;Sao chép địa chỉ hình ảnh&quot;</i> &gt; bấm <b>Dán link</b>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal cập nhật thông tin sách & cài đặt Flash Sale
 */
function EditBookModal({ book, onClose, onSave }) {
  const [form, setForm] = useState({
    title: book.title || '',
    author: book.author || '',
    category: book.category || '',
    price: book.price ?? '',
    discountPrice: book.discountPrice ?? '',
    stock: book.stock ?? '',
    coverImage: book.coverImage || '',
    description: book.description || '',
  });

  // State Flash Sale
  const currentlyActiveFlashSale = isBookFlashSaleActive(book);
  const [isFlashSale, setIsFlashSale] = useState(currentlyActiveFlashSale);
  const [flashSaleEndDate, setFlashSaleEndDate] = useState(() => {
    if (book.flashSaleEndDate) {
      const d = new Date(book.flashSaleEndDate);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    const defaultEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(defaultEnd.getTime() - defaultEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));
  const setInput = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const setDurationPreset = (hours) => {
    const end = new Date(Date.now() + hours * 60 * 60 * 1000);
    setFlashSaleEndDate(new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (isNaN(priceNum) || priceNum < 0) {
      return setError('Giá gốc phải là số dương hợp lệ');
    }
    if (isNaN(stockNum) || stockNum < 0) {
      return setError('Số lượng tồn kho không được âm');
    }

    if (isFlashSale && !flashSaleEndDate) {
      return setError('Vui lòng chọn thời điểm kết thúc Flash Sale');
    }

    if (isFlashSale && new Date(flashSaleEndDate).getTime() <= Date.now()) {
      return setError('Thời điểm kết thúc Flash Sale phải ở trong tương lai');
    }

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category.trim(),
      price: priceNum,
      stock: stockNum,
      coverImage: form.coverImage?.trim() || 'default-cover.jpg',
      description: form.description?.trim() || '',
      isFlashSale,
    };

    if (isFlashSale) {
      payload.flashSaleDiscount = 50;
      payload.flashSaleStartDate = book.flashSaleStartDate || new Date().toISOString();
      payload.flashSaleEndDate = new Date(flashSaleEndDate).toISOString();
    } else {
      payload.flashSaleEndDate = null;
    }

    if (form.discountPrice !== '' && form.discountPrice != null) {
      const discountNum = Number(form.discountPrice);
      if (isNaN(discountNum) || discountNum < 0) {
        return setError('Giá khuyến mãi phải là số dương');
      }
      if (discountNum >= priceNum) {
        return setError('Giá khuyến mãi phải nhỏ hơn giá gốc');
      }
      payload.discountPrice = discountNum;
    } else {
      payload.discountPrice = null; // backend sẽ gỡ bỏ khuyến mãi thường
    }

    setSaving(true);
    try {
      const { data } = await catalogWriteApi.patch(`/books/${book._id}`, payload);
      onSave(data.data.book);
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cập nhật thông tin sách</h3>
            <p className="text-xs text-slate-500">Chỉnh sửa thông tin, giá bán và dán link ảnh bìa sách mới</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Tên sách *</label>
              <input
                className="input"
                required
                value={form.title}
                onChange={setInput('title')}
                placeholder="VD: Dế Mèn Phiêu Lưu Ký"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tác giả *</label>
              <input
                className="input"
                required
                value={form.author}
                onChange={setInput('author')}
                placeholder="VD: Tô Hoài"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Danh mục *</label>
              <input
                className="input"
                list="category-options"
                required
                value={form.category}
                onChange={setInput('category')}
                placeholder="VD: Văn học, Kinh tế..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Giá gốc (₫) *</label>
              <input
                className="input"
                type="number"
                min="0"
                required
                value={form.price}
                onChange={setInput('price')}
                placeholder="VD: 85000"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giá khuyến mãi (₫) <span className="text-xs font-normal text-slate-500">(tùy chọn)</span>
              </label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.discountPrice}
                onChange={setInput('discountPrice')}
                placeholder="Để trống nếu không giảm giá"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tồn kho *</label>
              <input
                className="input"
                type="number"
                min="0"
                required
                value={form.stock}
                onChange={setInput('stock')}
                placeholder="VD: 100"
              />
            </div>
          </div>

          {/* Cấu hình Flash Sale (Giảm giá 50%) */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-800 text-sm select-none">
                <input
                  type="checkbox"
                  className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                  checked={isFlashSale}
                  onChange={(e) => setIsFlashSale(e.target.checked)}
                />
                <span>⚡ Bật Flash Sale cho sách này (Giảm 50%)</span>
              </label>
              {isFlashSale && (
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-black text-white uppercase tracking-wide animate-pulse">
                  -50% GIÁ GỐC
                </span>
              )}
            </div>

            {isFlashSale && (
              <div className="space-y-3 pt-2 border-t border-rose-200">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 border border-rose-200 text-xs">
                  <span className="text-slate-600">
                    Giá gốc: <b className="text-slate-900">{formatPrice(Number(form.price) || 0)}</b>
                  </span>
                  <span className="font-bold text-sm text-rose-600">
                    Giá Flash Sale (-50%): {formatPrice(Math.round((Number(form.price) || 0) * 0.5))}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Chọn nhanh thời lượng diễn ra Flash Sale:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '1 giờ', h: 1 },
                      { label: '6 giờ', h: 6 },
                      { label: '12 giờ', h: 12 },
                      { label: '24 giờ (1 ngày)', h: 24 },
                      { label: '3 ngày', h: 72 },
                      { label: '7 ngày', h: 168 },
                    ].map(({ label, h }) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setDurationPreset(h)}
                        className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition"
                      >
                        +{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thời điểm kết thúc Flash Sale *
                  </label>
                  <input
                    type="datetime-local"
                    required={isFlashSale}
                    className="input bg-white"
                    value={flashSaleEndDate}
                    onChange={(e) => setFlashSaleEndDate(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 Khi đến thời điểm này, hệ thống sẽ tự động gỡ trạng thái Flash Sale và chuyển giá về mức ban đầu.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <CoverImageField
              value={form.coverImage}
              onChange={setField('coverImage')}
              label="Ảnh bìa sách"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả sách</label>
            <textarea
              className="input"
              rows="3"
              value={form.description}
              onChange={setInput('description')}
              placeholder="Nhập tóm tắt hoặc nội dung cuốn sách..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              className="btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn flex items-center gap-2"
              disabled={saving}
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BooksTab() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(EMPTY_BOOK);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'flash'
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    catalogWriteApi.get('/books', { params: { limit: 50 } }).then(({ data }) => setBooks(data.data.books));

  useEffect(() => {
    load();
  }, []);

  const setField = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));
  const setInput = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (isNaN(priceNum) || priceNum < 0) {
      return setError('Giá gốc phải là số dương');
    }
    if (isNaN(stockNum) || stockNum < 0) {
      return setError('Số lượng tồn kho không được âm');
    }

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category.trim(),
      price: priceNum,
      stock: stockNum,
      coverImage: form.coverImage?.trim() || 'default-cover.jpg',
      description: form.description?.trim() || '',
    };

    if (form.discountPrice) {
      const discountNum = Number(form.discountPrice);
      if (discountNum >= priceNum) {
        return setError('Giá khuyến mãi phải nhỏ hơn giá gốc');
      }
      payload.discountPrice = discountNum;
    }

    setSubmitting(true);
    try {
      await catalogWriteApi.post('/books', payload);
      setForm(EMPTY_BOOK);
      setError('');
      setShowAddForm(false);
      setSuccessNotice(`Đã thêm thành công sách "${payload.title}"!`);
      setTimeout(() => setSuccessNotice(''), 4000);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id, title) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa cuốn sách "${title}"?`)) return;
    try {
      await catalogWriteApi.delete(`/books/${id}`);
      setSuccessNotice(`Đã xóa sách "${title}" thành công!`);
      setTimeout(() => setSuccessNotice(''), 4000);
      load();
    } catch (err) {
      alert(errMsg(err));
    }
  };

  const quickToggleFlashSale = async (b) => {
    const isCurrent = isBookFlashSaleActive(b);
    try {
      const { data } = await catalogWriteApi.patch(`/books/${b._id}/flash-sale`, {
        isFlashSale: !isCurrent,
        durationHours: 24, // Mặc định bật 24h
        discountPercent: 50,
      });
      handleUpdateSuccess(data.data.book);
      setSuccessNotice(
        !isCurrent
          ? `Đã bật Flash Sale (-50%) 24 giờ cho sách "${b.title}"!`
          : `Đã tắt Flash Sale cho sách "${b.title}"!`
      );
    } catch (err) {
      alert(errMsg(err));
    }
  };

  const handleUpdateSuccess = (updatedBook) => {
    setBooks((prev) => prev.map((b) => (b._id === updatedBook._id ? updatedBook : b)));
    setSuccessNotice(`Đã cập nhật thông tin sách "${updatedBook.title}" thành công!`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  const flashSaleCount = books.filter(isBookFlashSaleActive).length;

  const filteredBooks = books.filter((b) => {
    if (filterTab === 'flash' && !isBookFlashSaleActive(b)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Category Datalist để gợi ý nhanh */}
      <datalist id="category-options">
        {CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Thông báo thành công */}
      {successNotice && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice('')}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Thanh công cụ: Nút Thêm sách & Ô tìm kiếm & Bộ lọc Flash Sale */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn flex items-center gap-2 shadow-xs"
          >
            <span>{showAddForm ? '✕ Đóng form thêm sách' : '＋ Thêm sách mới'}</span>
          </button>

          {/* Tab lọc nhanh */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterTab('all')}
              className={`rounded-md px-3 py-1.5 transition ${
                filterTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({books.length})
            </button>
            <button
              onClick={() => setFilterTab('flash')}
              className={`rounded-md px-3 py-1.5 transition flex items-center gap-1 ${
                filterTab === 'flash'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <span>⚡ Đang Flash Sale</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${filterTab === 'flash' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'}`}>
                {flashSaleCount}
              </span>
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            className="input pr-8"
            placeholder="Tìm theo tên, tác giả, danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Form thêm sách mới */}
      {showAddForm && (
        <form onSubmit={submit} className="card border-indigo-100 shadow-md space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-lg font-bold text-slate-900">Thêm sách mới</h2>
            <p className="text-xs text-slate-500">Điền thông tin và dán link ảnh bìa cho cuốn sách</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="input"
              placeholder="Tên sách *"
              required
              value={form.title}
              onChange={setInput('title')}
            />
            <input
              className="input"
              placeholder="Tác giả *"
              required
              value={form.author}
              onChange={setInput('author')}
            />
            <input
              className="input"
              list="category-options"
              placeholder="Danh mục *"
              required
              value={form.category}
              onChange={setInput('category')}
            />
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Giá gốc (₫) *"
              required
              value={form.price}
              onChange={setInput('price')}
            />
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Giá khuyến mãi (₫) (tùy chọn)"
              value={form.discountPrice}
              onChange={setInput('discountPrice')}
            />
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Tồn kho *"
              required
              value={form.stock}
              onChange={setInput('stock')}
            />
          </div>

          <div className="pt-2">
            <CoverImageField
              value={form.coverImage}
              onChange={setField('coverImage')}
              label="Ảnh bìa sách"
            />
          </div>

          <textarea
            className="input"
            rows="2"
            placeholder="Mô tả sách (tùy chọn)..."
            value={form.description}
            onChange={setInput('description')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setShowAddForm(false);
                setForm(EMPTY_BOOK);
                setError('');
              }}
            >
              Hủy
            </button>
            <button className="btn" disabled={submitting}>
              {submitting ? 'Đang thêm...' : 'Lưu và thêm sách'}
            </button>
          </div>
        </form>
      )}

      {/* Bảng danh sách sách */}
      <div className="card overflow-x-auto !p-0 shadow-sm">
        <div className="p-4 border-b bg-slate-50/70 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Danh sách sách ({filteredBooks.length} / {books.length} cuốn)
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
            <tr>
              <th className="p-3 w-16 text-center">Bìa</th>
              <th className="p-3">Tên sách & Tác giả</th>
              <th className="p-3">Danh mục</th>
              <th className="p-3">Giá bán</th>
              <th className="p-3">Kho</th>
              <th className="p-3 text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-500">
                  {search
                    ? 'Không tìm thấy sách phù hợp với từ khóa'
                    : filterTab === 'flash'
                    ? 'Hiện không có cuốn sách nào đang trong chương trình Flash Sale'
                    : 'Chưa có cuốn sách nào trong kho'}
                </td>
              </tr>
            ) : (
              filteredBooks.map((b) => {
                const isFlash = isBookFlashSaleActive(b);
                const hasDiscount = b.discountPrice != null && b.discountPrice < b.price;
                const flashPrice = Math.round(b.price * 0.5);

                return (
                  <tr
                    key={b._id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isFlash ? 'bg-rose-50/25' : ''
                    }`}
                  >
                    {/* Bìa sách */}
                    <td className="p-3 text-center">
                      <div className="relative inline-block overflow-hidden rounded shadow-xs border border-slate-200">
                        <Cover book={b} className="h-12 w-9 rounded object-cover" />
                        {isFlash && (
                          <div className="absolute top-0 right-0 bg-rose-600 text-[9px] font-black text-white px-1 py-0.2 rounded-bl">
                            ⚡
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tên & Tác giả */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 line-clamp-1">{b.title}</div>
                      <div className="text-xs text-slate-500">{b.author}</div>
                      {isFlash && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-0.5 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-2xs">
                            ⚡ FLASH SALE -50%
                          </span>
                          <span className="text-[11px] text-rose-600 font-medium">
                            Đến {new Date(b.flashSaleEndDate).toLocaleDateString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Danh mục */}
                    <td className="p-3">
                      <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {b.category}
                      </span>
                    </td>

                    {/* Giá bán */}
                    <td className="p-3">
                      {isFlash ? (
                        <div>
                          <div className="font-bold text-rose-600 flex items-center gap-1">
                            <span>{formatPrice(flashPrice)}</span>
                            <span className="rounded bg-rose-100 px-1 py-0.2 text-[10px] font-black text-rose-700">
                              -50%
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 line-through">
                            {formatPrice(b.price)}
                          </div>
                        </div>
                      ) : hasDiscount ? (
                        <div>
                          <div className="font-semibold text-rose-600">
                            {formatPrice(b.discountPrice)}
                          </div>
                          <div className="text-xs text-slate-400 line-through">
                            {formatPrice(b.price)}
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium text-slate-800">{formatPrice(b.price)}</div>
                      )}
                    </td>

                    {/* Tồn kho */}
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          b.stock === 0
                            ? 'bg-red-100 text-red-700 font-bold'
                            : b.stock < 10
                            ? 'bg-amber-100 text-amber-800 font-semibold'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {b.stock === 0 ? 'Hết hàng' : `${b.stock} cuốn`}
                      </span>
                    </td>

                    {/* Hành động */}
                    <td className="p-3 text-right pr-4 space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => quickToggleFlashSale(b)}
                        title={isFlash ? 'Tắt chế độ Flash Sale' : 'Kích hoạt Flash Sale 24h (-50%)'}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          isFlash
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {isFlash ? '✕ Tắt Sale' : '⚡ Bật 24h'}
                      </button>
                      <button
                        onClick={() => setEditingBook(b)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => remove(b._id, b.title)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                      >
                        🗑️ Xóa
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal cập nhật thông tin sách */}
      {editingBook && (
        <EditBookModal
          book={editingBook}
          onClose={() => setEditingBook(null)}
          onSave={handleUpdateSuccess}
        />
      )}
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