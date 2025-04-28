const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/authMiddleware');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const { secret } = require('./config');
const { v4: uuidv4 } = require('uuid');

// Mock implementation for OAuth providers since we don't have real credentials
// In a real implementation, you would use libraries like passport.js with
// strategies for Google, Facebook, etc.

/**
 * Generate redirect URL to OAuth provider
 */
router.get('/:provider', (req, res) => {
    try {
        const { provider } = req.params;
        const supportedProviders = ['google', 'facebook', 'github', 'twitter'];

        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({ message: `Unsupported provider: ${provider}` });
        }

        // Generate a state parameter to prevent CSRF
        const state = uuidv4();

        // Store state in a cookie for verification when the user comes back
        res.cookie('oauth_state', state, {
            maxAge: 10 * 60 * 1000, // 10 minutes
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Get callback URL
        const callbackUrl = `${req.protocol}://${req.get('host')}/oauth/${provider}/callback`;

        // In a real implementation, we would redirect to the provider's OAuth page
        // For now, we'll mock this by redirecting to our callback with simulated data

        // For testing purposes, redirect to a mock callback page
        res.redirect(`/auth-mock/${provider}?state=${state}&callbackUrl=${encodeURIComponent(callbackUrl)}`);

    } catch (error) {
        console.error(`Error initializing ${req.params.provider} OAuth:`, error);
        res.status(500).json({ message: 'OAuth initialization error', error: error.message });
    }
});

/**
 * Handle OAuth provider callback
 */
router.get('/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state, error } = req.query;
        const supportedProviders = ['google', 'facebook', 'github', 'twitter'];

        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({ message: `Unsupported provider: ${provider}` });
        }

        // Check if there was an error from the provider
        if (error) {
            return res.redirect(`/auth.html?error=${encodeURIComponent(error)}`);
        }

        // Verify state parameter to prevent CSRF
        const savedState = req.cookies.oauth_state;

        if (!savedState || savedState !== state) {
            return res.redirect('/auth.html?error=invalid_state');
        }

        // Clear the state cookie
        res.clearCookie('oauth_state');

        // In a real implementation, we would exchange the code for a token
        // and then use the token to get user info from the provider

        // For now, we'll simulate this process with mock data
        const mockUserInfo = getMockUserInfo(provider);

        if (!mockUserInfo) {
            return res.redirect('/auth.html?error=user_info_error');
        }

        // Find or create user based on provider ID
        const existingUser = await User.findOne({
            [`socialConnections.${provider}.id`]: mockUserInfo.id
        });

        let user;

        if (existingUser) {
            // User already exists, update their info
            user = existingUser;

            // Update last login time
            user.socialConnections[provider].lastLogin = new Date();
            user.lastLogin = new Date();
            user.loginCount = (user.loginCount || 0) + 1;

            await user.save();
        } else {
            // Check if user with same email exists
            const userWithEmail = await User.findOne({ email: mockUserInfo.email });

            if (userWithEmail) {
                // Connect the social account to the existing user
                userWithEmail.socialConnections = userWithEmail.socialConnections || {};
                userWithEmail.socialConnections[provider] = {
                    id: mockUserInfo.id,
                    email: mockUserInfo.email,
                    connected: true,
                    lastLogin: new Date()
                };

                // Update user info if needed
                if (!userWithEmail.avatar && mockUserInfo.avatar) {
                    userWithEmail.avatar = mockUserInfo.avatar;
                }

                // Update login stats
                userWithEmail.lastLogin = new Date();
                userWithEmail.loginCount = (userWithEmail.loginCount || 0) + 1;

                await userWithEmail.save();
                user = userWithEmail;
            } else {
                // Create a new user
                const username = generateUniqueUsername(mockUserInfo.name || 'user');

                user = new User({
                    username,
                    email: mockUserInfo.email,
                    password: await generateSecurePassword(), // Random secure password
                    isVerified: true, // Social login users are automatically verified
                    fullName: mockUserInfo.name,
                    avatar: mockUserInfo.avatar || 'images/default-avatar.svg',
                    socialConnections: {
                        [provider]: {
                            id: mockUserInfo.id,
                            email: mockUserInfo.email,
                            connected: true,
                            lastLogin: new Date()
                        }
                    },
                    roles: ['USER'],
                    lastLogin: new Date(),
                    loginCount: 1
                });

                await user.save();
            }
        }

        // Create a JWT token for the user
        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email, roles: user.roles },
            secret,
            { expiresIn: '24h' }
        );

        // Set HTTP-only cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Add security log
        user.securityLogs.push({
            action: 'social_connect',
            timestamp: new Date(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            success: true,
            details: `Login with ${provider}`
        });

        await user.save();

        // Redirect to the profile page with success message
        res.redirect(`/profile.html?login=success&provider=${provider}`);

    } catch (error) {
        console.error(`Error handling ${req.params.provider} OAuth callback:`, error);
        res.redirect(`/auth.html?error=${encodeURIComponent('OAuth error')}`);
    }
});

