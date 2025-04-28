const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const http = require('http');
const postRouter = require('./postRouter');
const Post = require('./Post');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { secret, port: PORT, databaseURL, corsOrigins } = config;

// Підключаємо обмежувачі запитів
const { loginRateLimiter, apiRateLimiter } = require('./middleware/rateLimiter');

// Import custom routers
const authRouter = require('./authRouter');
const oauthRouter = require('./oauthRouter');
const socialRouter = require('./socialRouter');
const messageRouter = require('./messageRouter');
const profileRouter = require('./profileRouter');
const twoFactorRouter = require('./twoFactorRouter');
const notificationRouter = require('./notificationRouter');
const locationRouter = require('./locationRouter');
const achievementRouter = require('./achievementRouter');
const friendGroupRouter = require('./friendGroupRouter');
const privacyRouter = require('./privacyRouter');
const socialEnhancementsRouter = require('./social-enhancements');

// Use mock database flag - set to true for local development without MongoDB
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true' || config.useMockDb || true; // Force mock data for now

// Make USE_MOCK_DB available globally
global.USE_MOCK_DB = USE_MOCK_DB;

// Function to check user achievements globally
global.checkAchievements = async (userId, achievementId) => {
    try {
        if (!userId) return false;

        const Achievement = mongoose.model('Achievement');

        if (achievementId) {
            // Check specific achievement
            return await Achievement.checkCriteria(userId, achievementId);
        } else {
            // Check all achievements
            return await Achievement.checkAllForUser(userId);
        }
    } catch (error) {
        console.error('Error checking achievements:', error);
        return false;
    }
};

// Create express app
const app = express();
const server = http.createServer(app);

// Configure CORS for deployment
const allowedOrigins = corsOrigins; // Updated to use corsOrigins

// Setup socketIO with proper CORS for deployment
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store online users
const onlineUsers = new Map();
// Store users who are sharing their location in real-time
const locationSharingUsers = new Map();

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const decoded = jwt.verify(token, secret);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  socket.on('newPost', async (data) => {
  try {
    const post = new Post({ author: data.author, content: data.content });
    await post.save();
    io.emit('newPost', post);
  } catch (e) {
    console.error('Помилка створення поста:', e);
  }
});

