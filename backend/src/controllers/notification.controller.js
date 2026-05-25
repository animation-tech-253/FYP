// src/controllers/notification.controller.js
import { Notification } from '../models/index.js';
import { emitToUser } from '../socket/index.js';

// ── Get all notifications for the logged-in user ──────────────────────────────
export const getMyNotifications = async (req, res) => {
    try {
        // Run both queries in parallel — no reason to await them sequentially
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ recipient: req.user._id })
                .populate('relatedApplication', 'title applicationId status')
                .sort({ createdAt: -1 })
                .limit(50),
            Notification.countDocuments({ recipient: req.user._id, isRead: false }),
        ]);

        res.status(200).json({ success: true, data: notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Get unread count only (lightweight poll / socket fallback) ────────────────
export const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
        });
        res.status(200).json({ success: true, unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Mark a single notification as read ───────────────────────────────────────
export const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        // findOneAndUpdate returns the OLD doc by default (before: true not set here)
        // We use { new: false } explicitly so we can check if it WAS already read
        // before this call — if it was already read, no count change needed
        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.user._id },
            { isRead: true, readAt: new Date() },
            { new: false } // returns the document BEFORE the update
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        }

        // Only emit a count update if this notification was previously unread
        // This avoids a countDocuments round trip entirely
        if (!notification.isRead) {
            const unreadCount = await Notification.countDocuments({
                recipient: req.user._id,
                isRead: false,
            });
            emitToUser(req.user._id.toString(), 'notification_count_update', { unreadCount });
        }

        emitToUser(req.user._id.toString(), 'notification_read', { notificationId: id });

        res.status(200).json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Mark ALL notifications as read ───────────────────────────────────────────
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        emitToUser(req.user._id.toString(), 'notifications_all_read',    { message: 'All notifications cleared' });
        emitToUser(req.user._id.toString(), 'notification_count_update', { unreadCount: 0 });

        res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Delete a single notification ──────────────────────────────────────────────
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: id,
            recipient: req.user._id,
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        }

        // Only do a countDocuments round trip if the deleted notification was unread
        // If it was already read, count hasn't changed — no need to update frontend
        if (!notification.isRead) {
            const unreadCount = await Notification.countDocuments({
                recipient: req.user._id,
                isRead: false,
            });
            emitToUser(req.user._id.toString(), 'notification_count_update', { unreadCount });
        }

        emitToUser(req.user._id.toString(), 'notification_deleted', { notificationId: id });

        res.status(200).json({ success: true, message: 'Notification deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Delete ALL notifications for the user ────────────────────────────────────
export const deleteAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id });

        emitToUser(req.user._id.toString(), 'notifications_all_deleted', {});
        emitToUser(req.user._id.toString(), 'notification_count_update', { unreadCount: 0 });

        res.status(200).json({ success: true, message: 'All notifications deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};