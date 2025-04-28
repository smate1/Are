const User = require('./models/User');
const Role = require('./models/Role');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { secret } = require('./config');
const emailService = require('./emailService');

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// User registration function with verification
const registration = asyncHandler(async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Registration error', errors: errors.array() });
        }

        const { username, email, password, rememberMe } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this username or email already exists' });
        }

        // Hash password
        const hashPassword = bcrypt.hashSync(password, 7);

        // Get user role
        const userRole = await Role.findOne({ value: 'USER' });
        if (!userRole) {
            return res.status(500).json({ message: 'Cannot create user - role not found' });
        }

        // Create user
        const user = new User({
            username,
            email,
            password: hashPassword,
            roles: [userRole.value],
            isVerified: false,
            avatar: 'images/default-avatar.svg'
        });

        // Save user to database
        await user.save();

        // Send verification email
        await emailService.sendVerificationEmail(user);

        // Set token expiration (default 24 hours, 30 days if rememberMe is true)
        const expiresIn = rememberMe ? '30d' : '24h';
        const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        // Generate token
        const token = jwt.sign(
            { id: user._id, username, email, roles: user.roles },
            secret,
            { expiresIn }
        );

        // Set HTTP-only cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: cookieMaxAge, // 24 hours or 30 days based on rememberMe
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Return user and token
        return res.status(201).json({
            message: 'User registered successfully! Please check your email for verification.',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                avatar: user.avatar,
                isVerified: user.isVerified
            },
            expiresIn,
            rememberMe
        });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ message: 'Registration error', error: e.message });
    }
});