socket.on('likePost', async (postId) => {
  try {
    const post = await Post.findById(postId);
    if (post) {
      post.likes += 1;
      await post.save();
      io.emit('postLiked', { postId: post._id, likes: post.likes });
    }
  } catch (e) {
    console.error('Помилка лайку поста:', e);
  }
});

  console.log(`User connected: ${socket.userId} (${socket.username})`);

  // Add user to online users
  onlineUsers.set(socket.userId, socket.id);

  // Broadcast user online status
  io.emit('user_status', {
    userId: socket.userId,
    status: 'online',
    onlineUsers: Array.from(onlineUsers.keys())
  });

  // Join user to their private notification channel
  socket.join(`user:${socket.userId}:notifications`);

  // Handle private messages
  socket.on('private_message', async (data) => {
    try {
      const { recipientId, content } = data;

      // Validate content
      if (!content.trim()) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      // Get sender from socket
      const senderId = socket.userId;

      // Create message in database using the Message model
      const Message = mongoose.model('Message');
      const User = mongoose.model('User');
      const Conversation = mongoose.model('Conversation');

      // Find the recipient
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        socket.emit('error', { message: 'Recipient not found' });
        return;
      }

      // Create message document
      const message = new Message({
        sender: senderId,
        recipient: recipientId,
        content,
        read: false,
        createdAt: new Date()
      });

      await message.save();

      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] }
      });

      if (!conversation) {
        // Create a new conversation
        conversation = new Conversation({
          participants: [senderId, recipientId],
          lastMessage: message._id,
          unreadCount: new Map([[recipientId, 1]])
        });
      } else {
        // Update existing conversation
        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();

        // Increment unread count for recipient
        if (!conversation.unreadCount) {
          conversation.unreadCount = new Map();
        }

        const currentCount = conversation.unreadCount.get(recipientId) || 0;
        conversation.unreadCount.set(recipientId, currentCount + 1);
      }

      await conversation.save();

      // Get populated message to send
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar fullName')
        .populate('recipient', 'username avatar fullName');

      // Send to recipient if they're online
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('private_message', populatedMessage);

        // Also emit conversation update
        io.to(recipientSocketId).emit('conversation_update', {
          conversationId: conversation._id,
          lastMessage: populatedMessage,
          unreadCount: conversation.unreadCount.get(recipientId) || 0
        });
      }

      // Send back to sender for confirmation
      socket.emit('message_sent', populatedMessage);

      // Also emit conversation update to sender
      socket.emit('conversation_update', {
        conversationId: conversation._id,
        lastMessage: populatedMessage,
        unreadCount: 0 // Always 0 for sender
      });
    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', data => {
    const { recipientId, isTyping } = data;

    // Send typing status to recipient if online
    const recipientSocketId = onlineUsers.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: socket.userId,
        isTyping
      });
    }
  });

  // Handle read receipts
  socket.on('message_read', async (data) => {
    // ... existing read receipt code ...
  });

  // Handle notification acknowledgment
  socket.on('notification_read', async (data) => {
    try {
      const { notificationId } = data;

      if (!notificationId) {
        socket.emit('error', { message: 'Notification ID is required' });
        return;
      }

      // Get the notification
      const Notification = mongoose.model('Notification');
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: socket.userId
      });

      if (!notification) {
        socket.emit('error', { message: 'Notification not found' });
        return;
      }

      // Mark as read
      await notification.markAsRead();

      // Send acknowledgment
      socket.emit('notification_read_ack', {
        notificationId,
        success: true
      });

      // Get updated unread count
      const User = mongoose.model('User');
      const user = await User.findById(socket.userId);

      // Send updated unread count
      socket.emit('unread_notifications_count', {
        count: user.unreadNotifications || 0
      });

    } catch (error) {
      console.error('Error handling notification read:', error);
      socket.emit('error', { message: 'Error marking notification as read' });
    }
  });

  // Get notifications
  socket.on('get_notifications', async (data) => {
    try {
      const { page = 1, limit = 10, unreadOnly = false } = data || {};

      // Get the notifications
      const Notification = mongoose.model('Notification');
      const query = { recipient: socket.userId };

      if (unreadOnly) {
        query.read = false;
      }

      // Get total count
      const total = await Notification.countDocuments(query);

      // Get notifications with pagination
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sender', 'username fullName avatar')
        .lean();

      // Send notifications to the client
      socket.emit('notifications', {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error getting notifications:', error);
      socket.emit('error', { message: 'Error getting notifications' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);

    // Remove from online users
    onlineUsers.delete(socket.userId);

    // Remove from location sharing users
    locationSharingUsers.delete(socket.userId);

    // Broadcast user offline status
    io.emit('user_status', {
      userId: socket.userId,
      status: 'offline',
      onlineUsers: Array.from(onlineUsers.keys())
    });
  });
});
app.use('/api/posts', postRouter);

// Add middleware to ensure all API responses are JSON
app.use((req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
        this.setHeader('Content-Type', 'application/json');
        return originalJson.call(this, data);
    };

    next();
});

// Setup CORS middleware for deployment
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['set-cookie']
}));

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies
app.use(express.json());

// Apply rate limiting middleware
// Загальне обмеження API запитів - 100 запитів за 15 хвилин
app.use(apiRateLimiter(100, 15 * 60 * 1000));
// Обмеження спроб входу - 5 спроб за 15 хвилин з блокуванням на 30 хвилин
app.use('/auth/login', loginRateLimiter(5, 15 * 60 * 1000, 30 * 60 * 1000));

