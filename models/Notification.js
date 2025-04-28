const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        required: true,
        enum: [
            'FRIEND_REQUEST',
            'FRIEND_ACCEPTED',
            'MESSAGE',
            'ACHIEVEMENT',
            'LOCATION_SHARE',
            'LOCATION_LIKE',
            'SYSTEM'
        ]
    },
    content: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    data: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for faster queries
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Method to mark notification as read
NotificationSchema.methods.markAsRead = async function() {
    this.read = true;
    await this.save();

    // Decrement unread count for user if the notification was unread
    if (!this.read) {
        const User = mongoose.model('User');
        const user = await User.findById(this.recipient);
        if (user && user.unreadNotifications > 0) {
            user.unreadNotifications -= 1;
            await user.save();
        }
    }

    return this;
};

// Static method to create a notification and increment user's unread count
NotificationSchema.statics.createNotification = async function(notificationData) {
    const notification = new this(notificationData);
    await notification.save();

    // Increment unread notification count for recipient
    const User = mongoose.model('User');
    const user = await User.findById(notification.recipient);
    if (user) {
        user.unreadNotifications = (user.unreadNotifications || 0) + 1;
        await user.save();
    }

    return notification;
};

module.exports = mongoose.model('Notification', NotificationSchema);
