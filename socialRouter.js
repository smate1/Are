const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const config = require('./config');

// Helper function to ensure IDs are properly handled for mock DB or real MongoDB
function ensureValidId(id) {
    if (!id) return null;
    // If we're using a mock DB with string IDs, return the string directly
    if (global.USE_MOCK_DB) {
        return id.toString();
    }
    // Otherwise, ensure it's converted to MongoDB ObjectId
    try {
        return mongoose.Types.ObjectId(id);
    } catch (e) {
        console.error('Invalid ID format:', e);
        return null;
    }
}

// Get user's friends
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    console.log(`Getting friends for user: ${req.user.id}`);

    // Find the user by ID
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get friends list
    let friends = [];
    if (global.USE_MOCK_DB) {
      // For mock DB, manually fetch each friend
      if (user.friends && user.friends.length > 0) {
        friends = await Promise.all(
          user.friends.map(friendId => User.findById(friendId))
        );
        // Filter out any null values (friends that weren't found)
        friends = friends.filter(f => f !== null);
      }
    } else {
      // For real MongoDB, use populate
      const populatedUser = await User.findById(req.user.id)
        .populate('friends', 'username fullName avatar currentLocation.isSharing bio');
      friends = populatedUser.friends || [];
    }

    res.json(friends);
  } catch (error) {
    console.error('[Get Friends Error]:', error);
    res.status(500).json({ message: 'Server error getting friends' });
  }
});

// Get user's pending friend requests
router.get('/friend-requests', authMiddleware, async (req, res) => {
  try {
    console.log(`Getting friend requests for user: ${req.user.id}`);

    // Find the user by ID
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize result structure
    const result = {
      sent: [],
      received: []
    };

    // Handle mock DB differently than MongoDB
    if (global.USE_MOCK_DB) {
      // For mock DB, manually fetch each user in sent and received lists
      if (user.friendRequests) {
        if (user.friendRequests.sent && user.friendRequests.sent.length > 0) {
          result.sent = await Promise.all(
            user.friendRequests.sent.map(userId => User.findById(userId))
          );
          // Filter out any null values (users that weren't found)
          result.sent = result.sent.filter(u => u !== null);
        }

        if (user.friendRequests.received && user.friendRequests.received.length > 0) {
          result.received = await Promise.all(
            user.friendRequests.received.map(userId => User.findById(userId))
          );
          // Filter out any null values (users that weren't found)
          result.received = result.received.filter(u => u !== null);
        }
      }
    } else {
      // For real MongoDB, use populate
      const populatedUser = await User.findById(req.user.id)
        .populate('friendRequests.sent', 'username fullName avatar bio')
        .populate('friendRequests.received', 'username fullName avatar bio');

      result.sent = populatedUser.friendRequests?.sent || [];
      result.received = populatedUser.friendRequests?.received || [];
    }

    res.json(result);
  } catch (error) {
    console.error('[Get Friend Requests Error]:', error);
    res.status(500).json({ message: 'Server error getting friend requests' });
  }
});

// Send friend request
router.post('/friend-request/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`User ${req.user.id} is sending friend request to ${userId}`);

    // Check if trying to add self
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends
    const user = await User.findById(req.user.id);
    const isFriend = user.friends.some(friendId =>
      friendId.toString() === userId.toString()
    );

    if (isFriend) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    // Check if request already sent
    const requestSent = user.friendRequests.sent.some(sentId =>
      sentId.toString() === userId.toString()
    );

    if (requestSent) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Check if the other user already sent a request
    const requestReceived = user.friendRequests.received.some(receivedId =>
      receivedId.toString() === userId.toString()
    );

    if (requestReceived) {
      // Auto-accept if we received a request from them
      user.friends.push(userId);
      user.friendRequests.received = user.friendRequests.received.filter(id =>
        id.toString() !== userId.toString()
      );

      targetUser.friends.push(req.user.id);
      targetUser.friendRequests.sent = targetUser.friendRequests.sent.filter(id =>
        id.toString() !== req.user.id.toString()
      );

      // Add to activity feed
      user.activity.push({
        type: 'FRIEND_ADDED',
        data: {
          friendId: userId,
          friendUsername: targetUser.username
        },
        createdAt: new Date()
      });

      targetUser.activity.push({
        type: 'FRIEND_ADDED',
        data: {
          friendId: req.user.id,
          friendUsername: user.username
        },
        createdAt: new Date()
      });

      await user.save();
      await targetUser.save();

      return res.status(200).json({
        message: 'Friend request accepted automatically',
        status: 'ACCEPTED'
      });
    }

    // Add to sent requests
    user.friendRequests.sent.push(userId);

    // Add to target user's received requests
    targetUser.friendRequests.received.push(req.user.id);

    await user.save();
    await targetUser.save();

    res.status(200).json({
      message: 'Friend request sent successfully',
      status: 'PENDING'
    });
  } catch (error) {
    console.error('[Send Friend Request Error]:', error);
    res.status(500).json({ message: 'Server error sending friend request' });
  }
});