// File upload middleware - modified to be less verbose and more permissive
app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    abortOnLimit: true,
    useTempFiles: false, // Change to false to avoid temp file issues
    debug: false, // Disable debug mode to reduce console noise
    safeFileNames: true, // Sanitize file names
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create a folder for avatar uploads if it doesn't exist
const avatarDir = path.join(__dirname, 'public', 'images', 'avatars');
if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
    console.log('Created avatars directory at:', avatarDir);
}

// Create a folder for location uploads if it doesn't exist
const locationsDir = path.join(__dirname, 'public', 'images', 'locations');
if (!fs.existsSync(locationsDir)) {
    fs.mkdirSync(locationsDir, { recursive: true });
    console.log('Created locations directory at:', locationsDir);
}

// Mock data for in-memory mode
if (USE_MOCK_DB) {
    console.log('📝 Using in-memory mock data instead of MongoDB');

    // In-memory storage
    const mockUsers = [];
    const mockRoles = [{ value: 'USER' }, { value: 'ADMIN' }];

    // Mock models for User and Role
    app.locals.mockModels = {
        User: {
            findOne: async (query) => {
                if (query._id) {
                    return mockUsers.find(u => u._id.toString() === query._id.toString());
                }
                if (query.username) {
                    return mockUsers.find(u => u.username === query.username);
                }
                if (query.email) {
                    return mockUsers.find(u => u.email === query.email);
                }
                if (query.participants) {
                    // For conversations
                    return mockUsers.filter(u =>
                        query.participants.$all.every(id => u.participants?.includes(id))
                    )[0];
                }
                return null;
            },
            findById: async (id) => {
                return mockUsers.find(u => u._id.toString() === id.toString());
            },
            find: async (query = {}) => {
                if (!query) return mockUsers;

                // Handle various query types
                if (query._id) {
                    // Handle $in operator
                    if (query._id.$in) {
                        return mockUsers.filter(u =>
                            query._id.$in.includes(u._id.toString())
                        );
                    }
                    // Handle $ne operator (not equal)
                    if (query._id.$ne) {
                        return mockUsers.filter(u =>
                            u._id.toString() !== query._id.$ne
                        );
                    }
                    return mockUsers.filter(u => u._id.toString() === query._id.toString());
                }

                // Handle $or queries
                if (query.$or) {
                    return mockUsers.filter(u => {
                        return query.$or.some(condition => {
                            const key = Object.keys(condition)[0];
                            const value = condition[key];

                            // Handle regex
                            if (value.$regex) {
                                const regex = new RegExp(value.$regex, value.$options || '');
                                return regex.test(u[key]);
                            }

                            return u[key] === value;
                        });
                    });
                }

                // Handle location search (simplified)
                if (query['currentLocation.isSharing'] === true &&
                    query['currentLocation.coordinates'] &&
                    query['currentLocation.coordinates'].$near) {

                    // For mock purposes, just return all users that are sharing location
                    // except the user making the query
                    const excludeId = query._id && query._id.$ne;
                    return mockUsers.filter(u =>
                        u.currentLocation &&
                        u.currentLocation.isSharing === true &&
                        (!excludeId || u._id.toString() !== excludeId)
                    );
                }

                // Default - filter by all conditions
                return mockUsers.filter(u => {
                    for (const key in query) {
                        // Skip complex conditions we've already handled
                        if (key === '$or' || key === 'currentLocation.isSharing' ||
                            key === 'currentLocation.coordinates') {
                            continue;
                        }

                        // Handle nested properties (e.g., 'currentLocation.isSharing')
                        if (key.includes('.')) {
                            const parts = key.split('.');
                            let value = u;
                            for (const part of parts) {
                                if (!value || value[part] === undefined) {
                                    return false;
                                }
                                value = value[part];
                            }
                            if (value !== query[key]) {
                                return false;
                            }
                        }
                        // Handle normal properties
                        else if (u[key] !== query[key]) {
                            return false;
                        }
                    }
                    return true;
                });
            },
            create: async (userData) => {
                const newUser = {
                    ...userData,
                    _id: Date.now().toString(),
                    save: async function() {
                        const index = mockUsers.findIndex(u => u._id === this._id);
                        if (index !== -1) {
                            mockUsers[index] = { ...this };
                        }
                        return this;
                    }
                };
                mockUsers.push(newUser);
                return newUser;
            }
        },
        Role: {
            findOne: async (query) => {
                return mockRoles.find(r => r.value === query.value);
            },
            create: async (roleData) => {
                const newRole = { ...roleData };
                mockRoles.push(newRole);
                return newRole;
            }
        }
    };

    // Monkey patch mongoose models
    mongoose.model = function(modelName) {
        return app.locals.mockModels[modelName];
    };

    // Create test users for demonstration
    try {
        const bcrypt = require('bcryptjs');
        const hashPassword = bcrypt.hashSync('password123', 7);

        // Create 5 test users with various attributes for full testing
        const testUsers = [
            {
                _id: '123456789',
                username: 'testuser',
                email: 'test@example.com',
                password: hashPassword,
                avatar: 'images/default-avatar.svg',
                fullName: 'Test User',
                bio: 'This is a test user for the Era platform.',
                roles: ['USER'],
                currentLocation: {
                    type: 'Point',
                    coordinates: [30.5234, 50.4501], // Kyiv
                    lastUpdated: new Date(),
                    isSharing: true
                }
            },
            {
                _id: '987654321',
                username: 'testfriend',
                email: 'friend@example.com',
                password: hashPassword,
                avatar: 'images/default-avatar.svg',
                fullName: 'Test Friend',
                bio: 'Friend account for testing social features',
                roles: ['USER'],
                currentLocation: {
                    type: 'Point',
                    coordinates: [30.5334, 50.4601], // Near Kyiv
                    lastUpdated: new Date(),
                    isSharing: true
                }
            },
            {
                _id: '111222333',
                username: 'alex_smith',
                email: 'alex@example.com',
                password: hashPassword,
                avatar: 'images/avatars/github-avatar.svg',
                fullName: 'Alex Smith',
                bio: 'Software engineer and traveler',
                roles: ['USER'],
                currentLocation: {
                    type: 'Point',
                    coordinates: [30.5434, 50.4701], // Different location near Kyiv
                    lastUpdated: new Date(),
                    isSharing: true
                }
            },
            {
                _id: '444555666',
                username: 'maria_jones',
                email: 'maria@example.com',
                password: hashPassword,
                avatar: 'images/avatars/twitter-avatar.svg',
                fullName: 'Maria Jones',
                bio: 'Photographer and nature lover',
                roles: ['USER'],
                currentLocation: {
                    type: 'Point',
                    coordinates: [30.5134, 50.4401], // Another location near Kyiv
                    lastUpdated: new Date(),
                    isSharing: false
                }
            },
            {
                _id: '777888999',
                username: 'john_doe',
                email: 'john@example.com',
                password: hashPassword,
                avatar: 'images/avatars/facebook-avatar.svg',
                fullName: 'John Doe',
                bio: 'Tech enthusiast and gamer',
                roles: ['USER'],
                currentLocation: {
                    type: 'Point',
                    coordinates: [30.5634, 50.4801], // Yet another location near Kyiv
                    lastUpdated: new Date(),
                    isSharing: true
                }
            }
        ];

        // Initialize each user with empty arrays for social properties
        testUsers.forEach(user => {
            user.friends = [];
            user.friendRequests = { sent: [], received: [] };
            user.activity = [];

            // Add save method to user objects
            user.save = async function() {
                const index = mockUsers.findIndex(u => u._id === this._id);
                if (index !== -1) {
                    mockUsers[index] = { ...this };
                }
                return this;
            };

            // Add user to mock database
            mockUsers.push(user);
        });

        // Set up friend relationships:
        // 1. testuser and testfriend are already friends
        mockUsers[0].friends.push(mockUsers[1]._id);
        mockUsers[1].friends.push(mockUsers[0]._id);

        // Add activity for this friendship
        mockUsers[0].activity.push({
            type: 'FRIEND_ADDED',
            data: {
                friendId: mockUsers[1]._id,
                friendUsername: mockUsers[1].username
            },
            createdAt: new Date(Date.now() - 86400000) // 1 day ago
        });

        // 2. testuser and alex_smith are already friends
        mockUsers[0].friends.push(mockUsers[2]._id);
        mockUsers[2].friends.push(mockUsers[0]._id);

        // Add activity for this friendship
        mockUsers[0].activity.push({
            type: 'FRIEND_ADDED',
            data: {
                friendId: mockUsers[2]._id,
                friendUsername: mockUsers[2].username
            },
            createdAt: new Date(Date.now() - 172800000) // 2 days ago
        });

        // 3. maria_jones sent a friend request to testuser
        mockUsers[3].friendRequests.sent.push(mockUsers[0]._id);
        mockUsers[0].friendRequests.received.push(mockUsers[3]._id);

        // 4. testuser sent a friend request to john_doe
        mockUsers[0].friendRequests.sent.push(mockUsers[4]._id);
        mockUsers[4].friendRequests.received.push(mockUsers[0]._id);

        // 5. testfriend and alex_smith are already friends
        mockUsers[1].friends.push(mockUsers[2]._id);
        mockUsers[2].friends.push(mockUsers[1]._id);

        // Add some activity data
        mockUsers[0].activity.push({
            type: 'PROFILE_UPDATED',
            data: {},
            createdAt: new Date(Date.now() - 43200000) // 12 hours ago
        });

        mockUsers[1].activity.push({
            type: 'LOCATION_ADDED',
            data: {
                name: 'Awesome Cafe'
            },
            createdAt: new Date(Date.now() - 7200000) // 2 hours ago
        });

        mockUsers[2].activity.push({
            type: 'LOCATION_LIKED',
            data: {
                name: 'Central Park'
            },
            createdAt: new Date(Date.now() - 3600000) // 1 hour ago
        });

        console.log('✅ 5 test users created successfully with friend relationships');
        console.log('✅ Test user credentials: testuser / password123');
    } catch (error) {
        console.error('Error creating test users:', error);
    }
}