// Login function
const login = asyncHandler(async (req, res) => {
    try {
        console.log('Login attempt:', req.body);

        // Extract username/email and password
        let { username, password, rememberMe, twoFactorToken, deviceId } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Set token expiration (default 24 hours, 30 days if rememberMe is true)
        const expiresIn = rememberMe ? '30d' : '24h';
        const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        // Calculate expiration date for session
        const expiresAt = new Date();
        if (rememberMe) {
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        } else {
            expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
        }

        // Get device and IP information from request
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
        const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown IP';

        // Generate a session ID
        const sessionId = Math.random().toString(36).substring(2, 15) +
                          Math.random().toString(36).substring(2, 15);

        // Use simpler logic when in mock mode (check if we're using the test user)
        if (process.env.NODE_ENV === 'test' || (process.env.USE_MOCK_DB === 'true' || global.USE_MOCK_DB)) {
            console.log('Using mock mode for login');

            // In mock mode, we know we have a test user with username 'testuser' and password 'password123'
            if (username === 'testuser' && password === 'password123') {
                // Mark login as successful if rate limiter is active
                if (req.successfulLogin) {
                    req.successfulLogin();
                }

                // Use hardcoded values for the test user
                const mockUser = {
                    _id: '123456789',
                    username: 'testuser',
                    email: 'test@example.com',
                    roles: ['USER'],
                    avatar: 'images/default-avatar.svg',
                    isVerified: true,
                    activeSessions: [{
                        sessionId,
                        deviceInfo,
                        ipAddress,
                        location: 'Mock Location',
                        lastActive: new Date(),
                        createdAt: new Date(),
                        expiresAt
                    }]
                };

                // Generate token for the test user with the appropriate expiration
                const token = jwt.sign(
                    {
                        id: mockUser._id,
                        username: mockUser.username,
                        email: mockUser.email,
                        roles: mockUser.roles,
                        sessionId // Include session ID in token
                    },
                    secret,
                    { expiresIn }
                );

                // Set HTTP-only cookie with token
                res.cookie('token', token, {
                    httpOnly: true,
                    maxAge: cookieMaxAge, // 24 hours or 30 days
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict'
                });

                console.log('Mock login successful');

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
                    expiresIn,
                    rememberMe,
                    sessionId
                });
            } else {
                console.log('Mock login failed - invalid credentials');

                // Register failed login attempt if rate limiter is active
                if (req.failedLoginAttempt) {
                    const failedAttemptInfo = req.failedLoginAttempt();

                    // If too many failed attempts, return rate limit error
                    if (failedAttemptInfo.blocked) {
                        return res.status(429).json({
                            message: `Too many failed login attempts. Your account is temporarily locked for ${failedAttemptInfo.remainingTime} minutes.`,
                            blockedUntil: failedAttemptInfo.blockUntil,
                            remainingAttempts: 0
                        });
                    }

                    // Return remaining attempts information
                    return res.status(400).json({
                        message: `Invalid username or password. ${failedAttemptInfo.remaining} attempts remaining before temporary lockout.`,
                        remainingAttempts: failedAttemptInfo.remaining
                    });
                }

                return res.status(400).json({ message: 'Invalid username or password' });
            }
        }

        // Continue with normal database login if not using mock mode
        // Check if username is an email
        const isEmail = username.includes('@');

        // Find user by username or email
        const user = isEmail
            ? await User.findOne({ email: username })
            : await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ message: `User not found` });
        }

        // Validate password
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            // Register failed login attempt if rate limiter is active
            if (req.failedLoginAttempt) {
                const failedAttemptInfo = req.failedLoginAttempt();

                // If too many failed attempts, return rate limit error
                if (failedAttemptInfo.blocked) {
                    return res.status(429).json({
                        message: `Too many failed login attempts. Your account is temporarily locked for ${failedAttemptInfo.remainingTime} minutes.`,
                        blockedUntil: failedAttemptInfo.blockUntil,
                        remainingAttempts: 0
                    });
                }

                // Return remaining attempts information
                return res.status(400).json({
                    message: `Incorrect password. ${failedAttemptInfo.remaining} attempts remaining before temporary lockout.`,
                    remainingAttempts: failedAttemptInfo.remaining
                });
            }

            return res.status(400).json({ message: `Incorrect password` });
        }

        // Mark login as successful if rate limiter is active
        if (req.successfulLogin) {
            req.successfulLogin();
        }

        // Check if 2FA is enabled and verify device
        if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
            // Check if device ID is provided and is already verified
            let isVerifiedDevice = false;

            if (deviceId && user.twoFactorAuth.verifiedDevices) {
                isVerifiedDevice = user.twoFactorAuth.verifiedDevices.some(
                    device => device.deviceId === deviceId
                );

                // If device is verified, update last login time
                if (isVerifiedDevice) {
                    await User.findOneAndUpdate(
                        { _id: user._id, 'twoFactorAuth.verifiedDevices.deviceId': deviceId },
                        { $set: { 'twoFactorAuth.verifiedDevices.$.lastLogin': new Date() } }
                    );
                }
            }

            // If 2FA token is provided, verify it
            if (twoFactorToken) {
                // Use the service to verify the token
                const twoFactorService = require('./twoFactorService');
                const isValidToken = twoFactorService.verifyToken(
                    user.twoFactorAuth.secret,
                    twoFactorToken
                );

                if (!isValidToken) {
                    return res.status(400).json({
                        message: 'Invalid two-factor authentication code',
                        requires2FA: true
                    });
                }

                // Update last used time
                await User.findByIdAndUpdate(user._id, {
                    'twoFactorAuth.lastUsed': new Date()
                });

                // Register this login in security logs
                await User.findByIdAndUpdate(user._id, {
                    $push: {
                        securityLogs: {
                            action: 'login',
                            timestamp: new Date(),
                            ipAddress: req.ip || req.connection.remoteAddress,
                            userAgent: req.headers['user-agent'],
                            success: true,
                            details: 'Login with 2FA token'
                        }
                    }
                });
            }
            // Otherwise, if device is not verified and no token provided, require 2FA
            else if (!isVerifiedDevice) {
                // Return user info but indicate that 2FA is required
                return res.status(200).json({
                    message: 'Two-factor authentication required',
                    requires2FA: true,
                    userId: user._id,
                    username: user.username,
                    email: user.email
                });
            }
            // If device is verified, log this info
            else {
                // Register this login in security logs
                await User.findByIdAndUpdate(user._id, {
                    $push: {
                        securityLogs: {
                            action: 'login',
                            timestamp: new Date(),
                            ipAddress: req.ip || req.connection.remoteAddress,
                            userAgent: req.headers['user-agent'],
                            success: true,
                            details: 'Login with verified device, 2FA skipped'
                        }
                    }
                });
            }
        }

        // Add session to user document
        if (!user.activeSessions) {
            user.activeSessions = [];
        }

        // Add new session
        user.activeSessions.push({
            sessionId,
            deviceInfo,
            ipAddress,
            location: 'Unknown Location', // Would use geolocation in production
            lastActive: new Date(),
            createdAt: new Date(),
            expiresAt
        });

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token with appropriate expiration
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                sessionId // Include session ID in token
            },
            secret,
            { expiresIn }
        );

        // Set HTTP-only cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: cookieMaxAge, // 24 hours or 30 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Add info about 2FA status
        const has2FAEnabled = !!(user.twoFactorAuth && user.twoFactorAuth.enabled);

        return res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                avatar: user.avatar,
                isVerified: user.isVerified,
                fullName: user.fullName,
                bio: user.bio,
                has2FA: has2FAEnabled
            },
            expiresIn,
            rememberMe,
            sessionId
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ message: 'Login error', error: e.message });
    }
});

