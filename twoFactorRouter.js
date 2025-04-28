const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/authMiddleware');
const twoFactorService = require('./twoFactorService');
const User = require('./models/User');
const { v4: uuidv4 } = require('uuid');

/**
 * Get current 2FA status
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return 2FA status
        res.json({
            enabled: user.twoFactorAuth && user.twoFactorAuth.enabled,
            verifiedDevicesCount: user.twoFactorAuth && user.twoFactorAuth.verifiedDevices
                ? user.twoFactorAuth.verifiedDevices.length
                : 0,
            backupCodesCount: user.twoFactorAuth && user.twoFactorAuth.backupCodes
                ? user.twoFactorAuth.backupCodes.length
                : 0
        });
    } catch (error) {
        console.error('Error getting 2FA status:', error);
        res.status(500).json({ message: 'Error getting 2FA status', error: error.message });
    }
});

/**
 * Generate a new 2FA secret
 */
router.post('/setup', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is already enabled
        if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
        }

        // Generate a new secret
        const secret = await twoFactorService.generateSecret(user.username);

        // Generate QR code
        const qrCode = await twoFactorService.generateQRCode(secret.otpauth_url);

        // Return the secret and QR code
        res.json({
            secret: secret.base32,
            qrCode
        });
    } catch (error) {
        console.error('Error setting up 2FA:', error);
        res.status(500).json({ message: 'Error setting up 2FA', error: error.message });
    }
});

/**
 * Verify token and enable 2FA
 */
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { token, secret } = req.body;

        if (!token || !secret) {
            return res.status(400).json({ message: 'Token and secret are required' });
        }

        // Enable 2FA
        const result = await twoFactorService.enableTwoFactor(userId, secret, token);

        // Return backup codes
        res.json({
            message: 'Two-factor authentication enabled',
            backupCodes: result.backupCodes
        });
    } catch (error) {
        console.error('Error verifying 2FA:', error);
        res.status(400).json({ message: error.message });
    }
});

/**
 * Disable 2FA
 */
router.post('/disable', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Current 2FA token is required to disable 2FA' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is enabled
        if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
        }

        // Verify token
        const isValid = twoFactorService.verifyToken(user.twoFactorAuth.secret, token);

        if (!isValid) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Verify password if provided
        if (password) {
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(400).json({ message: 'Invalid password' });
            }
        }

        // Disable 2FA
        await twoFactorService.disableTwoFactor(userId);

        res.json({ message: 'Two-factor authentication disabled' });
    } catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({ message: 'Error disabling 2FA', error: error.message });
    }
});

/**
 * Verify a token for login
 */
router.post('/validate', async (req, res) => {
    try {
        const { userId, token, backupCode, rememberDevice } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Find the user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is enabled
        if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
        }

        let isValid = false;

        // Check if a backup code was provided
        if (backupCode) {
            isValid = await twoFactorService.verifyBackupCode(userId, backupCode);
        } else if (token) {
            // Verify token
            isValid = twoFactorService.verifyToken(user.twoFactorAuth.secret, token);

            // Update last used time if valid
            if (isValid) {
                await User.findByIdAndUpdate(userId, {
                    'twoFactorAuth.lastUsed': new Date()
                });
            }
        } else {
            return res.status(400).json({ message: 'Token or backup code is required' });
        }

        if (!isValid) {
            return res.status(400).json({ message: 'Invalid token or backup code' });
        }

        // Register device if remember me option is selected
        if (rememberDevice) {
            const deviceId = uuidv4();
            const deviceName = req.headers['user-agent'] || 'Unknown Device';
            const ipAddress = req.ip || req.connection.remoteAddress;

            await twoFactorService.registerDevice(userId, deviceId, deviceName, ipAddress);

            // Set a cookie with the device ID
            res.cookie('deviceId', deviceId, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
        }

        // Log the successful login
        await User.findByIdAndUpdate(userId, {
            $push: {
                securityLogs: {
                    action: 'login',
                    timestamp: new Date(),
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent'],
                    success: true,
                    details: 'Login with 2FA'
                }
            }
        });

        res.json({
            message: 'Two-factor authentication successful',
            success: true
        });
    } catch (error) {
        console.error('Error validating 2FA:', error);
        res.status(500).json({ message: 'Error validating 2FA', error: error.message });
    }
});

/**
 * Generate new backup codes
 */
router.post('/backup-codes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is enabled
        if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
        }

        // Verify token if provided
        if (token) {
            const isValid = twoFactorService.verifyToken(user.twoFactorAuth.secret, token);

            if (!isValid) {
                return res.status(400).json({ message: 'Invalid token' });
            }
        }

        // Generate new backup codes
        const backupCodes = await twoFactorService.generateBackupCodes();
        const crypto = require('crypto');
        const hashedBackupCodes = backupCodes.map(code =>
            crypto.createHash('sha256').update(code).digest('hex')
        );

        // Update the user
        await User.findByIdAndUpdate(userId, {
            'twoFactorAuth.backupCodes': hashedBackupCodes
        });

        // Add security log
        await User.findByIdAndUpdate(userId, {
            $push: {
                securityLogs: {
                    action: '2fa_setup',
                    timestamp: new Date(),
                    success: true,
                    details: 'Generated new backup codes'
                }
            }
        });

        res.json({
            message: 'New backup codes generated',
            backupCodes
        });
    } catch (error) {
        console.error('Error generating backup codes:', error);
        res.status(500).json({ message: 'Error generating backup codes', error: error.message });
    }
});

/**
 * Get verified devices
 */
router.get('/devices', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is enabled
        if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
        }

        // Return devices
        res.json({
            devices: user.twoFactorAuth.verifiedDevices || []
        });
    } catch (error) {
        console.error('Error getting verified devices:', error);
        res.status(500).json({ message: 'Error getting verified devices', error: error.message });
    }
});

/**
 * Remove a verified device
 */
router.delete('/devices/:deviceId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({ message: 'Device ID is required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if 2FA is enabled
        if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
            return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
        }

        // Check if device exists
        if (!user.twoFactorAuth.verifiedDevices || !user.twoFactorAuth.verifiedDevices.some(d => d.deviceId === deviceId)) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Remove device
        await User.findByIdAndUpdate(userId, {
            $pull: {
                'twoFactorAuth.verifiedDevices': { deviceId }
            }
        });

        // Add security log
        await User.findByIdAndUpdate(userId, {
            $push: {
                securityLogs: {
                    action: '2fa_setup',
                    timestamp: new Date(),
                    success: true,
                    details: `Removed verified device: ${deviceId}`
                }
            }
        });

        res.json({ message: 'Device removed' });
    } catch (error) {
        console.error('Error removing device:', error);
        res.status(500).json({ message: 'Error removing device', error: error.message });
    }
});

module.exports = router;
