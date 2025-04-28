const jwt = require('jsonwebtoken');
const { secret } = require('../config');

module.exports = function (req, res, next) {
    if (req.method === "OPTIONS") {
        next();
    }

    try {
        // Get token from headers, cookies, or query
        let token = null;

        // Check authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // Check cookies if no token in header
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // Check query params if still no token
        if (!token && req.query && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({
                message: "User not authorized"
            });
        }

        // Verify token
        const decodedData = jwt.verify(token, secret);

        // Add user and sessionId to request
        req.user = decodedData;
        if (decodedData.sessionId) {
            req.sessionId = decodedData.sessionId;
        }

        next();
    } catch (e) {
        console.error('Auth middleware error:', e.message);
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};
