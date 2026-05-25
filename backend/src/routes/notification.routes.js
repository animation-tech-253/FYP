// src/routes/notification.routes.js
import express from 'express';
import {
    getMyNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllNotifications,
} from '../controllers/notification.controller.js';
import isAuth from '../middleware/isAuth.js';

const router = express.Router();

// All routes require authentication
router.use(isAuth);

// Get all notifications (includes unreadCount in response)
router.get('/', getMyNotifications);

// Get unread count only — lightweight, for polling fallback
router.get('/unread-count', getUnreadCount);

// Mark all as read
router.patch('/read-all', markAllNotificationsAsRead);

// Delete all
router.delete('/delete-all', deleteAllNotifications);

// Single notification actions
router.patch(   '/:id', markNotificationAsRead);
router.delete('/:id', deleteNotification);

export default router;