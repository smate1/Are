const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/authMiddleware');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs'); // Added bcrypt for password hashing

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        console.log('Profile request for user ID:', req.user.id);

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: 'Unauthorized request',
                redirect: '/auth.html'
            });
        }

        // Check if we're in mock mode
        if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true' || global.USE_MOCK_DB) {
            console.log('Using mock mode for profile');

            // In mock mode, return test user data directly if the ID matches our test user
            if (req.user.id === '123456789') {
                return res.json({
                    id: '123456789',
                    username: 'testuser',
                    email: 'test@example.com',
                    avatar: 'images/default-avatar.svg',
                    roles: ['USER'],
                    fullName: 'Test User',
                    bio: 'This is a test user account for the Era platform.',
                    location: 'Test City',
                    interests: ['travel', 'photography', 'technology'],
                    website: 'https://example.com',
                    socialLinks: {
                        facebook: 'https://facebook.com/testuser',
                        twitter: 'https://twitter.com/testuser',
                        instagram: 'https://instagram.com/testuser',
                        linkedin: 'https://linkedin.com/in/testuser'
                    },
                    createdAt: new Date().toISOString()
                });
            }
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                redirect: '/auth.html'
            });
        }

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            roles: user.roles,
            fullName: user.fullName || '',
            bio: user.bio || '',
            location: user.location || '',
            interests: user.interests || [],
            website: user.website || '',
            socialLinks: user.socialLinks || {
                facebook: '',
                twitter: '',
                instagram: '',
                linkedin: ''
            },
            createdAt: user.createdAt,
            languagePreference: user.languagePreference || 'en' // Added language preference
        });
    } catch (e) {
        console.error('[Profile Error]:', e.message);
        res.status(500).json({ message: 'Server error retrieving profile' });
    }
});