/**
 * Connect a social account to an existing user
 */
router.get('/connect/:provider', authMiddleware, (req, res) => {
    try {
        const { provider } = req.params;
        const supportedProviders = ['google', 'facebook', 'github', 'twitter'];

        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({ message: `Unsupported provider: ${provider}` });
        }

        // Store user ID to connect the accounts after OAuth flow
        // In a real app, use a more secure method like JWT or server-side session
        const state = uuidv4();

        // Store state and user ID in cookies
        res.cookie('oauth_state', state, {
            maxAge: 10 * 60 * 1000, // 10 minutes
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.cookie('oauth_user_id', req.user.id, {
            maxAge: 10 * 60 * 1000, // 10 minutes
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Get callback URL
        const callbackUrl = `${req.protocol}://${req.get('host')}/oauth/connect/${provider}/callback`;

        // For testing purposes, redirect to a mock callback page
        res.redirect(`/auth-mock/${provider}?state=${state}&callbackUrl=${encodeURIComponent(callbackUrl)}`);

    } catch (error) {
        console.error(`Error connecting ${req.params.provider} account:`, error);
        res.status(500).json({ message: 'OAuth connection error', error: error.message });
    }
});

/**
 * Handle callback for connecting social account to existing user
 */
router.get('/connect/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state, error } = req.query;
        const supportedProviders = ['google', 'facebook', 'github', 'twitter'];

        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({ message: `Unsupported provider: ${provider}` });
        }

        // Check if there was an error from the provider
        if (error) {
            return res.redirect(`/profile.html?error=${encodeURIComponent(error)}`);
        }

        // Verify state parameter to prevent CSRF
        const savedState = req.cookies.oauth_state;
        const userId = req.cookies.oauth_user_id;

        if (!savedState || savedState !== state || !userId) {
            return res.redirect('/profile.html?error=invalid_state');
        }

        // Clear the cookies
        res.clearCookie('oauth_state');
        res.clearCookie('oauth_user_id');

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.redirect('/profile.html?error=user_not_found');
        }

        // In a real implementation, exchange code for token and get user info

        // For now, simulate with mock data
        const mockUserInfo = getMockUserInfo(provider);

        if (!mockUserInfo) {
            return res.redirect('/profile.html?error=user_info_error');
        }

        // Check if another account is using this social connection
        const existingConnection = await User.findOne({
            [`socialConnections.${provider}.id`]: mockUserInfo.id,
            _id: { $ne: userId }
        });

        if (existingConnection) {
            return res.redirect(`/profile.html?error=social_account_in_use`);
        }

        // Update the user's social connections
        user.socialConnections = user.socialConnections || {};
        user.socialConnections[provider] = {
            id: mockUserInfo.id,
            email: mockUserInfo.email,
            connected: true,
            lastLogin: new Date()
        };

        // Add security log
        user.securityLogs.push({
            action: 'social_connect',
            timestamp: new Date(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            success: true,
            details: `Connected ${provider} account`
        });

        await user.save();

        // Redirect back to profile with success message
        res.redirect(`/profile.html?connected=${provider}`);

    } catch (error) {
        console.error(`Error connecting ${req.params.provider} account:`, error);
        res.redirect(`/profile.html?error=${encodeURIComponent('Connection error')}`);
    }
});

