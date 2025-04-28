const Router = require('express');
const router = new Router();
const controller = require('./authController');
const authMiddleware = require('./middleware/authMiddleware');
const roleMiddleware = require('./middleware/roleMiddleware');
const { check } = require('express-validator');

// Registration - with email verification
router.post('/registration', [
    check('username', 'Username cannot be empty').notEmpty(),
    check('username', 'Username must be between 3 and 20 characters').isLength({min: 3, max: 20}),
    check('email', 'Invalid email format').isEmail(),
    check('password', 'Password must be between 6 and 20 characters').isLength({min: 6, max: 20})
], controller.registration);

// Login
router.post('/login', controller.login);

// Logout
router.post('/logout', controller.logout);

// Validate token
router.get('/validate-token', authMiddleware, controller.validateToken);

// Get users (admin only)
router.get('/users', [
    authMiddleware,
    roleMiddleware(['ADMIN'])
], controller.getUsers);

// Email verification
router.get('/verify', controller.verifyEmail);

// Request password reset
router.post('/forgot-password', controller.requestPasswordReset);

// Reset password with token
router.post('/reset-password', controller.resetPassword);

// Get current user
router.get('/current', authMiddleware, controller.getCurrentUser);

// Resend verification email
router.post('/resend-verification', controller.resendVerification);

// Biometric authentication routes
// Register device for biometric auth
router.post('/biometric/register', authMiddleware, controller.registerBiometric);

// Authenticate with biometric data
router.post('/biometric/verify', controller.verifyBiometric);

// Remove biometric registration
router.delete('/biometric/unregister', authMiddleware, controller.unregisterBiometric);

// List registered biometric devices
router.get('/biometric/devices', authMiddleware, controller.listBiometricDevices);

// Session management routes
// List all active sessions
router.get('/sessions', authMiddleware, controller.listActiveSessions);

// End specific session
router.delete('/sessions/:sessionId', authMiddleware, controller.endSession);

// End all sessions except current
router.delete('/sessions', authMiddleware, controller.endAllSessions);

// Admin authentication monitoring routes
// Get all user authentication patterns
router.get('/admin/auth-patterns', [
    authMiddleware,
    roleMiddleware(['ADMIN'])
], controller.getUserAuthPatterns);

// Get login statistics (success/fail counts, auth methods used, etc.)
router.get('/admin/login-stats', [
    authMiddleware,
    roleMiddleware(['ADMIN'])
], controller.getLoginStats);

// Get currently active sessions for all users
router.get('/admin/active-sessions', [
    authMiddleware,
    roleMiddleware(['ADMIN'])
], controller.getAllActiveSessions);

module.exports = router;
