const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const Location = require('./models/Location');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const emailService = require('./emailService');

// Function to send push notifications
async function sendPushNotifications(location, users) {
  try {
    if (!users || users.length === 0) return;

    // Get creator info
    const creator = await User.findById(location.user).select('username fullName');
    const creatorName = creator.fullName || creator.username;

    // Prepare notification message
    const message = {
      to: [], // Will collect all tokens
      title: 'New Location Near You!',
      body: `${location.name} was added by ${creatorName} near you`,
      data: {
        locationId: location._id.toString(),
        type: 'new_location'
      }
    };

    // Collect all push tokens from users
    for (const user of users) {
      if (user.pushTokens && user.pushTokens.length > 0) {
        message.to = message.to.concat(user.pushTokens);
      }

      // Also send email notification if user has email notifications enabled
      if (user.notificationPreferences?.nearbyLocations) {
        await emailService.sendLocationAlertEmail(user, location);
      }
    }

    // If we have tokens, send the push notification
    if (message.to.length > 0) {
      // Use Expo's push notification service
      await axios.post('https://exp.host/--/api/v2/push/send', message, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        }
      });

      console.log(`✅ Push notifications sent to ${message.to.length} devices`);
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

// Find users near a location
async function findNearbyUsers(coordinates, maxDistance = 5000, excludeUserId) {
  try {
    // Find users who have location data within the radius
    const users = await User.find({
      _id: { $ne: excludeUserId }, // Exclude the creator
      pushTokens: { $exists: true, $not: { $size: 0 } } // Only users with push tokens
    });

    return users;
  } catch (error) {
    console.error('Error finding nearby users:', error);
    return [];
  }
}

// Get all public locations
router.get('/public', async (req, res) => {
  try {
    const locations = await Location.find({ isPublic: true })
      .sort('-createdAt')
      .populate('user', 'username avatar fullName')
      .limit(100);

    res.json(locations);
  } catch (error) {
    console.error('[Get Public Locations Error]:', error);
    res.status(500).json({ message: 'Server error getting locations' });
  }
});

// Get nearby locations
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000, limit = 50, since } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Coordinates required (lat, lng)' });
    }

    // Convert to numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseInt(radius);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ message: 'Invalid coordinate format' });
    }

    // Base query
    const query = {
      isPublic: true,
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    };

    // If since parameter is provided, filter by creation date
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    // Find nearby public locations
    const locations = await Location.find(query)
    .limit(parseInt(limit))
    .populate('user', 'username avatar fullName');

    res.json(locations);
  } catch (error) {
    console.error('[Get Nearby Locations Error]:', error);
    res.status(500).json({ message: 'Server error getting nearby locations' });
  }
});

// Get user locations
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if requesting user's own locations or is admin
    const isOwner = req.user.id === userId;
    const isAdmin = req.user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const locations = await Location.find({ user: userId })
      .sort('-createdAt')
      .populate('user', 'username avatar fullName');

    res.json(locations);
  } catch (error) {
    console.error('[Get User Locations Error]:', error);
    res.status(500).json({ message: 'Server error getting user locations' });
  }
});

// Add new location
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      coordinates,
      name,
      address,
      description,
      isPublic,
      tags,
      expiresAt
    } = req.body;

    // Validate required fields
    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({ message: 'Coordinates required' });
    }

    // Create location document
    const location = new Location({
      user: req.user.id,
      coordinates: {
        type: 'Point',
        coordinates: [coordinates.longitude, coordinates.latitude]
      },
      name: name || 'Unnamed Location',
      address,
      description,
      isPublic: !!isPublic,
      tags: tags || [],
      photos: [],
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await location.save();

    // Populate user info for response
    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'username avatar fullName');

    // If the location is public, notify nearby users
    if (isPublic) {
      // Find users in the area (5km radius)
      const nearbyUsers = await findNearbyUsers(
        [coordinates.longitude, coordinates.latitude],
        5000,
        req.user.id // exclude creator
      );

      // Send push notifications to nearby users
      if (nearbyUsers.length > 0) {
        sendPushNotifications(populatedLocation, nearbyUsers)
          .catch(err => console.error('Error sending notifications:', err));
      }
    }

    res.status(201).json({
      message: 'Location created',
      location: populatedLocation
    });
  } catch (error) {
    console.error('[Add Location Error]:', error);
    res.status(500).json({ message: 'Server error creating location' });
  }
});