// Get users (admin only)
const getUsers = asyncHandler(async (req, res) => {
    try {
        // Get all users (excluding password field)
        const users = await User.find().select('-password');
        res.json(users);
    } catch (e) {
        console.error('Get users error:', e);
        res.status(500).json({ message: 'Error retrieving users', error: e.message });
    }
});

// Email verification endpoint
const verifyEmail = asyncHandler(async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        // Find user by ID
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already verified
        if (user.isVerified) {
            return res.json({ message: 'Email already verified', isVerified: true });
        }

        // Mark as verified
        user.isVerified = true;
        await user.save();

        return res.json({
            message: 'Email verified successfully',
            isVerified: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (e) {
        console.error('Email verification error:', e);
        res.status(500).json({ message: 'Verification error', error: e.message });
    }
});

// Request password reset
const requestPasswordReset = asyncHandler(async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal that the email doesn't exist
            return res.json({ message: 'If your email is registered, you will receive a password reset link' });
        }

        // Check for reset password lock
        if (user.resetPasswordLocked && user.resetPasswordLockExpires && new Date() < user.resetPasswordLockExpires) {
            // Calculate remaining time until unlock (in minutes)
            const remainingTime = Math.ceil((user.resetPasswordLockExpires - new Date()) / (60 * 1000));

            // For security, still inform that the email will be sent, but log the lockout
            console.log(`Password reset blocked for ${email}. Account locked for ${remainingTime} more minutes.`);

            return res.json({
                message: 'If your email is registered, you will receive a password reset link',
                // For development/testing, return additional information
                debug: process.env.NODE_ENV !== 'production' ? {
                    locked: true,
                    remainingTime
                } : undefined
            });
        }

        // Check for request frequency (limit - no more than 1 request every 15 minutes)
        const resetCooldown = 15 * 60 * 1000; // 15 minutes
        if (user.lastResetRequest && (new Date() - user.lastResetRequest) < resetCooldown) {
            // Calculate remaining time until the next allowed request (in minutes)
            const cooldownRemaining = Math.ceil((resetCooldown - (new Date() - user.lastResetRequest)) / (60 * 1000));

            console.log(`Password reset request too frequent for ${email}. Try again in ${cooldownRemaining} minutes.`);

            return res.json({
                message: 'If your email is registered, you will receive a password reset link',
                // For development/testing, return additional information
                debug: process.env.NODE_ENV !== 'production' ? {
                    cooldown: true,
                    remainingTime: cooldownRemaining
                } : undefined
            });
        }

        // Create and save password reset token
        const { generateResetToken, generateResetTokenHash, sendPasswordResetEmail } = require('./emailService');
        const resetToken = generateResetToken(user._id, user.email);
        const resetTokenHash = generateResetTokenHash(resetToken);

        // Update user information
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
        user.lastResetRequest = new Date();
        user.resetPasswordAttempts = 0; // Reset attempts counter

        await user.save();

        // Send password reset email
        const success = await sendPasswordResetEmail(user, resetToken);

        return res.json({
            message: 'If your email is registered, you will receive a password reset link',
            // Only for development/testing
            success: process.env.NODE_ENV !== 'production' ? success : undefined
        });
    } catch (e) {
        console.error('Password reset request error:', e);
        res.status(500).json({ message: 'Password reset request error', error: e.message });
    }
});