// Accept friend request
router.post('/accept-friend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`User ${req.user.id} is accepting friend request from ${userId}`);

    // Check if user exists
    const requestingUser = await User.findById(userId);
    if (!requestingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the current user
    const user = await User.findById(req.user.id);

    // Check if request exists
    const hasRequest = user.friendRequests.received.some(id =>
      id.toString() === userId.toString()
    );

    if (!hasRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Move from requests to friends for both users
    user.friends.push(userId);
    user.friendRequests.received = user.friendRequests.received.filter(id =>
      id.toString() !== userId.toString()
    );

    requestingUser.friends.push(req.user.id);
    requestingUser.friendRequests.sent = requestingUser.friendRequests.sent.filter(id =>
      id.toString() !== req.user.id.toString()
    );

    // Add to activity feed for both users
    user.activity.push({
      type: 'FRIEND_ADDED',
      data: {
        friendId: userId,
        friendUsername: requestingUser.username
      },
      createdAt: new Date()
    });

    requestingUser.activity.push({
      type: 'FRIEND_ADDED',
      data: {
        friendId: req.user.id,
        friendUsername: user.username
      },
      createdAt: new Date()
    });

    await user.save();
    await requestingUser.save();

    res.status(200).json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('[Accept Friend Request Error]:', error);
    res.status(500).json({ message: 'Server error accepting friend request' });
  }
});

// Decline friend request
router.post('/decline-friend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`User ${req.user.id} is declining friend request from ${userId}`);

    // Get the user
    const user = await User.findById(req.user.id);

    // Remove from received requests - filter out the userId
    user.friendRequests.received = user.friendRequests.received.filter(id =>
      id.toString() !== userId.toString()
    );

    await user.save();

    // Remove from sent requests for the other user
    const requestingUser = await User.findById(userId);
    if (requestingUser) {
      requestingUser.friendRequests.sent = requestingUser.friendRequests.sent.filter(id =>
        id.toString() !== req.user.id.toString()
      );
      await requestingUser.save();
    }

    res.status(200).json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('[Decline Friend Request Error]:', error);
    res.status(500).json({ message: 'Server error declining friend request' });
  }
});

// Remove friend
router.delete('/friend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`User ${req.user.id} is removing friend ${userId}`);

    // Get the user
    const user = await User.findById(req.user.id);

    // Remove from friends list - filter out the userId
    user.friends = user.friends.filter(id => id.toString() !== userId.toString());
    await user.save();

    // Also remove from the other user's friends list
    const friend = await User.findById(userId);
    if (friend) {
      friend.friends = friend.friends.filter(id => id.toString() !== req.user.id.toString());
      await friend.save();
    }

    res.status(200).json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('[Remove Friend Error]:', error);
    res.status(500).json({ message: 'Server error removing friend' });
  }
});

// Update current location for real-time tracking
router.post('/update-location', authMiddleware, async (req, res) => {
  try {
    const { coordinates, isSharing } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ message: 'Invalid coordinates format' });
    }

    const [longitude, latitude] = coordinates;

    // Update user's current location
    const user = await User.findById(req.user.id);

    // Initialize currentLocation if it doesn't exist
    if (!user.currentLocation) {
      user.currentLocation = {
        type: 'Point',
        coordinates: [0, 0],
        lastUpdated: new Date(),
        isSharing: false
      };
    }

    user.currentLocation.type = 'Point';
    user.currentLocation.coordinates = [longitude, latitude];
    user.currentLocation.lastUpdated = new Date();

    // Only update isSharing if it was provided
    if (isSharing !== undefined) {
      user.currentLocation.isSharing = isSharing;
    }

    await user.save();

    res.status(200).json({
      message: 'Location updated successfully',
      isSharing: user.currentLocation.isSharing
    });
  } catch (error) {
    console.error('[Update Location Error]:', error);
    res.status(500).json({ message: 'Server error updating location' });
  }
});

