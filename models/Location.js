const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['restaurant', 'cafe', 'park', 'museum', 'monument', 'hotel', 'beach', 'other'],
        default: 'other'
    },
    tags: [String],
    coordinates: {
        type: {
            type: String,
            default: 'Point',
            enum: ['Point']
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    photos: [String],
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    visits: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    reviews: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        text: String,
        rating: {
            type: Number,
            min: 0,
            max: 5
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    isPublic: {
        type: Boolean,
        default: true
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

// Create geospatial index for location-based queries
locationSchema.index({ 'coordinates': '2dsphere' });

// Add additional indexes for faster queries
locationSchema.index({ creator: 1 });
locationSchema.index({ isPublic: 1 });
locationSchema.index({ tags: 1 });
locationSchema.index({ type: 1 });

module.exports = mongoose.model('Location', locationSchema);
