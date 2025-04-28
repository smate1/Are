const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('./models/User');

/**
 * Service for handling two-factor authentication
 */
const twoFactorService = {
    /**
     * Generate a new secret for a user
     * @param {string} username
     * @param {string} serviceName - The name of the service (i.e., "Era Platform")
     * @returns {Object} An object containing the secret and other information
     */
    generateSecret: async (username, serviceName = 'Era Platform') => {
        try {
            // Generate a new secret
            const secret = speakeasy.generateSecret({
                length: 20,
                name: `${serviceName}:${username}`
            });

            // Return the secret info
            return {
                otpauth_url: secret.otpauth_url,
                base32: secret.base32
            };
        } catch (error) {
            console.error('Error generating 2FA secret:', error);
            throw error;
        }
    },

    /**
     * Generate a QR code for the secret
     * @param {string} otpauthUrl
     * @returns {string} Data URL of the QR code
     */
    generateQRCode: async (otpauthUrl) => {
        try {
            // Generate QR code image
            return await QRCode.toDataURL(otpauthUrl);
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    },

    /**
     * Verify a TOTP token
     * @param {string} userSecret - The user's secret in base32 format
     * @param {string} token - The token to verify
     * @returns {boolean} Whether the token is valid
     */
    verifyToken: (userSecret, token) => {
        try {
            return speakeasy.totp.verify({
                secret: userSecret,
                encoding: 'base32',
                token: token,
                window: 1 // Allow 1 timeperiod variance (30 sec before/after)
            });
        } catch (error) {
            console.error('Error verifying token:', error);
            throw error;
        }
    },

    /**
     * Enable 2FA for a user
     * @param {string} userId - The user's ID
     * @param {string} secret - The secret in base32 format
     * @param {string} token - The token to verify before enabling
     * @returns {boolean} Whether 2FA was enabled successfully
     */
    enableTwoFactor: async (userId, secret, token) => {
        try {
            // Verify the token first
            const isValid = twoFactorService.verifyToken(secret, token);

            if (!isValid) {
                throw new Error('Invalid verification code');
            }

            // Generate backup codes
            const backupCodes = await twoFactorService.generateBackupCodes();
            const hashedBackupCodes = backupCodes.map(code =>
                crypto.createHash('sha256').update(code).digest('hex')
            );

            // Update the user
            await User.findByIdAndUpdate(userId, {
                'twoFactorAuth.enabled': true,
                'twoFactorAuth.secret': secret,
                'twoFactorAuth.backupCodes': hashedBackupCodes,
                'twoFactorAuth.lastUsed': new Date()
            });

            // Add security log
            await User.findByIdAndUpdate(userId, {
                $push: {
                    securityLogs: {
                        action: '2fa_setup',
                        timestamp: new Date(),
                        success: true,
                        details: 'Two-factor authentication enabled'
                    }
                }
            });

            // Return the plaintext backup codes for the user to save
            return {
                success: true,
                backupCodes
            };
        } catch (error) {
            console.error('Error enabling 2FA:', error);

            // Add security log for failed attempt
            if (userId) {
                try {
                    await User.findByIdAndUpdate(userId, {
                        $push: {
                            securityLogs: {
                                action: '2fa_setup',
                                timestamp: new Date(),
                                success: false,
                                details: `Failed to enable two-factor authentication: ${error.message}`
                            }
                        }
                    });
                } catch (logError) {
                    console.error('Error adding security log:', logError);
                }
            }

            throw error;
        }
    },

    /**
     * Disable 2FA for a user
     * @param {string} userId - The user's ID
     * @returns {boolean} Whether 2FA was disabled successfully
     */
    disableTwoFactor: async (userId) => {
        try {
            // Update the user
            await User.findByIdAndUpdate(userId, {
                'twoFactorAuth.enabled': false,
                'twoFactorAuth.secret': null,
                'twoFactorAuth.backupCodes': []
            });

            // Add security log
            await User.findByIdAndUpdate(userId, {
                $push: {
                    securityLogs: {
                        action: '2fa_setup',
                        timestamp: new Date(),
                        success: true,
                        details: 'Two-factor authentication disabled'
                    }
                }
            });

            return true;
        } catch (error) {
            console.error('Error disabling 2FA:', error);
            throw error;
        }
    },

    /**
     * Generate backup codes for a user
     * @param {number} count - Number of backup codes to generate
     * @returns {string[]} Array of backup codes
     */
    generateBackupCodes: async (count = 10) => {
        const codes = [];
        for (let i = 0; i < count; i++) {
            // Generate random bytes and convert to a readable code
            const bytes = crypto.randomBytes(4);
            // Convert to a readable format (8 characters, all numbers)
            const code = parseInt(bytes.toString('hex'), 16) % 100000000;
            // Pad with leading zeros if needed
            codes.push(code.toString().padStart(8, '0'));
        }
        return codes;
    },

    /**
     * Verify a backup code
     * @param {string} userId - The user's ID
     * @param {string} backupCode - The backup code to verify
     * @returns {boolean} Whether the backup code is valid
     */
    verifyBackupCode: async (userId, backupCode) => {
        try {
            // Find the user
            const user = await User.findById(userId);

            if (!user || !user.twoFactorAuth.enabled) {
                return false;
            }

            // Hash the provided backup code
            const hashedCode = crypto.createHash('sha256').update(backupCode).digest('hex');

            // Check if the hashed code is in the user's backup codes
            const index = user.twoFactorAuth.backupCodes.indexOf(hashedCode);

            if (index === -1) {
                return false;
            }

            // Remove the used backup code
            const updatedBackupCodes = [...user.twoFactorAuth.backupCodes];
            updatedBackupCodes.splice(index, 1);

            // Update the user
            await User.findByIdAndUpdate(userId, {
                'twoFactorAuth.backupCodes': updatedBackupCodes,
                'twoFactorAuth.lastUsed': new Date()
            });

            // Add security log
            await User.findByIdAndUpdate(userId, {
                $push: {
                    securityLogs: {
                        action: 'login',
                        timestamp: new Date(),
                        success: true,
                        details: 'Login with backup code'
                    }
                }
            });

            return true;
        } catch (error) {
            console.error('Error verifying backup code:', error);
            throw error;
        }
    },

    /**
     * Register a new device for a user
     * @param {string} userId - The user's ID
     * @param {string} deviceId - A unique identifier for the device
     * @param {string} deviceName - A human-readable name for the device
     * @param {string} ipAddress - The IP address of the device
     * @returns {boolean} Whether the device was registered successfully
     */
    registerDevice: async (userId, deviceId, deviceName, ipAddress) => {
        try {
            // Update the user
            await User.findByIdAndUpdate(userId, {
                $push: {
                    'twoFactorAuth.verifiedDevices': {
                        deviceId,
                        deviceName,
                        lastLogin: new Date(),
                        ipAddress
                    }
                }
            });

            // Add security log
            await User.findByIdAndUpdate(userId, {
                $push: {
                    securityLogs: {
                        action: 'login',
                        timestamp: new Date(),
                        success: true,
                        details: `New device registered: ${deviceName}`
                    }
                }
            });

            return true;
        } catch (error) {
            console.error('Error registering device:', error);
            throw error;
        }
    },

    /**
     * Check if a device is already verified for a user
     * @param {string} userId - The user's ID
     * @param {string} deviceId - The device ID to check
     * @returns {boolean} Whether the device is verified
     */
    isDeviceVerified: async (userId, deviceId) => {
        try {
            const user = await User.findById(userId);

            if (!user || !user.twoFactorAuth.enabled) {
                return false;
            }

            return user.twoFactorAuth.verifiedDevices.some(device => device.deviceId === deviceId);
        } catch (error) {
            console.error('Error checking device verification:', error);
            throw error;
        }
    }
};

module.exports = twoFactorService;
