import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../store/notificationSlice';
import { formatTimeAgo } from '../utils/helpers';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const dropdownRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, unreadCount, loading } = useSelector((s) => s.notifications);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      dispatch(fetchNotifications());
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      await dispatch(markAsRead(notif._id));
    }
    setIsOpen(false);

    // Chuyển hướng tới trang phù hợp
    if (notif.type === 'ADMIN_ORDER_ALERT') {
      navigate('/admin');
    } else if (notif.type === 'ORDER_PLACED') {
      navigate('/profile');
    }
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await dispatch(markAllAsRead());
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await dispatch(deleteNotification(id));
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút Chuông Thông Báo */}
      <button
        type="button"
        onClick={toggleDropdown}
        aria-label="Thông báo"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 pt-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`pb-2 px-3 border-b-2 transition ${
                filter === 'all'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`pb-2 px-3 border-b-2 transition ${
                filter === 'unread'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* List Notifications */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2"></div>
                <p>Đang tải thông báo...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">Không có thông báo nào</p>
                <p className="text-xs text-slate-400 mt-1">
                  {filter === 'unread' ? 'Bạn đã đọc hết mọi thông báo.' : 'Bạn chưa có thông báo nào mới.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  className={`group relative flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-slate-50 ${
                    !item.isRead ? 'bg-indigo-50/40' : 'bg-white'
                  }`}
                >
                  {/* Icon Loại Thông Báo */}
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      item.type === 'ADMIN_ORDER_ALERT'
                        ? 'bg-amber-100 text-amber-600'
                        : item.type === 'ORDER_PLACED'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {item.type === 'ADMIN_ORDER_ALERT' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>

                  {/* Nội Dung */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-sm truncate ${
                          !item.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                        }`}
                      >
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <span className="text-[11px] text-slate-400 mt-1.5 block">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Dấu chấm Chưa đọc & Nút Xóa */}
                  <div className="absolute top-3.5 right-3 flex flex-col items-end gap-2">
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item._id)}
                      title="Xóa thông báo"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition rounded"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