// Update user avatar
router.post('/update-avatar', authMiddleware, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        // Debug request data
        console.log('Avatar update request received');
        console.log('Files in request:', req.files ? Object.keys(req.files) : 'No files');
        console.log('Request content type:', req.headers['content-type']);

        // Check if there's a file in the request
        if (!req.files || !req.files.avatar) {
            return res.status(400).json({ message: 'Файл не завантажено' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        const avatarFile = req.files.avatar;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(avatarFile.mimetype)) {
            return res.status(400).json({ message: 'Непідтримуваний формат файлу. Дозволені: JPEG, PNG, GIF, WEBP' });
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (avatarFile.size > maxSize) {
            return res.status(400).json({ message: 'Розмір файлу перевищує 5MB' });
        }

        // Set up file path and name
        const uploadDir = path.join(__dirname, 'public', 'images', 'avatars');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Delete previous avatar if it exists and is not the default
        if (user.avatar && user.avatar !== 'default-avatar.svg' && !user.avatar.startsWith('http')) {
            try {
                const prevAvatarPath = path.join(__dirname, 'public', user.avatar);
                if (fs.existsSync(prevAvatarPath)) {
                    fs.unlinkSync(prevAvatarPath);
                }
            } catch (error) {
                console.error('Error deleting previous avatar:', error);
                // Continue even if delete fails
            }
        }

        // Generate unique filename
        const fileExt = path.extname(avatarFile.name).toLowerCase();
        const fileName = `avatar-${uuidv4()}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        // Save file using mv method if available, or write file directly as fallback
        try {
            if (typeof avatarFile.mv === 'function') {
                await avatarFile.mv(filePath);
            } else {
                // Fallback method if mv is not available
                fs.writeFileSync(filePath, avatarFile.data);
            }
            console.log(`Avatar saved to: ${filePath}`);
        } catch (error) {
            console.error('Error saving avatar file:', error);
            return res.status(500).json({ message: 'Помилка при збереженні файлу' });
        }

        // Update user avatar in database
        const avatarRelativePath = `images/avatars/${fileName}`;
        user.avatar = avatarRelativePath;
        await user.save();

        res.json({
            message: 'Аватар успішно оновлено',
            avatarUrl: avatarRelativePath
        });
    } catch (error) {
        console.error('[Avatar Update Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при оновленні аватара' });
    }
});

// Update user profile
router.post('/update', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            fullName,
            bio,
            location,
            interests,
            themePreference,
            languagePreference,
            shareLocation,
            showOnlineStatus,
            publicProfile
        } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields
        if (fullName !== undefined) user.fullName = fullName;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;
        if (interests !== undefined) user.interests = interests;
        if (themePreference !== undefined) user.themePreference = themePreference;
        if (languagePreference !== undefined) user.languagePreference = languagePreference;

        // Privacy settings
        if (shareLocation !== undefined) {
            user.currentLocation.isSharing = shareLocation;
        }
        if (showOnlineStatus !== undefined) user.showOnlineStatus = showOnlineStatus;
        if (publicProfile !== undefined) user.publicProfile = publicProfile;

        // Save user
        await user.save();

        // Return updated user without sensitive data
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                bio: user.bio,
                location: user.location,
                interests: user.interests,
                themePreference: user.themePreference,
                languagePreference: user.languagePreference,
                avatar: user.avatar,
                shareLocation: user.currentLocation.isSharing,
                showOnlineStatus: user.showOnlineStatus,
                publicProfile: user.publicProfile
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashPassword;

        // Save user
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Failed to change password', error: error.message });
    }
});

// Update user profile
router.put('/update', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        const {
            username,
            email,
            fullName,
            bio,
            location,
            interests,
            website,
            socialLinks,
            language // Added language preference
        } = req.body;

        const updates = {};

        // Check if username is being updated and is unique
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Користувач з таким іменем вже існує' });
            }
            updates.username = username;
        }

        // Check if email is being updated and is unique
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Користувач з такою поштою вже існує' });
            }
            updates.email = email;
        }

        // Update other profile fields if they exist
        if (fullName !== undefined) updates.fullName = fullName;
        if (bio !== undefined) updates.bio = bio;
        if (location !== undefined) updates.location = location;
        if (interests !== undefined) updates.interests = interests;
        if (website !== undefined) updates.website = website;

        // Update language preference if provided
        if (language) {
            updates.languagePreference = language;
        }

        // Update social links if provided
        if (socialLinks) {
            // Initialize socialLinks object if it doesn't exist
            if (!user.socialLinks) {
                user.socialLinks = {
                    facebook: '',
                    twitter: '',
                    instagram: '',
                    linkedin: ''
                };
            }

            // Update each social link if provided
            if (socialLinks.facebook !== undefined) user.socialLinks.facebook = socialLinks.facebook;
            if (socialLinks.twitter !== undefined) user.socialLinks.twitter = socialLinks.twitter;
            if (socialLinks.instagram !== undefined) user.socialLinks.instagram = socialLinks.instagram;
            if (socialLinks.linkedin !== undefined) user.socialLinks.linkedin = socialLinks.linkedin;

            updates.socialLinks = user.socialLinks;
        }

        // Update lastActive timestamp
        updates.lastActive = new Date();

        // Update user if there are changes
        if (Object.keys(updates).length > 0) {
            // Update user directly since we might be using mock data
            Object.assign(user, updates);
            await user.save();

            return res.json({
                message: 'Профіль успішно оновлено',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar,
                    fullName: user.fullName,
                    bio: user.bio,
                    location: user.location,
                    interests: user.interests,
                    website: user.website,
                    socialLinks: user.socialLinks,
                    languagePreference: user.languagePreference // Added language preference
                }
            });
        }

        return res.json({
            message: 'Немає змін для оновлення',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                fullName: user.fullName || '',
                bio: user.bio || '',
                location: user.location || '',
                interests: user.interests || [],
                website: user.website || '',
                socialLinks: user.socialLinks || {
                    facebook: '',
                    twitter: '',
                    instagram: '',
                    linkedin: ''
                },
                languagePreference: user.languagePreference || 'en' // Added language preference
            }
        });
    } catch (error) {
        console.error('[Profile Update Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при оновленні профілю' });
    }
});

// Add endpoint for storing push notification tokens
router.post('/push-token', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { pushToken } = req.body;

        if (!pushToken) {
            return res.status(400).json({ message: 'Push token is required' });
        }

        // Update user with push token
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Store push tokens as an array to support multiple devices
        if (!user.pushTokens) {
            user.pushTokens = [];
        }

        // Check if token already exists to avoid duplicates
        if (!user.pushTokens.includes(pushToken)) {
            user.pushTokens.push(pushToken);
            await user.save();
        }

        return res.json({ success: true, message: 'Push token saved successfully' });
    } catch (error) {
        console.error('Error saving push token:', error);
        res.status(500).json({ message: 'Error saving push token', error: error.message });
    }
});

// Add this endpoint for admin to retrieve all users
router.get('/users', authMiddleware, async (req, res) => {
    try {
        // Only admins can retrieve all users
        if (!req.user.roles.includes('ADMIN')) {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        // Retrieve all users
        const users = await User.find()
            .select('-password') // Don't send passwords
            .sort('username');

        res.json(users);
    } catch (error) {
        console.error('[Get All Users Error]:', error);
        res.status(500).json({ message: 'Server error retrieving users' });
    }
});

// Add endpoint for admins to update user information
router.put('/users/:userId', authMiddleware, async (req, res) => {
    try {
        // Only admins can update other users
        if (!req.user.roles.includes('ADMIN') && req.params.userId !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. Admin role required to update other users.' });
        }

        const { userId } = req.params;
        const { username, email, fullName, roles, password } = req.body;

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields if provided
        if (username) user.username = username;
        if (email) user.email = email;
        if (fullName !== undefined) user.fullName = fullName;

        // Only admins can update roles
        if (roles && req.user.roles.includes('ADMIN')) {
            user.roles = roles;
        }

        // Update password if provided
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        // Return updated user (without password)
        const updatedUser = await User.findById(userId).select('-password');

        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('[Update User Error]:', error);
        res.status(500).json({ message: 'Server error updating user' });
    }
});

// Add endpoint for admins to delete users
router.delete('/users/:userId', authMiddleware, async (req, res) => {
    try {
        // Only admins can delete users
        if (!req.user.roles.includes('ADMIN')) {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const { userId } = req.params;

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete the user
        await user.deleteOne();

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('[Delete User Error]:', error);
        res.status(500).json({ message: 'Server error deleting user' });
    }
});

// Add endpoint for updating language preference
router.post('/language', authMiddleware, async (req, res) => {
    try {
        const { language } = req.body;

        if (!language) {
            return res.status(400).json({ message: 'Language code is required' });
        }

        // Validate language code
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'uk', 'ja', 'zh'];
        if (!supportedLanguages.includes(language)) {
            return res.status(400).json({ message: 'Unsupported language code' });
        }

        // Update user language preference
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.languagePreference = language;
        await user.save();

        res.json({
            message: 'Language preference updated successfully',
            languagePreference: user.languagePreference
        });
    } catch (error) {
        console.error('[Update Language Preference Error]:', error);
        res.status(500).json({ message: 'Server error updating language preference' });
    }
});

// Add endpoint for searching users
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        console.log(`[User Search] Query: ${q}, Requested by: ${req.user.id}`);

        // Prepare regex (case insensitive)
        const searchRegex = new RegExp(q, 'i');

        // For mock DB, we need a simple solution
        if (global.USE_MOCK_DB) {
            console.log('Using mock DB for search');

            // Get all users from mock DB
            const User = mongoose.model('User');
            const allUsers = await User.find();

            // Filter by username or fullName matching the query
            const filteredUsers = allUsers.filter(user =>
                (user.username && searchRegex.test(user.username)) ||
                (user.fullName && searchRegex.test(user.fullName)) ||
                (user.email && searchRegex.test(user.email))
            );

            // Exclude current user and limit to 10 results
            const results = filteredUsers
                .filter(user => user._id.toString() !== req.user.id)
                .map(user => ({
                    _id: user._id,
                    username: user.username,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    bio: user.bio
                }))
                .slice(0, 10);

            return res.json(results);
        }

        // For real MongoDB, use proper query
        const users = await User.find({
            $or: [
                { username: { $regex: searchRegex } },
                { fullName: { $regex: searchRegex } },
                { email: { $regex: searchRegex } }
            ],
            _id: { $ne: req.user.id } // Exclude current user
        })
        .select('username fullName avatar bio')
        .limit(10);

        res.json(users);
    } catch (error) {
        console.error('[User Search Error]:', error);
        res.status(500).json({ message: 'Server error searching users' });
    }
});

module.exports = router;
