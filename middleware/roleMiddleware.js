const jwt = require('jsonwebtoken');
const { secret } = require('../config');

module.exports = function(roles) {
    return function(req, res, next) {
        if (req.method === "OPTIONS") {
            next();
        }

        try {
            // User should already be authenticated by authMiddleware
            if (!req.user) {
                return res.status(401).json({message: "User not authorized"});
            }

            const {roles: userRoles} = req.user;

            // Check if user has any of the required roles
            let hasRole = false;
            if (userRoles && Array.isArray(userRoles)) {
                roles.forEach(role => {
                    if (userRoles.includes(role)) {
                        hasRole = true;
                    }
                });
            }

            if (!hasRole) {
                return res.status(403).json({message: "Access denied: insufficient permissions"});
            }

            next();
        } catch (e) {
            console.error('Role middleware error:', e.message);
            return res.status(403).json({message: "Access denied"});
        }
    };
};
