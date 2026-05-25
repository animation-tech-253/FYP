import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import {
  selectNotifications,
  selectUnreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from '../../store/slices/notificationsSlice';
import { formatDistanceToNow } from '../../utils/helpers';

// Color-coded dot per notification type
const TYPE_DOT = {
  success: 'bg-emerald-400',
  info:    'bg-blue-400',
  warning: 'bg-amber-400',
  alert:   'bg-red-400',
};

export default function NotificationBell() {
  const dispatch      = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unreadCount   = useSelector(selectUnreadCount);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = (e, id) => {
    e.stopPropagation(); // prevent triggering markRead on the row
    dispatch(deleteNotification(id));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-obsidian-800/60 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 card border border-gray-300 dark:border-white/5 shadow-2xl animate-slide-up overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => dispatch(markAllRead())}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => dispatch(deleteAllNotifications())}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No notifications yet</div>
            ) : (
              notifications.slice(0, 15).map(n => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
                  className={`group flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-obsidian-800/40 transition-colors ${!n.isRead ? 'bg-indigo-600/5' : ''}`}
                >
                  {/* Color-coded type dot */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? (TYPE_DOT[n.type] || 'bg-indigo-400') : 'bg-gray-300 dark:bg-obsidian-800/50'}`} />

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!n.isRead ? 'text-gray-700 dark:text-slate-200' : 'text-gray-500 dark:text-slate-400'}`}>{n.message}</p>
                    <p className="text-gray-400 dark:text-slate-600 text-[11px] mt-1">{formatDistanceToNow(n.createdAt)}</p>
                  </div>

                  {/* Per-notification delete — visible on row hover */}
                  <button
                    onClick={(e) => handleDelete(e, n._id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-slate-600 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                    title="Delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}