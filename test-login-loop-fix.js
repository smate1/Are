/**
 * Тестовий скрипт для перевірки і виправлення проблеми з циклом авторизації
 *
 * Запуск: node test-login-loop-fix.js
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Налаштування
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'test_secret_key';

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Функція для генерації JWT токена
function generateToken(userId, username) {
  return jwt.sign(
    { id: userId, username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Тестовий маршрут для авторизації
app.post('/auth/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  console.log('Login attempt:', { username, password: '****', rememberMe });

  // Прості перевірки для тестового користувача
  if (username === 'testuser' && password === 'password123') {
    const token = generateToken('123', username);

    // Створюємо об'єкт користувача
    const user = {
      id: '123',
      username,
      email: 'test@example.com',
      roles: ['USER'],
      avatar: 'images/default-avatar.svg',
      isVerified: true
    };

    // Встановлюємо cookie з токеном
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 днів або 24 години
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Повертаємо дані про користувача
    return res.json({
      token,
      user,
      expiresIn: rememberMe ? '30d' : '24h',
      rememberMe
    });
  } else {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
});

// Перевірка токена
app.get('/auth/validate-token', (req, res) => {
  try {
    // Отримуємо токен з різних джерел
    let token = null;

    // З заголовка Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // З cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    // Верифікація токена
    const decoded = jwt.verify(token, JWT_SECRET);

    // Успішна верифікація
    return res.json({
      valid: true,
      user: {
        id: decoded.id,
        username: decoded.username
      }
    });
  } catch (error) {
    console.error('Token validation error:', error.message);
    return res.status(401).json({ message: 'Invalid token: ' + error.message });
  }
});

// Отримання профілю користувача
app.get('/profile/profile', (req, res) => {
  try {
    // Отримуємо токен з різних джерел
    let token = null;

    // З заголовка Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // З cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    // Верифікація токена
    const decoded = jwt.verify(token, JWT_SECRET);

    // Повертаємо тестові дані профілю
    return res.json({
      id: decoded.id,
      username: decoded.username,
      email: 'test@example.com',
      fullName: 'Test User',
      bio: 'This is a test user account',
      avatar: 'images/default-avatar.svg',
      interests: ['travel', 'technology', 'photography'],
      location: 'Test City',
      website: 'https://example.com',
      socialLinks: {
        facebook: 'https://facebook.com/testuser',
        twitter: 'https://twitter.com/testuser',
        instagram: 'https://instagram.com/testuser',
        linkedin: 'https://linkedin.com/in/testuser'
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    return res.status(401).json({ message: 'Authentication error: ' + error.message });
  }
});

// Обробка виходу з облікового запису
app.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to test`);
  console.log('Use test credentials: username="testuser", password="password123"');
});
