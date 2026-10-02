import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Cần đăng nhập
export function ProtectedRoute() {
  const { user, initialized } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!initialized) return <p className="p-10 text-center text-slate-500">Đang tải...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

// Chỉ admin (backend vẫn kiểm tra lại bằng restrictTo, đây chỉ là lớp UX)
export function AdminRoute() {
  const { user, initialized } = useSelector((s) => s.auth);
  if (!initialized) return <p className="p-10 text-center text-slate-500">Đang tải...</p>;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}