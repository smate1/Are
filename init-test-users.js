const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Встановлення прапорця для використання мок-даних
global.USE_MOCK_DB = true;

// Завантаження моделей
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// Функція для створення тестових користувачів
async function createTestUsers() {
  console.log('📝 Створення тестових користувачів...');

  try {
    // Перевірка, чи вже існують користувачі
    const existingUsers = await User.find({});
    if (existingUsers.length > 0) {
      console.log(`✅ ${existingUsers.length} тестових користувачів вже існує`);
      return existingUsers;
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Створення тестових користувачів
    const users = [
      {
        username: 'testuser1',
        email: 'testuser1@example.com',
        password: hashedPassword,
        fullName: 'Тестовий Користувач 1',
        bio: 'Тестовий акаунт для демонстрації платформи Era',
        avatar: 'images/avatars/twitter-avatar.svg',
        roles: ['USER'],
        isVerified: true,
        currentLocation: {
          type: 'Point',
          coordinates: [30.5234, 50.4501], // Київ
          lastUpdated: new Date(),
          isSharing: true
        },
        shareLocation: true,
        interests: ['подорожі', 'фотографія', 'технології']
      },
      {
        username: 'testuser2',
        email: 'testuser2@example.com',
        password: hashedPassword,
        fullName: 'Тестовий Користувач 2',
        bio: 'Другий тестовий акаунт для демонстрації',
        avatar: 'images/avatars/facebook-avatar.svg',
        roles: ['USER'],
        isVerified: true,
        currentLocation: {
          type: 'Point',
          coordinates: [30.5264, 50.4511], // Трохи північніше Києва
          lastUpdated: new Date(),
          isSharing: true
        },
        shareLocation: true,
        interests: ['музика', 'кіно', 'спорт']
      },
      {
        username: 'testuser3',
        email: 'testuser3@example.com',
        password: hashedPassword,
        fullName: 'Тестовий Користувач 3',
        bio: 'Третій тестовий акаунт для демонстрації',
        avatar: 'images/avatars/google-avatar.svg',
        roles: ['USER'],
        isVerified: true,
        currentLocation: {
          type: 'Point',
          coordinates: [30.5280, 50.4532], // Ще трохи північніше
          lastUpdated: new Date(),
          isSharing: true
        },
        shareLocation: true,
        interests: ['книги', 'мистецтво', 'кулінарія']
      },
      {
        username: 'testuser4',
        email: 'testuser4@example.com',
        password: hashedPassword,
        fullName: 'Тестовий Користувач 4',
        bio: 'Четвертий тестовий акаунт для демонстрації',
        avatar: 'images/avatars/github-avatar.svg',
        roles: ['USER'],
        isVerified: true,
        currentLocation: {
          type: 'Point',
          coordinates: [30.5214, 50.4523], // Західніше
          lastUpdated: new Date(),
          isSharing: true
        },
        shareLocation: true,
        interests: ['програмування', 'наука', 'освіта']
      },
      {
        username: 'adminuser',
        email: 'admin@example.com',
        password: hashedPassword,
        fullName: 'Адміністратор',
        bio: 'Адміністратор системи',
        avatar: 'images/default-avatar.svg',
        roles: ['USER', 'ADMIN'],
        isVerified: true,
        currentLocation: {
          type: 'Point',
          coordinates: [30.5238, 50.4503], // Центр Києва
          lastUpdated: new Date(),
          isSharing: true
        },
        shareLocation: true,
        interests: ['адміністрування', 'безпека', 'аналітика']
      }
    ];

    // Збереження користувачів
    const createdUsers = await User.insertMany(users);
    console.log(`✅ Створено ${createdUsers.length} тестових користувачів`);

    // Налаштування зв'язків між користувачами (друзі, запити дружби)
    await setupUserRelationships(createdUsers);

    // Налаштування тестових повідомлень
    await setupTestMessages(createdUsers);

    return createdUsers;
  } catch (error) {
    console.error('❌ Помилка при створенні тестових користувачів:', error);
    throw error;
  }
}

// Налаштувати зв'язки між користувачами
async function setupUserRelationships(users) {
  try {
    // Користувач 1 має 2 і 3 у друзях
    // Користувач 1 надіслав запит до користувача 4
    // Користувач 5 (адмін) надіслав запит до користувача 1

    const user1 = users[0];
    const user2 = users[1];
    const user3 = users[2];
    const user4 = users[3];
    const admin = users[4];

    // Додати друзів для користувача 1
    user1.friends = [user2._id, user3._id];
    user1.friendRequests = {
      sent: [user4._id],
      received: [admin._id]
    };

    // Оновити дружбу для користувача 2
    user2.friends = [user1._id];

    // Оновити дружбу для користувача 3
    user3.friends = [user1._id];

    // Запит на дружбу для користувача 4
    user4.friendRequests = {
      received: [user1._id]
    };

    // Запит на дружбу для адміна
    admin.friendRequests = {
      sent: [user1._id]
    };

    // Збереження змін
    await Promise.all([
      user1.save(),
      user2.save(),
      user3.save(),
      user4.save(),
      admin.save()
    ]);

    console.log('✅ Налаштовано відносини між користувачами (друзі, запити)');
  } catch (error) {
    console.error('❌ Помилка при налаштуванні зв\'язків між користувачами:', error);
    throw error;
  }
}

// Налаштувати тестові повідомлення
async function setupTestMessages(users) {
  try {
    const user1 = users[0];
    const user2 = users[1];
    const user3 = users[2];

    // Створити повідомлення між користувачами 1 і 2
    const message1 = new Message({
      sender: user1._id,
      recipient: user2._id,
      content: 'Привіт! Як справи?',
      read: true,
      createdAt: new Date(Date.now() - 3600000) // 1 година тому
    });
    await message1.save();

    const message2 = new Message({
      sender: user2._id,
      recipient: user1._id,
      content: 'Привіт! Все добре, дякую! Як у тебе?',
      read: true,
      createdAt: new Date(Date.now() - 3500000) // 58 хвилин тому
    });
    await message2.save();

    const message3 = new Message({
      sender: user1._id,
      recipient: user2._id,
      content: 'Теж непогано. Хотів запитати, чи не хочеш зустрітися завтра?',
      read: true,
      createdAt: new Date(Date.now() - 3400000) // 56 хвилин тому
    });
    await message3.save();

    const message4 = new Message({
      sender: user2._id,
      recipient: user1._id,
      content: 'Так, звісно! О котрій годині?',
      read: false, // Непрочитане повідомлення
      createdAt: new Date(Date.now() - 3300000) // 55 хвилин тому
    });
    await message4.save();

    // Створити розмову між користувачами 1 і 2
    const conversation1 = new Conversation({
      participants: [user1._id, user2._id],
      lastMessage: message4._id,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3300000),
      unreadCount: new Map([[user1._id.toString(), 1]]) // 1 непрочитане повідомлення для користувача 1
    });
    await conversation1.save();

    // Створити повідомлення між користувачами 1 і 3
    const message5 = new Message({
      sender: user3._id,
      recipient: user1._id,
      content: 'Привіт! Бачив твою нову локацію на карті!',
      read: false,
      createdAt: new Date(Date.now() - 1800000) // 30 хвилин тому
    });
    await message5.save();

    // Створити розмову між користувачами 1 і 3
    const conversation2 = new Conversation({
      participants: [user1._id, user3._id],
      lastMessage: message5._id,
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date(Date.now() - 1800000),
      unreadCount: new Map([[user1._id.toString(), 1]]) // 1 непрочитане повідомлення для користувача 1
    });
    await conversation2.save();

    console.log('✅ Налаштовано тестові повідомлення та розмови');
  } catch (error) {
    console.error('❌ Помилка при налаштуванні тестових повідомлень:', error);
    throw error;
  }
}

// Запуск функції створення тестових користувачів
createTestUsers()
  .then(() => {
    console.log('✅ Ініціалізація тестових користувачів завершена успішно!');
    console.log('✅ Тестові облікові дані: testuser1 / password123');
    mongoose.connection.close();
  })
  .catch(error => {
    console.error('❌ Помилка при ініціалізації тестових користувачів:', error);
    mongoose.connection.close();
  });