// Toggle location sharing
router.post('/toggle-location-sharing', authMiddleware, async (req, res) => {
  try {
    const { isSharing } = req.body;

    if (isSharing === undefined) {
      return res.status(400).json({ message: 'isSharing parameter is required' });
    }

    // Update user's location sharing preference
    const user = await User.findById(req.user.id);

    // Initialize currentLocation if it doesn't exist
    if (!user.currentLocation) {
      user.currentLocation = {
        type: 'Point',
        coordinates: [0, 0],
        lastUpdated: new Date(),
        isSharing: !!isSharing
      };
    } else {
      user.currentLocation.isSharing = !!isSharing;
    }

    await user.save();

    res.status(200).json({
      message: `Location sharing ${isSharing ? 'enabled' : 'disabled'}`,
      isSharing: user.currentLocation.isSharing
    });
  } catch (error) {
    console.error('[Toggle Location Sharing Error]:', error);
    res.status(500).json({ message: 'Server error toggling location sharing' });
  }
});

// Get user's activity feed
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    console.log(`Getting activity feed for user: ${req.user.id}`);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get own activities
    const userActivities = user.activity || [];

    // Get all activities with user information
    userActivities.forEach(activity => {
      activity.user = {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar
      };
    });

    // Get friends' activities
    let friendActivities = [];

    if (global.USE_MOCK_DB) {
      // For mock DB, manually fetch each friend's activities
      if (user.friends && user.friends.length > 0) {
        const friends = await Promise.all(
          user.friends.map(friendId => User.findById(friendId))
        );

        // Filter out any null values (friends that weren't found)
        const validFriends = friends.filter(f => f !== null);

        validFriends.forEach(friend => {
          if (friend.activity && friend.activity.length > 0) {
            // Add friend info to each activity
            const friendActs = friend.activity.map(act => ({
              ...act,
              user: {
                id: friend._id,
                username: friend.username,
                fullName: friend.fullName,
                avatar: friend.avatar
              }
            }));
            friendActivities = friendActivities.concat(friendActs);
          }
        });
      }
    } else {
      // For real MongoDB, use find with $in operator
      const friends = await User.find({ _id: { $in: user.friends } });

      friends.forEach(friend => {
        if (friend.activity && friend.activity.length > 0) {
          // Add friend info to each activity
          const friendActs = friend.activity.map(act => ({
            ...act.toObject(),
            user: {
              id: friend._id,
              username: friend.username,
              fullName: friend.fullName,
              avatar: friend.avatar
            }
          }));
          friendActivities = friendActivities.concat(friendActs);
        }
      });
    }

    // Combine and sort by date (newest first)
    const allActivities = [...userActivities, ...friendActivities]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, 50); // Limit to 50 activities

    res.json(allActivities);
  } catch (error) {
    console.error('[Get Activity Feed Error]:', error);
    res.status(500).json({ message: 'Server error getting activity feed' });
  }
});

// Get nearby users
router.get('/nearby-users', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has current location
    if (!user.currentLocation || !user.currentLocation.coordinates ||
        (user.currentLocation.coordinates[0] === 0 && user.currentLocation.coordinates[1] === 0)) {
      return res.status(400).json({ message: 'Your location is not available. Please update your location first.' });
    }

    const maxDistance = req.query.distance ? parseInt(req.query.distance) : 5000; // default 5km

    let nearbyUsers = [];

    if (global.USE_MOCK_DB) {
      // For mock DB, manually filter users that are sharing their location
      const allUsers = await User.find();

      // Filter by location sharing enabled and not the current user
      nearbyUsers = allUsers.filter(u =>
        u._id.toString() !== req.user.id.toString() &&
        u.currentLocation &&
        u.currentLocation.isSharing &&
        u.currentLocation.coordinates
      );

      // Filter by distance (simplified computation for mock DB)
      nearbyUsers = nearbyUsers.filter(u => {
        // Calculate rough distance (approximate for demo purposes)
        const [lon1, lat1] = user.currentLocation.coordinates;
        const [lon2, lat2] = u.currentLocation.coordinates;

        // Very basic distance calculation (this is not accurate but works for demo)
        const roughDistance = Math.sqrt(
          Math.pow((lon2 - lon1) * 111000 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180), 2) +
          Math.pow((lat2 - lat1) * 111000, 2)
        );

        return roughDistance <= maxDistance;
      });

      // Select only necessary fields
      nearbyUsers = nearbyUsers.map(u => ({
        _id: u._id,
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
        currentLocation: {
          coordinates: u.currentLocation.coordinates,
          lastUpdated: u.currentLocation.lastUpdated
        }
      }));
    } else {
      // For real MongoDB, use geospatial query
      nearbyUsers = await User.find({
        _id: { $ne: req.user.id }, // Exclude self
        'currentLocation.isSharing': true,
        'currentLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: user.currentLocation.coordinates
            },
            $maxDistance: maxDistance
          }
        }
      }).select('username fullName avatar currentLocation');
    }

    res.json(nearbyUsers);
  } catch (error) {
    console.error('[Get Nearby Users Error]:', error);
    res.status(500).json({ message: 'Server error finding nearby users' });
  }
});

