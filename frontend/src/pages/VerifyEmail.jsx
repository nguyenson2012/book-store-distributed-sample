import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { verifyEmail } from '../store/authSlice';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user } = useSelector((s) => s.auth);
  const called = useRef(false);

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;
    dispatch(verifyEmail(token)).then((res) => {
      if (!res.error) {
        // Đăng nhập thành công sau xác nhận → về trang chủ sau 2 giây
        setTimeout(() => navigate('/', { replace: true }), 2000);
      }
    });
  }, [token, dispatch, navigate]);

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="card space-y-4 text-center">
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h1 className="text-2xl font-bold">Link không hợp lệ</h1>
          <p className="text-slate-500">Đường link xác nhận email không đúng định dạng.</p>
          <Link to="/register" className="btn block w-full">Đăng ký lại</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="card space-y-4 text-center">
          <div style={{ fontSize: '3rem' }}>⏳</div>
          <h1 className="text-2xl font-bold">Đang xác nhận email...</h1>
          <p className="text-slate-500">Vui lòng chờ trong giây lát.</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 40, height: 40, border: '4px solid #e5e7eb',
              borderTopColor: '#6366f1', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="card space-y-4 text-center">
          <div style={{ fontSize: '3rem' }}>❌</div>
          <h1 className="text-2xl font-bold">Xác nhận thất bại</h1>
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          <p className="text-sm text-slate-500">Link có thể đã hết hạn (sau 24 giờ). Hãy đăng ký lại để nhận email mới.</p>
          <Link to="/register" className="btn block w-full">Đăng ký lại</Link>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="card space-y-4 text-center">
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h1 className="text-2xl font-bold">Email đã được xác nhận!</h1>
          <p className="text-slate-500">
            Chào mừng <strong>{user.name}</strong>! Tài khoản của bạn đã được kích hoạt thành công.
            Bạn sẽ được chuyển về trang chủ trong giây lát...
          </p>
          <Link to="/" className="btn block w-full">Về trang chủ ngay</Link>
        </div>
      </div>
    );
  }

  return null;
}
