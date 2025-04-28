// Додаткові функції для соціальної мережі
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const authMiddleware = require('./middleware/authMiddleware');

// Розширені функції для роботи з друзями

// Отримати всіх друзів з додатковими даними
router.get('/friends/extended', authMiddleware, async (req, res) => {
  try {
    console.log(`Getting extended friends data for user: ${req.user.id}`);

    // Отримати користувача
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    let friends = [];
    if (global.USE_MOCK_DB) {
      // Для мок-бази даних
      if (user.friends && user.friends.length > 0) {
        friends = await Promise.all(
          user.friends.map(friendId => User.findById(friendId))
        );
        friends = friends.filter(f => f !== null);
      }
    } else {
      // Для MongoDB
      const populatedUser = await User.findById(req.user.id)
        .populate('friends', 'username fullName avatar lastActive bio currentLocation.isSharing');
      friends = populatedUser.friends || [];
    }

    // Отримати статус активності для кожного друга
    const friendsWithStatus = friends.map(friend => {
      const lastActive = friend.lastActive || new Date(0);
      const isOnline = (new Date() - lastActive) < 5 * 60 * 1000; // 5 хвилин

      return {
        _id: friend._id,
        username: friend.username,
        fullName: friend.fullName || '',
        avatar: friend.avatar || 'images/default-avatar.svg',
        isOnline,
        lastActive: friend.lastActive,
        bio: friend.bio || '',
        isSharing: friend.currentLocation && friend.currentLocation.isSharing
      };
    });

    res.json(friendsWithStatus);
  } catch (error) {
    console.error('[Get Extended Friends Error]:', error);
    res.status(500).json({ message: 'Помилка сервера при отриманні даних друзів' });
  }
});

// Отримати список користувачів, яких можна додати в друзі
router.get('/users/suggestions', authMiddleware, async (req, res) => {
  try {
    console.log(`Getting friend suggestions for user: ${req.user.id}`);

    // Отримати поточного користувача з його друзями та запитами
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Створити список ID, яких не треба включати
    const excludeIds = [
      req.user.id, // сам користувач
      ...user.friends, // його друзі
      ...user.friendRequests.sent, // відправлені запити
      ...user.friendRequests.received // отримані запити
    ];

    // Отримати можливих друзів
    let suggestedUsers = [];
    if (global.USE_MOCK_DB) {
      // Для мок-бази даних
      const allUsers = await User.find();
      suggestedUsers = allUsers.filter(u => !excludeIds.includes(u._id.toString()));
    } else {
      suggestedUsers = await User.find({
        _id: { $nin: excludeIds }
      })
      .select('username fullName avatar bio')
      .limit(10);
    }

    res.json(suggestedUsers);
  } catch (error) {
    console.error('[Get Friend Suggestions Error]:', error);
    res.status(500).json({ message: 'Помилка сервера при пошуку рекомендацій' });
  }
});

// Пошук користувачів за ім'ям та логіном
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Запит пошуку повинен містити принаймні 2 символи' });
    }

    // Здійснити пошук
    let users = [];
    if (global.USE_MOCK_DB) {
      // Для мок-бази даних
      const allUsers = await User.find();
      const lowerQuery = query.toLowerCase();
      users = allUsers.filter(u =>
        u._id.toString() !== req.user.id &&
        (u.username.toLowerCase().includes(lowerQuery) ||
         (u.fullName && u.fullName.toLowerCase().includes(lowerQuery)))
      );
    } else {
      users = await User.find({
        $and: [
          { _id: { $ne: req.user.id } }, // Виключаємо поточного користувача
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { fullName: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
      .select('username fullName avatar bio')
      .limit(10);
    }

    res.json(users);
  } catch (error) {
    console.error('[Search Users Error]:', error);
    res.status(500).json({ message: 'Помилка сервера при пошуку користувачів' });
  }
});

// Оновлення статусу активності
router.post('/update-activity', authMiddleware, async (req, res) => {
  try {
    // Оновити поле lastActive користувача
    await User.findByIdAndUpdate(req.user.id, {
      lastActive: new Date()
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Update Activity Error]:', error);
    res.status(500).json({ message: 'Помилка сервера при оновленні статусу активності' });
  }
});

module.exports = router;