// Get all friends' locations that are being shared
router.get('/friends/locations', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let friendLocations = [];

    if (global.USE_MOCK_DB) {
      // For mock DB, manually fetch each friend
      if (user.friends && user.friends.length > 0) {
        const friends = await Promise.all(
          user.friends.map(friendId => User.findById(friendId))
        );

        // Filter friends who are sharing their location
        const sharingFriends = friends.filter(friend =>
          friend &&
          friend.currentLocation &&
          friend.currentLocation.isSharing &&
          friend.currentLocation.coordinates &&
          (friend.currentLocation.coordinates[0] !== 0 || friend.currentLocation.coordinates[1] !== 0)
        );

        // Format the response
        friendLocations = sharingFriends.map(friend => ({
          userId: friend._id,
          username: friend.username,
          fullName: friend.fullName || '',
          avatar: friend.avatar || 'images/default-avatar.svg',
          coordinates: friend.currentLocation.coordinates,
          lastUpdated: friend.currentLocation.lastUpdated
        }));
      }
    } else {
      // For real MongoDB, use populate with match filter
      const populatedUser = await User.findById(req.user.id)
        .populate({
          path: 'friends',
          select: 'username fullName avatar currentLocation',
          match: { 'currentLocation.isSharing': true }
        });

      if (populatedUser && populatedUser.friends) {
        // Filter friends who are sharing their location with valid coordinates
        const sharingFriends = populatedUser.friends.filter(friend =>
          friend.currentLocation &&
          friend.currentLocation.isSharing &&
          friend.currentLocation.coordinates &&
          (friend.currentLocation.coordinates[0] !== 0 || friend.currentLocation.coordinates[1] !== 0)
        );

        // Format the response
        friendLocations = sharingFriends.map(friend => ({
          userId: friend._id,
          username: friend.username,
          fullName: friend.fullName || '',
          avatar: friend.avatar || 'images/default-avatar.svg',
          coordinates: friend.currentLocation.coordinates,
          lastUpdated: friend.currentLocation.lastUpdated
        }));
      }
    }

    res.json(friendLocations);
  } catch (error) {
    console.error('[Get Friends Locations Error]:', error);
    res.status(500).json({ message: 'Server error getting friends locations' });
  }
});

// Get a specific friend's location
router.get('/friend/:friendId/location', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;

    // Get the current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the requested user is a friend
    const isFriend = user.friends.some(id => id.toString() === friendId.toString());
    if (!isFriend) {
      return res.status(403).json({ message: 'Not authorized to view this user\'s location' });
    }

    // Get friend's info
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ message: 'Friend not found' });
    }

    // Only return location if friend is sharing
    const locationInfo = friend.currentLocation && friend.currentLocation.isSharing
      ? friend.currentLocation
      : null;

    res.json({
      userId: friend._id,
      username: friend.username,
      fullName: friend.fullName || '',
      avatar: friend.avatar || 'images/default-avatar.svg',
      location: locationInfo
    });
  } catch (error) {
    console.error('[Get Friend Location Error]:', error);
    res.status(500).json({ message: 'Server error getting friend location' });
  }
});

// Якщо включений мок-режим, додаємо додаткові тестові роути
if (global.USE_MOCK_DB) {
  // Роут для отримання всіх тестових користувачів
  router.get('/test-users', authMiddleware, async (req, res) => {
    try {
      console.log('Getting test users...');

      // Отримати всіх користувачів
      const users = await User.find();

      console.log(`Found ${users.length} test users`);

      // Відправка списку користувачів (без чутливих даних)
      const safeUsers = users.map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || '',
        bio: user.bio || '',
        avatar: user.avatar || 'images/default-avatar.svg',
        roles: user.roles || ['USER']
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('[Test Users Error]:', error);
      res.status(500).json({ message: 'Server error getting test users' });
    }
  });

  // Роут для входу як тестовий користувач
  router.post('/test-login/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // Перевірити, чи існує користувач
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'Test user not found' });
      }

      // Створити JWT токен для користувача
      const token = jwt.sign(
        { id: user._id, username: user.username, roles: user.roles || ['USER'] },
        config.secret,
        { expiresIn: '24h' }
      );

      // Відправити відповідь з токеном та даними користувача
      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName || '',
          avatar: user.avatar || 'images/default-avatar.svg',
          roles: user.roles || ['USER']
        }
      });
    } catch (error) {
      console.error('[Test Login Error]:', error);
      res.status(500).json({ message: 'Server error during test login' });
    }
  });
}

module.exports = router;