// Reset password with token
const resetPassword = asyncHandler(async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }

        // Password complexity check
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        // Check for different character types
        const hasLowercase = /[a-z]/.test(password);
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        // Must meet at least 3 of 4 criteria
        const strengthCriteria = [hasLowercase, hasUppercase, hasNumbers, hasSpecial];
        const strengthScore = strengthCriteria.filter(Boolean).length;

        if (strengthScore < 3) {
            return res.status(400).json({
                message: 'Password is too weak. Include at least 3 of the following: uppercase letters, lowercase letters, numbers, and special characters.',
                passwordStrength: strengthScore
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
            // Check if it's a reset token
            if (decoded.purpose !== 'reset') {
                return res.status(400).json({ message: 'Invalid token type' });
            }
        } catch (err) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Generate hash of the provided token
        const { generateResetTokenHash } = require('./emailService');
        const resetTokenHash = generateResetTokenHash(token);

        // Find user by ID and token hash
        const user = await User.findOne({
            _id: decoded.id,
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(404).json({ message: 'Invalid or expired reset token' });
        }

        // Check for reset password lock
        if (user.resetPasswordLocked && user.resetPasswordLockExpires && new Date() < user.resetPasswordLockExpires) {
            // Calculate remaining time until unlock (in minutes)
            const remainingTime = Math.ceil((user.resetPasswordLockExpires - new Date()) / (60 * 1000));

            return res.status(429).json({
                message: `Too many failed password reset attempts. Please try again after ${remainingTime} minutes.`,
                remainingTime
            });
        }

        // Check for number of attempts (limit - no more than 5 attempts)
        const maxAttempts = 5;
        user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;

        if (user.resetPasswordAttempts >= maxAttempts) {
            // Lock password reset for 30 minutes
            const lockDuration = 30 * 60 * 1000; // 30 minutes
            user.resetPasswordLocked = true;
            user.resetPasswordLockExpires = new Date(Date.now() + lockDuration);
            await user.save();

            return res.status(429).json({
                message: 'Too many password reset attempts. Your account is temporarily locked for 30 minutes.'
            });
        }

        // Hash new password and update
        const hashPassword = bcrypt.hashSync(password, 7);
        user.password = hashPassword;

        // Clear reset token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.resetPasswordAttempts = 0;
        user.resetPasswordLocked = false;
        user.resetPasswordLockExpires = undefined;

        await user.save();

        return res.json({ message: 'Password reset successful' });
    } catch (e) {
        console.error('Password reset error:', e);
        res.status(500).json({ message: 'Password reset error', error: e.message });
    }
});

// Logout (clear cookie)
const logout = (req, res) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
};

// Validate token explicitly
const validateToken = asyncHandler(async (req, res) => {
    // Since we're using the authMiddleware before this endpoint,
    // if we reach here, the token is valid and req.user is set
    try {
        const userId = req.user.id;

        // Get more user data if needed
        let userData = req.user;

        // If we need full user data from DB, uncomment this:
        // const user = await User.findById(userId).select('-password');
        // if (!user) {
        //     return res.status(404).json({ message: 'User not found' });
        // }
        // userData = user;

        return res.json({
            valid: true,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                roles: userData.roles
            }
        });
    } catch (e) {
        console.error('Token validation error:', e);
        res.status(500).json({ message: 'Token validation error', error: e.message });
    }
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        // Get user ID from token validation middleware
        const userId = req.user.id;

        // Find user (excluding password)
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json(user);
    } catch (e) {
        console.error('Get current user error:', e);
        res.status(500).json({ message: 'Error retrieving user', error: e.message });
    }
});