/**
 * Disconnect a social account
 */
router.post('/disconnect/:provider', authMiddleware, async (req, res) => {
    try {
        const { provider } = req.params;
        const userId = req.user.id;
        const supportedProviders = ['google', 'facebook', 'github', 'twitter'];

        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({ message: `Unsupported provider: ${provider}` });
        }

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has this social connection
        if (!user.socialConnections || !user.socialConnections[provider] || !user.socialConnections[provider].connected) {
            return res.status(400).json({ message: `No connected ${provider} account found` });
        }

        // Check if user has a password set (required for disconnecting social accounts)
        // If they only use social login, they can't disconnect it
        if (!user.password || user.password.length < 8) {
            return res.status(400).json({
                message: 'You must set a password before disconnecting social accounts',
                requiresPassword: true
            });
        }

        // Check if this is the only social account and user isn't verified
        const connectedAccounts = Object.keys(user.socialConnections).filter(
            key => user.socialConnections[key] && user.socialConnections[key].connected
        );

        if (connectedAccounts.length === 1 && connectedAccounts[0] === provider && !user.isVerified) {
            return res.status(400).json({
                message: 'You must verify your email before disconnecting your only social account',
                requiresVerification: true
            });
        }

        // Disconnect the account
        user.socialConnections[provider].connected = false;

        // Add security log
        user.securityLogs.push({
            action: 'social_connect',
            timestamp: new Date(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            success: true,
            details: `Disconnected ${provider} account`
        });

        await user.save();

        res.json({ message: `${provider} account disconnected` });

    } catch (error) {
        console.error(`Error disconnecting ${req.params.provider} account:`, error);
        res.status(500).json({ message: 'Disconnect error', error: error.message });
    }
});

/**
 * Get user's connected social accounts
 */
router.get('/connections', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get connected social accounts
        const connections = {};

        ['google', 'facebook', 'github', 'twitter'].forEach(provider => {
            connections[provider] = !!(user.socialConnections &&
                                      user.socialConnections[provider] &&
                                      user.socialConnections[provider].connected);
        });

        res.json({ connections });

    } catch (error) {
        console.error('Error getting social connections:', error);
        res.status(500).json({ message: 'Error getting social connections', error: error.message });
    }
});

