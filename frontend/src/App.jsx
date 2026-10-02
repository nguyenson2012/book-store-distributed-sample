import { useEffect } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapAuth } from './store/authSlice';
import { clearCart, fetchCart } from './store/cartSlice';
import { fetchNotifications, fetchUnreadCount } from './store/notificationSlice';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AdminRoute, ProtectedRoute } from './components/RouteGuards';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  // Khôi phục phiên đăng nhập khi mở app
  useEffect(() => { dispatch(bootstrapAuth()); }, [dispatch]);

  // Đồng bộ giỏ hàng theo trạng thái đăng nhập
  useEffect(() => {
    if (user) dispatch(fetchCart());
    else dispatch(clearCart());
  }, [user, dispatch]);

  // Đồng bộ thông báo theo trạng thái đăng nhập + kiểm tra định kỳ
  useEffect(() => {
    if (!user) return;
    dispatch(fetchUnreadCount());
    dispatch(fetchNotifications());

    const interval = setInterval(() => {
      dispatch(fetchUnreadCount());
    }, 20000);

    return () => clearInterval(interval);
  }, [user, dispatch]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<p className="p-16 text-center">404 - Không tìm thấy trang</p>} />
      </Route>
    </Routes>
  );
}