const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // Allow all origins for development
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Add mock users database
const mockUsers = [
  {
    id: 'user-1',
    username: 'user',
    email: 'user@example.com',
    password: 'password123'
  },
  {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123'
  },
  {
    id: 'test-1',
    username: 'test',
    email: 'test@example.com',
    password: 'test123'
  }
];

// Simple session storage
const activeTokens = new Map();

// Store some default tokens for testing
const addDefaultTokens = () => {
  mockUsers.forEach(user => {
    const token = `token-${user.id}-${Date.now() + 86400000}`; // Tokens last for 1 day
    activeTokens.set(token, {
      userId: user.id,
      username: user.username,
      email: user.email
    });
    console.log(`Added default token for ${user.username}: ${token.substring(0, 15)}...`);
  });
};

// Add some default tokens
addDefaultTokens();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth routes ---
app.post('/auth/login', (req, res) => {
    // Accept both username and identifier parameters
    const username = req.body.username || req.body.identifier;
    const password = req.body.password;

    console.log('Login attempt with credentials:', { username: username || 'not provided', password: password ? '****' : 'not provided' });

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if user exists by username or email
    const user = mockUsers.find(u =>
        u.username === username ||
        u.email === username
    );

    if (!user) {
        return res.status(401).json({ message: 'Invalid username or email' });
    }

    // Validate password
    if (user.password !== password) {
        return res.status(401).json({ message: 'Invalid password' });
    }

    console.log(`Login successful: ${username}`);

    // Generate a simple token
    const token = `token-${user.id}-${Date.now() + 86400000}`; // Tokens last for 1 day

    // Store token with user info
    activeTokens.set(token, {
        userId: user.id,
        username: user.username,
        email: user.email
    });

    res.json({
        message: 'Login successful',
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        },
        token: token
    });
});

app.post('/auth/registration', (req, res) => {
    const { username, email, password } = req.body;

    if (username && email && password) {
        // Check if username or email already exists
        const existingUser = mockUsers.find(u =>
            u.username === username ||
            u.email === email
        );

        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            if (existingUser.email === email) {
                return res.status(400).json({ message: 'Email already exists' });
            }
        }

        // Create new user
        const newUser = {
            id: `user-${mockUsers.length + 1}`,
            username,
            email,
            password
        };

        mockUsers.push(newUser);
        console.log(`Registration successful: ${username}, ${email}`);

        res.json({
            message: 'Registration successful',
            user: {
                id: newUser.id,
                username,
                email
            },
            redirect: '/profile.html'
        });
    } else {
        res.status(400).json({ message: 'Missing required fields' });
    }
});

// Middleware for token validation
function authenticateToken(req, res, next) {
    // Get token from Authorization header or query parameter
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.query.token;

    console.log(`Token validation request for path: ${req.path}`);
    console.log(`Authorization header present: ${!!authHeader}`);
    console.log(`Token extracted: ${token ? token.substring(0, 10) + '...' : 'none'}`);

    if (!token) {
        console.log('No token provided, authentication failed');
        return res.status(401).json({ message: 'Authentication token required' });
    }

    const userData = activeTokens.get(token);
    if (!userData) {
        console.log('Token not found in active tokens, authentication failed');
        console.log(`Active tokens: ${Array.from(activeTokens.keys()).length}`);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    console.log(`Authentication successful for user: ${userData.username}`);

    // Add user data to request
    req.user = userData;
    next();
}

// --- Profile routes ---
app.get('/profile/profile', authenticateToken, (req, res) => {
    console.log('Profile data requested for user:', req.user.username);

    // Get fresh data from mock database
    const user = mockUsers.find(u => u.id === req.user.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: 'default-avatar.svg'
    });
});

app.post('/profile/update-avatar', authenticateToken, (req, res) => {
    console.log('Avatar update requested for user:', req.user.username);
    res.json({
        message: 'Avatar updated successfully',
        avatarUrl: 'default-avatar.svg'
    });
});

// Add logout endpoint
app.post('/auth/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.query.token;

    if (token) {
        // Remove token from active tokens
        activeTokens.delete(token);
        console.log(`User ${req.user.username} logged out`);
    }

    res.json({ message: 'Logout successful' });
});

// Add token validation endpoint
app.get('/auth/validate-token', (req, res) => {
    // Get token from Authorization header or query parameter
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.query.token;

    console.log(`Token validation request at ${new Date().toISOString()}`);
    console.log(`Authorization header present: ${!!authHeader}`);

    if (!token) {
        return res.status(401).json({
            valid: false,
            message: 'Authentication token required'
        });
    }

    // Debug: Print all active tokens
    console.log('Active tokens:', Array.from(activeTokens.keys()).map(t => t.substring(0, 15) + '...'));

    const userData = activeTokens.get(token);
    if (!userData) {
        console.log(`Token not found: ${token.substring(0, 15)}...`);

        // For testing/demo purposes: Accept any token from localStorage if it follows our format
        // This is NOT secure but helps with debugging the login issue
        if (token.startsWith('token-')) {
            const parts = token.split('-');
            if (parts.length >= 3) {
                const userId = parts[1];
                const user = mockUsers.find(u => u.id === userId);
                if (user) {
                    console.log(`Regenerating token for user: ${user.username}`);
                    const newToken = `token-${user.id}-${Date.now() + 86400000}`; // New token with extended expiration
                    activeTokens.set(newToken, {
                        userId: user.id,
                        username: user.username,
                        email: user.email
                    });
                    return res.json({
                        valid: true,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email
                        }
                    });
                }
            }
        }

        return res.status(401).json({
            valid: false,
            message: 'Invalid or expired token',
            tokenCount: Array.from(activeTokens.keys()).length
        });
    }

    console.log(`Token validation successful for user: ${userData.username}`);

    res.json({
        valid: true,
        user: {
            id: userData.userId,
            username: userData.username,
            email: userData.email
        }
    });
});

// For /profile.html page load, we still need to send the file
app.get('/index.html', (req, res, next) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(filePath);
});

// Handle specific HTML routes one by one
app.get('/main.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'main.html');
    console.log(`Serving HTML page: main.html`);
    res.sendFile(filePath);
});

app.get('/auth.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'auth.html');
    console.log(`Serving HTML page: auth.html`);
    res.sendFile(filePath);
});

app.get('/profile.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'profile.html');
    console.log(`Serving HTML page: profile.html`);
    res.sendFile(filePath);
});

app.get('/chats.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'chats.html');
    console.log(`Serving HTML page: chats.html`);
    res.sendFile(filePath);
});

app.get('/map.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'map.html');
    console.log(`Serving HTML page: map.html`);
    res.sendFile(filePath);
});

app.get('/social-network.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'social-network.html');
    console.log(`Serving HTML page: social-network.html`);
    res.sendFile(filePath);
});

// Root and catch-all handler
app.get('/', (req, res) => {
    console.log(`Serving index.html for root path`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    console.log(`Fallback: serving index.html for path: ${req.path}`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Simple server started on port ${PORT}`);
    console.log(`✅ Open http://localhost:${PORT}/index.html to view the profile page`);
});