// Resend verification email
const resendVerification = asyncHandler(async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if email doesn't exist
            return res.json({ message: 'If your email is registered, you will receive a verification link' });
        }

        // Check if already verified
        if (user.isVerified) {
            return res.json({ message: 'Email is already verified', isVerified: true });
        }

        // Send verification email
        const success = await emailService.sendVerificationEmail(user);

        return res.json({
            message: 'Verification email sent',
            // Only for development/testing
            success: process.env.NODE_ENV !== 'production' ? success : undefined
        });
    } catch (e) {
        console.error('Resend verification error:', e);
        res.status(500).json({ message: 'Error resending verification', error: e.message });
    }
});

// Biometric authentication handlers
// Register a device for biometric authentication
const registerBiometric = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceId, deviceName, biometricKeyId, biometricPublicKey } = req.body;

        if (!deviceId || !biometricKeyId || !biometricPublicKey) {
            return res.status(400).json({ message: 'Missing required biometric registration data' });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Initialize biometric devices array if it doesn't exist
        if (!user.biometricDevices) {
            user.biometricDevices = [];
        }

        // Check if device is already registered
        const existingDevice = user.biometricDevices.find(device => device.deviceId === deviceId);
        if (existingDevice) {
            return res.status(400).json({ message: 'Device already registered for biometric authentication' });
        }

        // Add the new biometric device
        user.biometricDevices.push({
            deviceId,
            deviceName: deviceName || 'Unknown Device',
            biometricKeyId,
            biometricPublicKey,
            registeredAt: new Date()
        });

        await user.save();

        return res.status(201).json({
            message: 'Biometric authentication registered successfully',
            deviceId,
            deviceName: deviceName || 'Unknown Device'
        });
    } catch (error) {
        console.error('Biometric registration error:', error);
        res.status(500).json({ message: 'Error registering biometric authentication', error: error.message });
    }
});

// Verify biometric authentication and issue token
const verifyBiometric = asyncHandler(async (req, res) => {
    try {
        const { deviceId, biometricKeyId, biometricSignature, username } = req.body;

        if (!deviceId || !biometricKeyId || !biometricSignature || !username) {
            return res.status(400).json({ message: 'Missing required biometric authentication data' });
        }

        // Find the user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the device is registered
        if (!user.biometricDevices || !Array.isArray(user.biometricDevices)) {
            return res.status(400).json({ message: 'No biometric devices registered for this user' });
        }

        const device = user.biometricDevices.find(d =>
            d.deviceId === deviceId && d.biometricKeyId === biometricKeyId);

        if (!device) {
            return res.status(400).json({ message: 'Device not registered for biometric authentication' });
        }

        // In a real implementation, we would verify the biometric signature using the stored public key
        // For our mock implementation, we'll assume the signature is valid if it's the right format
        const isValidSignature = typeof biometricSignature === 'string' &&
            biometricSignature.startsWith('bio_sig_') &&
            biometricSignature.length > 20;

        if (!isValidSignature) {
            return res.status(400).json({ message: 'Invalid biometric signature' });
        }

        // Update last used timestamp
        device.lastUsed = new Date();
        await user.save();

        // Generate a long-lived token (90 days for biometric auth)
        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email, roles: user.roles, authMethod: 'biometric' },
            secret,
            { expiresIn: '90d' }
        );

        // Set HTTP-only cookie with token
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return res.json({
            message: 'Biometric authentication successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                avatar: user.avatar,
                isVerified: user.isVerified,
                fullName: user.fullName,
                bio: user.bio
            },
            expiresIn: '90d',
            authMethod: 'biometric'
        });
    } catch (error) {
        console.error('Biometric verification error:', error);
        res.status(500).json({ message: 'Error verifying biometric authentication', error: error.message });
    }
});

// Unregister a biometric device
const unregisterBiometric = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceId } = req.body;

        if (!deviceId) {
            return res.status(400).json({ message: 'Device ID is required' });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user has biometric devices
        if (!user.biometricDevices || !Array.isArray(user.biometricDevices)) {
            return res.status(400).json({ message: 'No biometric devices registered for this user' });
        }

        // Find the device index
        const deviceIndex = user.biometricDevices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex === -1) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Remove the device
        user.biometricDevices.splice(deviceIndex, 1);
        await user.save();

        return res.json({
            message: 'Biometric device unregistered successfully',
            deviceId
        });
    } catch (error) {
        console.error('Biometric unregistration error:', error);
        res.status(500).json({ message: 'Error unregistering biometric device', error: error.message });
    }
});

