const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/authMiddleware');
const Notification = require('./models/Notification');
const User = require('./models/User');

// Get all notifications for the current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const unreadOnly = req.query.unread === 'true';

        const query = { recipient: userId };
        if (unreadOnly) {
            query.read = false;
        }

        // Get total count for pagination
        const total = await Notification.countDocuments(query);

        // Get notifications with pagination
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('sender', 'username fullName avatar')
            .exec();

        res.json({
            notifications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
});

// Get unread count for the current user
router.get('/unread/count', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get unread count from user document directly
        const user = await User.findById(userId);
        const count = user.unreadNotifications || 0;

        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        // Find notification and check if it belongs to the user
        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Mark as read
        await notification.markAsRead();

        res.json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error marking notification as read', error: error.message });
    }
});

// Mark all notifications as read
router.put('/read/all', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all unread notifications for the user
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false
        });

        if (unreadCount === 0) {
            return res.json({ message: 'No unread notifications found' });
        }

        // Update all notifications
        await Notification.updateMany(
            { recipient: userId, read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        // Reset user's unread counter
        await User.findByIdAndUpdate(userId, { unreadNotifications: 0 });

        res.json({ message: `${unreadCount} notifications marked as read` });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
    }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        // Find notification and check if it belongs to the user
        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // If the notification is unread, decrement the unread count
        if (!notification.read) {
            await User.findByIdAndUpdate(
                userId,
                { $inc: { unreadNotifications: -1 } }
            );
        }

        // Delete the notification
        await notification.deleteOne();

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
});

// Clear all notifications for the user
router.delete('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete all notifications for the user
        const result = await Notification.deleteMany({ recipient: userId });

        // Reset user's unread counter
        await User.findByIdAndUpdate(userId, { unreadNotifications: 0 });

        res.json({ message: `${result.deletedCount} notifications deleted` });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ message: 'Error clearing notifications', error: error.message });
    }
});

// Update notification settings
router.put('/settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { notificationSettings } = req.body;

        if (!notificationSettings) {
            return res.status(400).json({ message: 'Notification settings are required' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { notificationSettings } },
            { new: true }
        );

        res.json({
            message: 'Notification settings updated',
            settings: user.notificationSettings
        });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ message: 'Error updating notification settings', error: error.message });
    }
});

module.exports = router;
