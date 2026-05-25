// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { initSocket, disconnectSocket, subscribeToEvent } from '../services/socket';
import { selectIsAuthenticated, selectUser, signOut } from '../store/slices/authSlice';
import {
  addNotification,
  setUnreadCount,
  socketMarkRead,
  socketMarkAllRead,
  socketDeleteOne,
  socketDeleteAll,
  loadMissedNotifications,
} from '../store/slices/notificationsSlice';
import {
  updateApplicationInList,
  addApplicationToReview,
  markApplicationVerifiedInList,
  markDocRequestResolved,
  addAdminAppStreamEntry,
} from '../store/slices/applicationsSlice';
import {
  setUserOnline,
  setUserOffline,
  setOnlineUsers,
  setUserActiveStatus,
} from '../store/slices/UserSlice';
import { setUser } from '../store/slices/authSlice';
import { addLogEntry } from '../store/slices/activityLogSlice';
import { applySettingsUpdate } from '../store/slices/settingsSlice';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const dispatch        = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user            = useSelector(selectUser);
  const cleanupRef      = useRef([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = initSocket();
    // authenticate_cookie is emitted by socket.js in the connect handler.
    // No need to emit it again here — rooms are already joined by server middleware.

    // ── Connection events ─────────────────────────────────────────────────
    // Server sends this as backward-compat confirmation after authenticate_cookie.
    const handleAuthenticated = () => {
      console.log('[Socket] Authenticated and rooms joined');
    };

    // Handle server-side auth rejections (inactive account, token expired, etc.)
    const handleConnectError = (err) => {
      const reason = err.message;
      if (reason === 'ACCOUNT_INACTIVE') {
        toast.error('Your account has been deactivated. Please contact the administrator.', {
          duration: 8000,
          style: { background: '#450a0a', color: '#fecaca', border: '1px solid #b91c1c' },
        });
        dispatch(signOut());
      } else if (reason === 'AUTH_FAILED') {
        toast.error('Your session has expired. Please log in again.', {
          duration: 5000,
          style: { background: '#1e1b4b', color: '#e2e8f0', border: '1px solid rgba(67,56,202,0.3)' },
        });
        dispatch(signOut());
      }
    };

    // ── Notification events ───────────────────────────────────────────────
    // Server delivers unread notifications from when the user was offline on connect.
    const handleMissedNotifications = ({ notifications, unreadCount }) =>
      dispatch(loadMissedNotifications({ notifications, unreadCount }));

    const handleNewNotification = ({ notification }) => {
      dispatch(addNotification(notification));
      // Show a real-time toast so the user sees it immediately, not just the badge
      const msg   = notification?.message || 'New notification';
      const short = msg.length > 90 ? msg.slice(0, 90) + '…' : msg;
      switch (notification?.type) {
        case 'success': toast.success(short, { duration: 5000 }); break;
        case 'error':   toast.error(short,   { duration: 6000 }); break;
        case 'warning': toast(short, { icon: '⚠️', duration: 5000 }); break;
        default:        toast(short, { icon: '🔔', duration: 4000 }); break;
      }
    };
    const handleNotificationCountUpdate = ({ unreadCount })  => dispatch(setUnreadCount(unreadCount));
    const handleNotificationRead        = ({ notificationId }) => dispatch(socketMarkRead(notificationId));
    const handleNotificationsAllRead    = () => dispatch(socketMarkAllRead());
    const handleNotificationDeleted     = ({ notificationId }) => dispatch(socketDeleteOne(notificationId));
    const handleNotificationsAllDeleted = () => dispatch(socketDeleteAll());

    // ── Application events ────────────────────────────────────────────────
    const handleNewApplication = (data) => {
      if (data.application) dispatch(addApplicationToReview(data.application));
      toast(`📨 ${data.message}`, { duration: 5000 });
    };

    const handleStatusUpdate = (data) => {
      if (data.application) dispatch(updateApplicationInList(data.application));
      if (data.message) toast.success(data.message, { duration: 5000 });
    };

    const handleForwarded = (data) => {
      if (data.application) dispatch(addApplicationToReview(data.application));
      if (data.message) toast(`📤 ${data.message}`, { duration: 5000 });
    };

    // Examiner verified app → HOD gets this, shows awaitingFinalApproval tag
    const handleVerifiedReturned = (data) => {
      if (data.applicationId) {
        dispatch(markApplicationVerifiedInList({
          applicationId:        data.applicationId,
          academicVerification: { isVerified: true, cgpa: data.cgpa },
        }));
        // Also add to HOD review queue if not already there
        dispatch(addApplicationToReview({ _id: data.applicationId, awaitingFinalApproval: true }));
      }
      toast.success(
        `✅ Application verified (CGPA: ${data.cgpa}) — ready for your final approval`,
        { duration: 7000 }
      );
    };

    // Examiner requested docs from student — mark app in student's list
    const handleDocsRequested = (data) => {
      if (data.applicationId) {
        dispatch(updateApplicationInList({ _id: data.applicationId, hasPendingDocRequest: true }));
      }
      toast(
        `📎 Documents required: ${data.message}`,
        {
          duration: 10000,
          icon: '📎',
          style: { background: '#451a03', color: '#fed7aa', border: '1px solid #ea580c60' },
        }
      );
    };

    // Student uploaded docs → examiner gets this
    const handleDocsUploaded = (data) => {
      // Move app from awaitingDocs back to pendingVerification
      if (data.applicationId) dispatch(markDocRequestResolved(data.applicationId));
      toast.success(
        `📄 ${data.studentName} has uploaded the requested documents. You can now proceed with verification.`,
        { duration: 7000 }
      );
    };

    // ── Presence events ───────────────────────────────────────────────────
    const handleUserOnline        = ({ userId })           => dispatch(setUserOnline(userId));
    const handleUserOffline       = ({ userId })           => dispatch(setUserOffline(userId));
    const handleOnlineUsersList   = ({ userIds })          => dispatch(setOnlineUsers(userIds));
    const handleUserStatusChanged = ({ userId, isActive }) => dispatch(setUserActiveStatus({ id: userId, isActive }));

    // ── Account events ────────────────────────────────────────────────────
    const handleForcedLogout = ({ message }) => {
      toast.error(message || 'Your account has been deactivated.', {
        duration: 6000,
        style: { background: '#450a0a', color: '#fecaca', border: '1px solid #b91c1c' },
      });
      dispatch(signOut());
    };
    const handleAccountDeleted = ({ message }) => {
      toast.error(message || 'Your account has been permanently deleted.', {
        duration: 8000,
        style: { background: '#450a0a', color: '#fecaca', border: '1px solid #b91c1c' },
      });
      setTimeout(() => { window.location.href = '/login'; }, 3000);
    };
    const handleProfileUpdated = ({ department, role, message }) => {
      dispatch(setUser({ ...user, department, role }));
      toast(`⚙️ ${message}`, { duration: 5000 });
    };
    const handleSettingsUpdated = (settings) => {
      dispatch(applySettingsUpdate(settings));
      toast('⚙️ System settings updated', { duration: 3000 });
    };

    // ── Admin: activity log stream ─────────────────────────────────────────
    // Human-readable event ticker (existing)
    const handleAdminActivityLog = (logEntry) => {
      dispatch(addLogEntry(logEntry));
    };

    // ── Admin: application state update stream ────────────────────────────
    // Structured data for live dashboard table patching
    // Fired by backend emitAdminApplicationUpdate() on every state change
    const handleAdminApplicationUpdate = (data) => {
      dispatch(addAdminAppStreamEntry(data));
      // Also patch the admin applications list in place if loaded
      if (data.applicationId && data.status) {
        dispatch(updateApplicationInList({
          _id:    data.applicationId,
          status: data.status,
        }));
      }
    };

    // ── Subscribe to all events ───────────────────────────────────────────
    cleanupRef.current = [
      subscribeToEvent('authenticated',             handleAuthenticated),
      subscribeToEvent('connect_error',             handleConnectError),
      subscribeToEvent('missed_notifications',      handleMissedNotifications),

      subscribeToEvent('newNotification',           handleNewNotification),
      subscribeToEvent('notification_count_update', handleNotificationCountUpdate),
      subscribeToEvent('notification_read',         handleNotificationRead),
      subscribeToEvent('notifications_all_read',    handleNotificationsAllRead),
      subscribeToEvent('notification_deleted',      handleNotificationDeleted),
      subscribeToEvent('notifications_all_deleted', handleNotificationsAllDeleted),

      subscribeToEvent('newApplication',            handleNewApplication),
      subscribeToEvent('applicationStatusUpdate',   handleStatusUpdate),
      subscribeToEvent('applicationForwarded',      handleForwarded),

      // Examiner-specific events
      subscribeToEvent('application_verified_returned', handleVerifiedReturned),
      subscribeToEvent('docs_requested',                handleDocsRequested),
      subscribeToEvent('docs_uploaded',                 handleDocsUploaded),

      subscribeToEvent('user_online',               handleUserOnline),
      subscribeToEvent('user_offline',              handleUserOffline),
      subscribeToEvent('online_users_list',         handleOnlineUsersList),
      subscribeToEvent('user_status_changed',       handleUserStatusChanged),

      subscribeToEvent('forced_logout',             handleForcedLogout),
      subscribeToEvent('account_deleted',           handleAccountDeleted),
      subscribeToEvent('profile_updated',           handleProfileUpdated),
      subscribeToEvent('settingsUpdated',           handleSettingsUpdated),

      // Admin streams
      subscribeToEvent('admin_activity_log',        handleAdminActivityLog),
      subscribeToEvent('admin_application_update',  handleAdminApplicationUpdate),
    ];

    return () => {
      cleanupRef.current.forEach(unsub => unsub?.());
      cleanupRef.current = [];
    };
  }, [isAuthenticated, user, dispatch]);

  useEffect(() => {
    if (!isAuthenticated) disconnectSocket();
  }, [isAuthenticated]);
};

export default useSocket;