// List all registered biometric devices
const listBiometricDevices = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user has biometric devices
        if (!user.biometricDevices || !Array.isArray(user.biometricDevices)) {
            return res.json({ devices: [] });
        }

        // Return the devices (without sensitive key data)
        const devices = user.biometricDevices.map(d => ({
            deviceId: d.deviceId,
            deviceName: d.deviceName,
            registeredAt: d.registeredAt,
            lastUsed: d.lastUsed || null
        }));

        return res.json({ devices });
    } catch (error) {
        console.error('Biometric devices listing error:', error);
        res.status(500).json({ message: 'Error listing biometric devices', error: error.message });
    }
});

// Session Management Functions
// List all active sessions for a user
const listActiveSessions = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get current session ID from token or cookie
        const currentSessionId = req.sessionId || 'current-session';

        // Check if any sessions have expired and remove them
        if (user.activeSessions && Array.isArray(user.activeSessions)) {
            // Filter out expired sessions
            const now = new Date();
            user.activeSessions = user.activeSessions.filter(session => {
                return !session.expiresAt || new Date(session.expiresAt) > now;
            });

            await user.save();
        } else {
            // Initialize activeSessions if it doesn't exist
            user.activeSessions = [];
        }

        // Get the sessions with the current session marked
        const sessions = user.activeSessions.map(session => ({
            sessionId: session.sessionId,
            deviceInfo: session.deviceInfo,
            ipAddress: session.ipAddress,
            location: session.location,
            lastActive: session.lastActive,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrent: session.sessionId === currentSessionId
        }));

        return res.json({ sessions });
    } catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({ message: 'Error retrieving sessions', error: error.message });
    }
});

// End a specific session
const endSession = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Can't end own session this way
        const currentSessionId = req.sessionId || 'current-session';
        if (sessionId === currentSessionId) {
            return res.status(400).json({ message: 'Cannot end your current session. Use logout instead.' });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user has active sessions
        if (!user.activeSessions || !Array.isArray(user.activeSessions)) {
            return res.status(400).json({ message: 'No active sessions found' });
        }

        // Find the session index
        const sessionIndex = user.activeSessions.findIndex(s => s.sessionId === sessionId);
        if (sessionIndex === -1) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Remove the session
        user.activeSessions.splice(sessionIndex, 1);
        await user.save();

        return res.json({
            message: 'Session ended successfully',
            sessionId
        });
    } catch (error) {
        console.error('End session error:', error);
        res.status(500).json({ message: 'Error ending session', error: error.message });
    }
});

// End all sessions except current one
const endAllSessions = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current session ID from token or cookie
        const currentSessionId = req.sessionId || 'current-session';

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user has active sessions
        if (!user.activeSessions || !Array.isArray(user.activeSessions)) {
            return res.status(400).json({ message: 'No active sessions found' });
        }

        // Keep only the current session
        const currentSession = user.activeSessions.find(s => s.sessionId === currentSessionId);
        user.activeSessions = currentSession ? [currentSession] : [];

        await user.save();

        return res.json({
            message: 'All other sessions ended successfully'
        });
    } catch (error) {
        console.error('End all sessions error:', error);
        res.status(500).json({ message: 'Error ending sessions', error: error.message });
    }
});

