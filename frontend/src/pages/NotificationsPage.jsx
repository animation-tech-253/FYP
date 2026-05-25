import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
} from '../store/slices/notificationsSlice';
import { formatDistanceToNow } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';

const TYPE_DOT = {
  success: 'bg-emerald-400',
  info:    'bg-blue-400',
  warning: 'bg-amber-400',
  alert:   'bg-red-400',
};

export default function NotificationsPage() {
  const dispatch      = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unread        = useSelector(selectUnreadCount);
  const loading       = useSelector(selectNotificationsLoading);

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    dispatch(deleteNotification(id));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <PageHeader
          title="Notifications"
          subtitle={`${unread} unread`}
          icon={Bell}
          iconColor="text-blue-500"
        />
        <div className="flex items-center gap-2 mt-1">
          {unread > 0 && (
            <button
              onClick={() => dispatch(markAllRead())}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => dispatch(deleteAllNotifications())}
              className="btn-secondary flex items-center gap-2 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden animate-slide-up">
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-2 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-obsidian-800/50 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">No notifications yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {notifications.map((n, idx) => (
              <div
                key={n._id}
                onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
                className={`group flex gap-4 px-5 py-4 cursor-pointer transition-colors animate-fade-in ${
                  !n.isRead
                    ? 'bg-blue-50/60 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-obsidian-800/20'
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Color-coded type dot */}
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                  !n.isRead ? (TYPE_DOT[n.type] || 'bg-blue-500') : 'bg-slate-300 dark:bg-obsidian-800/60'
                }`} />

                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${
                    !n.isRead
                      ? 'text-slate-800 dark:text-slate-100 font-medium'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {n.message}
                  </p>
                  {n.relatedApplication && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                      {n.relatedApplication.title} — {n.relatedApplication.applicationId}
                    </p>
                  )}
                  <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">{formatDistanceToNow(n.createdAt)}</p>
                </div>

                <div className="flex items-start gap-2 flex-shrink-0">
                  {/* Unread indicator dot */}
                  {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}

                  {/* Per-notification delete — visible on row hover */}
                  <button
                    onClick={(e) => handleDelete(e, n._id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
