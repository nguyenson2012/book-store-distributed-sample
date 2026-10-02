import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { clearCart } from '../store/cartSlice';
import { clearNotifications } from '../store/notificationSlice';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user } = useSelector((s) => s.auth);
  const count = useSelector((s) => s.cart.items.reduce((n, i) => n + i.quantity, 0));
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logout());
    dispatch(clearCart());
    dispatch(clearNotifications());
    navigate('/');
  };

  const link = ({ isActive }) =>
    `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-indigo-600">📚 Bookstore</Link>

        <div className="flex items-center gap-5">
          <NavLink to="/" end className={link}>Cửa hàng</NavLink>
          <NavLink to="/cart" className={link}>
            Giỏ hàng
            {count > 0 && (
              <span className="ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{count}</span>
            )}
          </NavLink>

          {user ? (
            <>
              {user.role === 'admin' && <NavLink to="/admin" className={link}>Quản trị</NavLink>}
              <NavLink to="/profile" className={link}>{user.name}</NavLink>
              <NotificationBell />
              <button onClick={handleLogout} className="btn-outline">Đăng xuất</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={link}>Đăng nhập</NavLink>
              <Link to="/register" className="btn">Đăng ký</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}