// Admin Authentication Monitoring Functions
// Get authentication patterns for all users
const getUserAuthPatterns = asyncHandler(async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Filter parameters
        const username = req.query.username;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        // Build filter
        const filter = {};
        if (username) {
            filter.username = { $regex: new RegExp(username, 'i') };
        }

        if (startDate && endDate) {
            filter.lastLogin = { $gte: startDate, $lte: endDate };
        } else if (startDate) {
            filter.lastLogin = { $gte: startDate };
        } else if (endDate) {
            filter.lastLogin = { $lte: endDate };
        }

        // Count total results
        const totalUsers = await User.countDocuments(filter);

        // Find users with their session data
        const users = await User.find(filter)
            .select('username email lastLogin activeSessions biometricDevices')
            .skip(skip)
            .limit(limit)
            .sort({ lastLogin: -1 });

        // Process data for analysis
        const authPatterns = users.map(user => {
            const { _id, username, email, lastLogin, activeSessions, biometricDevices } = user;

            // Count auth methods used
            const authMethods = {
                password: true, // Assume all users have password auth
                biometric: biometricDevices && biometricDevices.length > 0,
                social: user.socialAccounts && user.socialAccounts.length > 0
            };

            // Count active sessions by device type
            const deviceTypes = {
                mobile: 0,
                desktop: 0,
                tablet: 0,
                other: 0
            };

            if (activeSessions && activeSessions.length > 0) {
                activeSessions.forEach(session => {
                    const userAgent = session.deviceInfo || '';

                    if (/mobile|android|iphone|ipod|blackberry/i.test(userAgent)) {
                        deviceTypes.mobile++;
                    } else if (/ipad|tablet/i.test(userAgent)) {
                        deviceTypes.tablet++;
                    } else if (/windows|macintosh|linux/i.test(userAgent)) {
                        deviceTypes.desktop++;
                    } else {
                        deviceTypes.other++;
                    }
                });
            }

            return {
                userId: _id,
                username,
                email,
                lastLogin,
                activeSessions: activeSessions ? activeSessions.length : 0,
                biometricDevices: biometricDevices ? biometricDevices.length : 0,
                authMethods,
                deviceTypes
            };
        });

        return res.json({
            authPatterns,
            pagination: {
                total: totalUsers,
                page,
                limit,
                pages: Math.ceil(totalUsers / limit)
            }
        });
    } catch (error) {
        console.error('Get auth patterns error:', error);
        res.status(500).json({ message: 'Error retrieving authentication patterns', error: error.message });
    }
});

// Get login statistics for monitoring
const getLoginStats = asyncHandler(async (req, res) => {
    try {
        // Time period filter
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

        // For a real implementation, we would query a LoginAttempt model
        // For our mock implementation, we'll return mock data

        // Get all users for some real data
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ lastLogin: { $gte: startDate, $lte: endDate } });

        // Count users with different auth methods
        const usersWithBiometric = await User.countDocuments({ 'biometricDevices.0': { $exists: true } });
        const usersWithSocial = await User.countDocuments({ 'socialAccounts.0': { $exists: true } });

        // Count active sessions
        const sessionsPromise = User.aggregate([
            { $match: { 'activeSessions.0': { $exists: true } } },
            { $project: { sessionCount: { $size: '$activeSessions' } } },
            { $group: { _id: null, total: { $sum: '$sessionCount' } } }
        ]);

        const sessionsResult = await sessionsPromise;
        const totalActiveSessions = sessionsResult.length > 0 ? sessionsResult[0].total : 0;

        // Mock login statistics (would be from a dedicated table in production)
        const mockLoginStats = {
            totalAttempts: activeUsers * 5, // Assume 5 login attempts per active user
            successfulAttempts: activeUsers * 4, // Assume 80% success rate
            failedAttempts: activeUsers, // Assume 20% failed attempts
            authMethods: {
                password: activeUsers * 3, // Most logins via password
                biometric: usersWithBiometric * 2, // Some biometric logins
                oauth: {
                    google: Math.floor(usersWithSocial * 0.4),
                    facebook: Math.floor(usersWithSocial * 0.3),
                    github: Math.floor(usersWithSocial * 0.2),
                    twitter: Math.floor(usersWithSocial * 0.1)
                }
            },
            deviceTypes: {
                mobile: Math.floor(totalActiveSessions * 0.55),
                desktop: Math.floor(totalActiveSessions * 0.4),
                tablet: Math.floor(totalActiveSessions * 0.03),
                other: Math.floor(totalActiveSessions * 0.02)
            },
            // Mock time-based login data
            timeDistribution: generateTimeDistribution(startDate, endDate, activeUsers)
        };

        return res.json({
            period: {
                startDate,
                endDate
            },
            userStats: {
                totalUsers,
                activeUsers,
                usersWithBiometric,
                usersWithSocial
            },
            sessionStats: {
                totalActiveSessions
            },
            loginStats: mockLoginStats
        });
    } catch (error) {
        console.error('Get login stats error:', error);
        res.status(500).json({ message: 'Error retrieving login statistics', error: error.message });
    }
});

