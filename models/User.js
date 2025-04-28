const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
    sessionId: {
        type: String,
        required: true
    },
    deviceInfo: {
        type: String,
        default: 'Unknown Device'
    },
    ipAddress: {
        type: String,
        default: 'Unknown IP'
    },
    location: {
        type: String,
        default: 'Unknown Location'
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    }
});

const biometricDeviceSchema = new Schema({
    deviceId: {
        type: String,
        required: true
    },
    deviceName: {
        type: String,
        default: 'Unknown Device'
    },
    biometricKeyId: {
        type: String,
        required: true
    },
    biometricPublicKey: {
        type: String,
        required: true
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    lastUsed: {
        type: Date
    }
});

// Location schema
const pointSchema = new Schema({
    type: {
        type: String,
        default: 'Point',
        enum: ['Point']
    },
    coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isSharing: {
        type: Boolean,
        default: false
    }
});

// Social account schema
const socialAccountSchema = new Schema({
    provider: {
        type: String,
        required: true,
        enum: ['google', 'facebook', 'twitter', 'github']
    },
    id: {
        type: String,
        required: true
    },
    email: String,
    name: String,
    avatar: String,
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Activity schema
const activitySchema = new Schema({
    type: {
        type: String,
        required: true,
        enum: ['FRIEND_ADDED', 'LOCATION_ADDED', 'LOCATION_LIKED', 'PROFILE_UPDATED']
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

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    resetPasswordAttempts: {
        type: Number,
        default: 0
    },
    lastResetRequest: Date,
    resetPasswordLocked: {
        type: Boolean,
        default: false
    },
    resetPasswordLockExpires: Date,
    roles: [{
        type: String,
        ref: 'Role'
    }],
    avatar: {
        type: String,
        default: 'images/default-avatar.svg'
    },
    fullName: String,
    bio: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: Date,
    activeSessions: [sessionSchema],
    biometricDevices: [biometricDeviceSchema],
    socialAccounts: [socialAccountSchema],
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    twoFactorBackupCodes: [String],
    friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    friendRequests: {
        sent: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        received: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    activity: [activitySchema],
    currentLocation: pointSchema,
    unreadNotifications: {
        type: Number,
        default: 0
    },
    twoFactorAuth: {
        enabled: {
            type: Boolean,
            default: false
        },
        secret: String,
        backupCodes: [String],
        verifiedDevices: [{
            deviceId: String,
            deviceName: String,
            lastLogin: Date,
            ipAddress: String
        }],
        lastUsed: Date
    },
    securityLogs: [{
        action: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        ipAddress: String,
        userAgent: String,
        success: Boolean,
        details: String
    }]
});

// Add timestamps to track when documents are created and updated
UserSchema.set('timestamps', true);

// Create a geospatial index on the currentLocation field for location-based queries
UserSchema.index({ 'currentLocation.coordinates': '2dsphere' });

module.exports = mongoose.model('User', UserSchema);
