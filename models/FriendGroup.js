const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FriendGroupSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    color: {
        type: String,
        default: '#0b93f6' // Default blue color
    },
    icon: {
        type: String,
        default: 'group' // Default icon name
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes for faster queries
FriendGroupSchema.index({ owner: 1 });
FriendGroupSchema.index({ members: 1 });

module.exports = mongoose.model('FriendGroup', FriendGroupSchema);
