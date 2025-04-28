// Load environment variables from .env file
require('dotenv').config();

const config = {
    // Server configuration
    port: process.env.PORT || 5003,
    isProduction: process.env.NODE_ENV === 'production',

    // Database configuration
    dbUrl: process.env.DATABASE_URL || process.env.MONGODB_URI ||
           "mongodb+srv://smate:FdLqLy7fpWQni1Wg@clustera.hrqil.mongodb.net/era_platform?retryWrites=true&w=majority&appName=clustEra",
    databaseURL: process.env.DATABASE_URL || process.env.MONGODB_URI ||
           "mongodb+srv://smate:FdLqLy7fpWQni1Wg@clustera.hrqil.mongodb.net/era_platform?retryWrites=true&w=majority&appName=clustEra",
    dbOptions: {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4  // Use IPv4, skip trying IPv6
    },
    useMockDb: process.env.USE_MOCK_DB === 'true',

    // JWT configuration
    secret: process.env.JWT_SECRET || "SECRET_KEY_RANDOM",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

    // Email configuration
    emailService: process.env.EMAIL_SERVICE || "gmail",
    emailUser: process.env.EMAIL_USER,
    emailPassword: process.env.EMAIL_PASSWORD,
    emailFrom: process.env.EMAIL_FROM || "Era Platform <noreply@example.com>",

    // URLs
    baseUrl: process.env.BASE_URL || "http://localhost:5003",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5003",

    // Socket.io configuration
    socketReconnectAttempts: parseInt(process.env.SOCKET_RECONNECT_ATTEMPTS || "10"),
    socketReconnectDelay: parseInt(process.env.SOCKET_RECONNECT_DELAY || "1000"),

    // File upload limits
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB in bytes

    // Cors configuration
    allowedOrigins: [
        'http://localhost:5003',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'https://era-platform.netlify.app',
        'https://era-platform.railway.app'
    ],

    // Alias для CORS для сумісності зі старим кодом
    corsOrigins: [
        'http://localhost:5003',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'https://era-platform.netlify.app',
        'https://era-platform.railway.app'
    ]
};

module.exports = config;