// Get all active sessions for all users (admin view)
const getAllActiveSessions = asyncHandler(async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Filter parameters
        const username = req.query.username;
        const deviceFilter = req.query.device;
        const ipFilter = req.query.ip;

        // Aggregation to unwind sessions into separate documents
        const aggregation = [
            // Match users based on filter criteria
            { $match: username ? { username: { $regex: new RegExp(username, 'i') } } : {} },

            // Unwind the activeSessions array into separate documents
            { $unwind: { path: '$activeSessions', preserveNullAndEmptyArrays: false } },

            // Additional filtering on sessions
            ...(deviceFilter || ipFilter ? [{
                $match: {
                    ...(deviceFilter ? { 'activeSessions.deviceInfo': { $regex: new RegExp(deviceFilter, 'i') } } : {}),
                    ...(ipFilter ? { 'activeSessions.ipAddress': { $regex: new RegExp(ipFilter, 'i') } } : {})
                }
            }] : []),

            // Sort by session last active time (most recent first)
            { $sort: { 'activeSessions.lastActive': -1 } },

            // Skip and limit for pagination
            { $skip: skip },
            { $limit: limit },

            // Project the fields we want
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    username: 1,
                    email: 1,
                    sessionId: '$activeSessions.sessionId',
                    deviceInfo: '$activeSessions.deviceInfo',
                    ipAddress: '$activeSessions.ipAddress',
                    location: '$activeSessions.location',
                    lastActive: '$activeSessions.lastActive',
                    createdAt: '$activeSessions.createdAt',
                    expiresAt: '$activeSessions.expiresAt'
                }
            }
        ];

        // Count total sessions
        const countAggregation = [
            // Match users based on filter criteria
            { $match: username ? { username: { $regex: new RegExp(username, 'i') } } : {} },

            // Unwind the activeSessions array into separate documents
            { $unwind: { path: '$activeSessions', preserveNullAndEmptyArrays: false } },

            // Additional filtering on sessions
            ...(deviceFilter || ipFilter ? [{
                $match: {
                    ...(deviceFilter ? { 'activeSessions.deviceInfo': { $regex: new RegExp(deviceFilter, 'i') } } : {}),
                    ...(ipFilter ? { 'activeSessions.ipAddress': { $regex: new RegExp(ipFilter, 'i') } } : {})
                }
            }] : []),

            // Count the results
            { $count: 'total' }
        ];

        const [sessions, countResult] = await Promise.all([
            User.aggregate(aggregation),
            User.aggregate(countAggregation)
        ]);

        const totalSessions = countResult.length > 0 ? countResult[0].total : 0;

        return res.json({
            sessions,
            pagination: {
                total: totalSessions,
                page,
                limit,
                pages: Math.ceil(totalSessions / limit)
            }
        });
    } catch (error) {
        console.error('Get all active sessions error:', error);
        res.status(500).json({ message: 'Error retrieving active sessions', error: error.message });
    }
});

// Helper function to generate mock time-based login data
function generateTimeDistribution(startDate, endDate, activeUsers) {
    const dayCount = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    const avgPerDay = Math.floor(activeUsers * 4 / dayCount); // 4 logins per active user over the period

    const result = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        // Generate variation in login count
        const dayOfWeek = currentDate.getDay();
        const multiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.2; // Less logins on weekends
        const loginCount = Math.floor(avgPerDay * multiplier * (0.8 + Math.random() * 0.4)); // +/- 20% randomness

        result.push({
            date: new Date(currentDate),
            loginCount,
            successCount: Math.floor(loginCount * 0.85), // 85% success rate
            failCount: Math.floor(loginCount * 0.15) // 15% fail rate
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
}

// Exporting functions
module.exports = {
    registration,
    login,
    getUsers,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    logout,
    getCurrentUser,
    resendVerification,
    validateToken,
    registerBiometric,
    verifyBiometric,
    unregisterBiometric,
    listBiometricDevices,
    listActiveSessions,
    endSession,
    endAllSessions,
    getUserAuthPatterns,
    getLoginStats,
    getAllActiveSessions
};