// Update location
router.put('/:locationId', authMiddleware, async (req, res) => {
  try {
    const { locationId } = req.params;
    const {
      coordinates,
      name,
      address,
      description,
      isPublic,
      tags,
      expiresAt
    } = req.body;

    // Find the location
    const location = await Location.findById(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user is the owner
    if (location.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this location' });
    }

    // Update fields
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      location.coordinates = {
        type: 'Point',
        coordinates: [coordinates.longitude, coordinates.latitude]
      };
    }

    if (name) location.name = name;
    if (address !== undefined) location.address = address;
    if (description !== undefined) location.description = description;
    if (isPublic !== undefined) location.isPublic = isPublic;
    if (tags) location.tags = tags;
    if (expiresAt) location.expiresAt = new Date(expiresAt);

    await location.save();

    // Populate user info for response
    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'username avatar fullName');

    res.json({
      message: 'Location updated',
      location: populatedLocation
    });
  } catch (error) {
    console.error('[Update Location Error]:', error);
    res.status(500).json({ message: 'Server error updating location' });
  }
});

// Delete location
router.delete('/:locationId', authMiddleware, async (req, res) => {
  try {
    const { locationId } = req.params;

    // Find the location
    const location = await Location.findById(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user is the owner or admin
    const isOwner = location.user.toString() === req.user.id;
    const isAdmin = req.user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this location' });
    }

    // Delete location photos if any
    if (location.photos && location.photos.length > 0) {
      location.photos.forEach(photo => {
        try {
          const photoPath = path.join(__dirname, 'public', photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
          }
        } catch (err) {
          console.error('Error deleting photo:', err);
        }
      });
    }

    // Delete the location
    await location.deleteOne();

    res.json({ message: 'Location deleted' });
  } catch (error) {
    console.error('[Delete Location Error]:', error);
    res.status(500).json({ message: 'Server error deleting location' });
  }
});

// Add photo to location
router.post('/:locationId/photos', authMiddleware, async (req, res) => {
  try {
    const { locationId } = req.params;

    // Check if there's a file in the request
    if (!req.files || !req.files.photo) {
      return res.status(400).json({ message: 'No photo found' });
    }

    // Find the location
    const location = await Location.findById(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user is the owner
    if (location.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add photos to this location' });
    }

    const photoFile = req.files.photo;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(photoFile.mimetype)) {
      return res.status(400).json({ message: 'Unsupported file format. Allowed: JPEG, PNG, GIF, WEBP' });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (photoFile.size > maxSize) {
      return res.status(400).json({ message: 'File size exceeds 5MB' });
    }

    // Set up file path and name
    const uploadDir = path.join(__dirname, 'public', 'images', 'locations');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExt = path.extname(photoFile.name).toLowerCase();
    const fileName = `location-${uuidv4()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    try {
      if (typeof photoFile.mv === 'function') {
        await photoFile.mv(filePath);
      } else {
        fs.writeFileSync(filePath, photoFile.data);
      }
    } catch (error) {
      console.error('Error saving photo file:', error);
      return res.status(500).json({ message: 'Error saving file' });
    }

    // Update location with new photo
    const photoRelativePath = `images/locations/${fileName}`;
    location.photos.push(photoRelativePath);
    await location.save();

    res.json({
      message: 'Photo added',
      photo: photoRelativePath
    });
  } catch (error) {
    console.error('[Add Photo Error]:', error);
    res.status(500).json({ message: 'Server error adding photo' });
  }
});

// Like/unlike location
router.post('/:locationId/like', authMiddleware, async (req, res) => {
  try {
    const { locationId } = req.params;

    // Find the location
    const location = await Location.findById(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if user already liked this location
    const userLikedIndex = location.likes.findIndex(
      userId => userId.toString() === req.user.id
    );

    if (userLikedIndex === -1) {
      // Add like
      location.likes.push(req.user.id);
    } else {
      // Remove like
      location.likes.splice(userLikedIndex, 1);
    }

    await location.save();

    res.json({
      message: userLikedIndex === -1 ? 'Like added' : 'Like removed',
      likes: location.likes.length,
      liked: userLikedIndex === -1
    });
  } catch (error) {
    console.error('[Like Location Error]:', error);
    res.status(500).json({ message: 'Server error processing like' });
  }
});

// Search locations by tags or text
router.get('/search', async (req, res) => {
  try {
    const { query, tags } = req.query;

    let searchConditions = { isPublic: true };

    // Text search
    if (query) {
      searchConditions.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } }
      ];
    }

    // Tags search
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      searchConditions.tags = { $in: tagArray };
    }

    const locations = await Location.find(searchConditions)
      .sort('-createdAt')
      .populate('user', 'username avatar fullName')
      .limit(50);

    res.json(locations);
  } catch (error) {
    console.error('[Search Locations Error]:', error);
    res.status(500).json({ message: 'Server error searching locations' });
  }
});

module.exports = router;
