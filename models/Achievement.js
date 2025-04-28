const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AchievementSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: 'images/achievements/default.svg'
    },
    category: {
        type: String,
        enum: ['social', 'location', 'content', 'general'],
        default: 'general'
    },
    criteria: {
        type: {
            type: String,
            required: true,
            enum: [
                'FRIEND_COUNT',
                'LOCATION_COUNT',
                'REVIEW_COUNT',
                'LIKE_COUNT',
                'LOGIN_STREAK',
                'PROFILE_COMPLETE',
                'VERIFY_EMAIL',
                'ENABLE_2FA',
                'CUSTOM'
            ]
        },
        threshold: {
            type: Number,
            default: 1
        },
        customCheck: {
            type: String // For custom criteria logic
        }
    },
    points: {
        type: Number,
        default: 10
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    unlocked: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    isHidden: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Methods for checking achievement criteria
AchievementSchema.statics.checkCriteria = async function(userId, achievementId) {
    const User = mongoose.model('User');
    const user = await User.findById(userId);
    if (!user) return false;

    const achievement = await this.findById(achievementId);
    if (!achievement) return false;

    // Check if user already has this achievement
    const alreadyUnlocked = achievement.unlocked.some(
        unlock => unlock.user.toString() === userId.toString()
    );
    if (alreadyUnlocked) return false;

    let isAchieved = false;

    switch (achievement.criteria.type) {
        case 'FRIEND_COUNT':
            isAchieved = user.friends && user.friends.length >= achievement.criteria.threshold;
            break;
        case 'LOCATION_COUNT':
            // Would need to query Locations collection
            // For mock purposes, use a simple check
            isAchieved = Math.random() > 0.7; // 30% chance
            break;
        case 'VERIFY_EMAIL':
            isAchieved = user.isVerified === true;
            break;
        case 'ENABLE_2FA':
            isAchieved = user.twoFactorEnabled === true;
            break;
        case 'PROFILE_COMPLETE':
            isAchieved = !!user.fullName && !!user.bio && !!user.avatar &&
                      user.avatar !== 'images/default-avatar.svg';
            break;
        default:
            // For other criteria types, we would implement specific logic
            isAchieved = false;
    }

    if (isAchieved) {
        // Add achievement to user
        achievement.unlocked.push({
            user: userId,
            date: new Date()
        });
        await achievement.save();

        // Could also update user's achievements list if tracking there
        return true;
    }

    return false;
};

// Check all achievements for a user
AchievementSchema.statics.checkAllForUser = async function(userId) {
    const achievements = await this.find({ isHidden: false });
    const newlyAchieved = [];

    for (const achievement of achievements) {
        const achieved = await this.checkCriteria(userId, achievement._id);
        if (achieved) {
            newlyAchieved.push(achievement);
        }
    }

    return newlyAchieved;
};

module.exports = mongoose.model('Achievement', AchievementSchema);