// Google OAuth endpoints
router.get('/google/login', (req, res) => {
    const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth-callback.html`;

    // In a real implementation, we would redirect to Google's OAuth endpoint
    // For demo purposes, we'll redirect to our mock OAuth page
    res.redirect(`/auth-mock/google/authorize.html?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// Facebook OAuth endpoints
router.get('/facebook/login', (req, res) => {
    const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth-callback.html`;

    // In a real implementation, we would redirect to Facebook's OAuth endpoint
    // For demo purposes, we'll redirect to our mock OAuth page
    res.redirect(`/auth-mock/facebook/authorize.html?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// GitHub OAuth endpoints
router.get('/github/login', (req, res) => {
    const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth-callback.html`;

    // In a real implementation, we would redirect to GitHub's OAuth endpoint
    // For demo purposes, we'll redirect to our mock OAuth page
    res.redirect(`/auth-mock/github/authorize.html?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// Twitter OAuth endpoints
router.get('/twitter/login', (req, res) => {
    const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth-callback.html`;

    // In a real implementation, we would redirect to Twitter's OAuth endpoint
    // For demo purposes, we'll redirect to our mock OAuth page
    res.redirect(`/auth-mock/twitter/authorize.html?redirect_uri=${encodeURIComponent(redirectUri)}`);
});

// Generic OAuth callback endpoint
router.post('/callback', async (req, res) => {
    try {
        const { code, provider, redirect_uri } = req.body;

        if (!code || !provider) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`OAuth callback for provider: ${provider}, code: ${code.substring(0, 10)}...`);

        // In a real implementation, we would exchange the code for a token with the provider
        // For demo purposes, we'll create a mock user based on the provider

        // Create a JWT token for our mock user
        const mockUser = getMockUserForProvider(provider);

        if (!mockUser) {
            return res.status(404).json({ error: 'Provider not supported' });
        }

        // Generate token with default expiration (24h)
        const token = jwt.sign(
            { id: mockUser._id, username: mockUser.username, email: mockUser.email, roles: mockUser.roles },
            secret,
            { expiresIn: '24h' }
        );

        // Set HTTP-only cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Return the token and user data
        return res.json({
            token,
            user: {
                id: mockUser._id,
                username: mockUser.username,
                email: mockUser.email,
                roles: mockUser.roles,
                avatar: mockUser.avatar,
                isVerified: mockUser.isVerified
            },
            expiresIn: '24h'
        });
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ error: 'Authentication error', message: error.message });
    }
});

// Helper function to get mock user data based on provider
function getMockUserForProvider(provider) {
    switch (provider.toLowerCase()) {
        case 'google':
            return {
                _id: 'google123456',
                username: 'googleuser',
                email: 'google.user@example.com',
                roles: ['USER'],
                avatar: 'images/avatars/google-avatar.svg',
                isVerified: true
            };
        case 'facebook':
            return {
                _id: 'facebook123456',
                username: 'facebookuser',
                email: 'facebook.user@example.com',
                roles: ['USER'],
                avatar: 'images/avatars/facebook-avatar.svg',
                isVerified: true
            };
        case 'github':
            return {
                _id: 'github123456',
                username: 'githubuser',
                email: 'github.user@example.com',
                roles: ['USER'],
                avatar: 'images/avatars/github-avatar.svg',
                isVerified: true
            };
        case 'twitter':
            return {
                _id: 'twitter123456',
                username: 'twitteruser',
                email: 'twitter.user@example.com',
                roles: ['USER'],
                avatar: 'images/avatars/twitter-avatar.svg',
                isVerified: true
            };
        default:
            return null;
    }
}

// Helper functions

/**
 * Get mock user info for testing purposes
 */
function getMockUserInfo(provider) {
    switch (provider) {
        case 'google':
            return {
                id: 'google123456',
                name: 'Google User',
                email: 'google.user@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Google+User&background=4285F4&color=fff'
            };
        case 'facebook':
            return {
                id: 'facebook123456',
                name: 'Facebook User',
                email: 'facebook.user@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Facebook+User&background=1877F2&color=fff'
            };
        case 'github':
            return {
                id: 'github123456',
                name: 'Github User',
                email: 'github.user@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Github+User&background=24292E&color=fff'
            };
        case 'twitter':
            return {
                id: 'twitter123456',
                name: 'Twitter User',
                email: 'twitter.user@example.com',
                avatar: 'https://ui-avatars.com/api/?name=Twitter+User&background=1DA1F2&color=fff'
            };
        default:
            return null;
    }
}

/**
 * Generate a unique username based on the name
 */
async function generateUniqueUsername(name) {
    // Convert name to lowercase and replace spaces and special chars
    let username = name.toLowerCase().replace(/[^\w]/g, '');

    // Check if username already exists
    let user = await User.findOne({ username });

    if (!user) {
        return username;
    }

    // If username exists, add a random number
    for (let i = 0; i < 10; i++) {
        const candidateUsername = `${username}${Math.floor(Math.random() * 10000)}`;
        user = await User.findOne({ username: candidateUsername });

        if (!user) {
            return candidateUsername;
        }
    }

    // If we still don't have a unique username, use a UUID
    return `user_${uuidv4().substring(0, 8)}`;
}

/**
 * Generate a secure random password
 */
async function generateSecurePassword() {
    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');

    // Generate a random password
    const password = crypto.randomBytes(16).toString('hex');

    // Hash the password
    return await bcrypt.hash(password, 10);
}

module.exports = router;
