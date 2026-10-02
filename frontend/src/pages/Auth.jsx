import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearError, login, register } from '../store/authSlice';

export default function Auth({ mode }) {
  const isLogin = mode === 'login';
  const { user, loading, error } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => { dispatch(clearError()); }, [mode, dispatch]);

  // Đã đăng nhập thì quay về trang trước đó (hoặc trang chủ)
  if (user) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const action = isLogin ? login({ email: form.email, password: form.password }) : register(form);
    const res = await dispatch(action);
    if (!res.error) navigate(location.state?.from?.pathname || '/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-2xl font-bold">{isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!isLogin && <input className="input" placeholder="Họ và tên" required value={form.name} onChange={set('name')} />}
        <input type="email" className="input" placeholder="Email" required value={form.email} onChange={set('email')} />
        <input type="password" className="input" placeholder="Mật khẩu (tối thiểu 6 ký tự)" required minLength={6}
          value={form.password} onChange={set('password')} />

        <button className="btn w-full" disabled={loading}>
          {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
        </button>

        <p className="text-center text-sm text-slate-500">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <Link to={isLogin ? '/register' : '/login'} className="text-indigo-600 hover:underline">
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </Link>
        </p>
      </form>
    </div>
  );
}