// Function to send real-time notification to a user
async function sendNotification(userId, notification) {
  try {
    // Create notification in database
    const Notification = mongoose.model('Notification');
    const savedNotification = await Notification.createNotification({
      ...notification,
      recipient: userId
    });

    // Get socket ID for the user if they're online
    const socketId = onlineUsers.get(userId);

    if (socketId) {
      // User is online, send notification via Socket.IO
      io.to(socketId).emit('notification', {
        ...savedNotification.toObject(),
        isRealTime: true
      });

      // Also send updated unread count
      const User = mongoose.model('User');
      const user = await User.findById(userId);

      io.to(socketId).emit('unread_notifications_count', {
        count: user.unreadNotifications || 0
      });
    }

    return savedNotification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// Export sendNotification for use in other modules
global.sendNotification = sendNotification;

// Debug endpoint to verify API functionality
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        mockDb: USE_MOCK_DB,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Додаємо маршрут для перевірки статусу сервера
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'ok',
      mockDbEnabled: global.USE_MOCK_DB === true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Server error during health check'
    });
  }
});

// Додаємо тестовий API endpoint
app.get('/api/test', (req, res) => {
  const testData = {
    message: 'API is working',
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  res.json(testData);
});

// Use routers
app.use('/auth', authRouter);
app.use('/oauth', oauthRouter);
app.use('/social', socialRouter);
app.use('/social-extended', socialEnhancementsRouter);
app.use('/messages', messageRouter);
app.use('/profile', profileRouter);
app.use('/2fa', twoFactorRouter);
app.use('/notifications', notificationRouter);
app.use('/location', locationRouter); // Corrected to 'location'
app.use('/achievements', achievementRouter);
app.use('/friend-groups', friendGroupRouter);
app.use('/privacy', privacyRouter);

// Root route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Redirect /login to /auth.html for convenience
app.get('/login', (req, res) => {
    res.redirect('/auth.html');
});

// Error handler for undefined routes
app.use((req, res, next) => {
    // Check if it's an API request
    if (req.path.startsWith('/auth/') || req.path.startsWith('/profile/') || req.path.startsWith('/api/')) {
        return res.status(404).json({
            status: 'error',
            message: 'API endpoint not found',
            path: req.path
        });
    }

    // Check if it's for a static file that exists
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }

    // If it's a known HTML path, serve the corresponding HTML file
    if (req.path.endsWith('.html') || req.path === '/profile' || req.path === '/auth' ||
        req.path === '/social' || req.path === '/map' || req.path === '/chats') {
        const htmlFile = req.path.endsWith('.html')
            ? req.path
            : `${req.path.replace(/\/$/, '')}.html`;

        if (fs.existsSync(path.join(__dirname, 'public', htmlFile))) {
            return res.sendFile(path.join(__dirname, 'public', htmlFile));
        }
    }

    // Default to index.html for client-side routing
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);

    // Always return JSON for API routes
    if (req.path.startsWith('/auth') || req.path.startsWith('/profile') || req.path.startsWith('/api')) {
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'production' ? undefined : err.message,
            path: req.path
        });
    }

    // For other routes, show error page
    res.status(500).send(`
        <html>
            <head>
                <title>Server Error</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                    h1 { color: #e74c3c; }
                    .error-container { max-width: 800px; margin: 0 auto; background: #f8f9fa; padding: 20px; border-radius: 5px; }
                    .back-link { display: inline-block; margin-top: 20px; color: #3498db; text-decoration: none; }
                    .back-link:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>Server Error</h1>
                    <p>Sorry, something went wrong on our end. Please try again later.</p>
                    <a href="/" class="back-link">← Back to Home</a>
                </div>
            </body>
        </html>
    `);
});

// Start server only if running directly (not via require)
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`✅ Server started on port ${PORT}`);
        console.log(`✅ Access the application at http://localhost:${PORT}`);
        console.log(`✅ WebSocket server is active`);

        // Connect to MongoDB if mock mode is not enabled
        if (!USE_MOCK_DB) {
            console.log(`Attempting to connect to MongoDB at: ${config.dbUrl.replace(/([^:]+):([^@]+)@/, '***:***@')}`);

            mongoose.connect(config.dbUrl, config.dbOptions)
                .then(async () => {
                    console.log('✅ Connected to MongoDB Atlas');

                    // Initialize roles if in development mode
                    if (process.env.NODE_ENV !== 'production') {
                        try {
                            const initRoles = require('./initRoles');
                            await initRoles();

                            // Also initialize achievements
                            const initAchievements = require('./initAchievements');
                            await initAchievements();
                        } catch (err) {
                            console.error('❌ Error initializing data:', err);
                        }
                    }
                })
                .catch(err => {
                    console.error('❌ MongoDB connection error:', err);
                    console.log('⚠️ Proceeding with mock data as fallback');
                    // Set USE_MOCK_DB to true as a fallback
                    global.USE_MOCK_DB = true;
                });
        } else {
            console.log('✅ Using mock data instead of MongoDB');

            // Initialize test achievements in mock mode
            setTimeout(() => {
                try {
                    const initAchievements = require('./initAchievements');
                    initAchievements();
                } catch (error) {
                    console.error('❌ Error initializing achievements in mock mode:', error);
                }
            }, 2000);
        }
    });
}

// Export app for serverless functions
module.exports = app;
