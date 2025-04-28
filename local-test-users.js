// Модуль для створення тестових користувачів

// Тестові користувачі для демонстрації
const testUsers = [
  {
    _id: '1',
    username: 'testuser1',
    email: 'testuser1@example.com',
    password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXX', // Хешований пароль: password123
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
    interests: ['подорожі', 'фотографія', 'технології'],
    friends: ['2', '3'],
    friendRequests: {
      sent: ['4'],
      received: ['5']
    }
  },
  {
    _id: '2',
    username: 'testuser2',
    email: 'testuser2@example.com',
    password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXX',
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
    interests: ['музика', 'кіно', 'спорт'],
    friends: ['1']
  },
  {
    _id: '3',
    username: 'testuser3',
    email: 'testuser3@example.com',
    password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXX',
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
    interests: ['книги', 'мистецтво', 'кулінарія'],
    friends: ['1']
  },
  {
    _id: '4',
    username: 'testuser4',
    email: 'testuser4@example.com',
    password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXX',
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
    interests: ['програмування', 'наука', 'освіта'],
    friendRequests: {
      received: ['1']
    }
  },
  {
    _id: '5',
    username: 'adminuser',
    email: 'admin@example.com',
    password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXX',
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
    interests: ['адміністрування', 'безпека', 'аналітика'],
    friendRequests: {
      sent: ['1']
    }
  }
];

// Тестові повідомлення для демонстрації
const testMessages = [
  {
    _id: '1',
    sender: '1',
    recipient: '2',
    content: 'Привіт! Як справи?',
    read: true,
    createdAt: new Date(Date.now() - 3600000) // 1 година тому
  },
  {
    _id: '2',
    sender: '2',
    recipient: '1',
    content: 'Привіт! Все добре, дякую! Як у тебе?',
    read: true,
    createdAt: new Date(Date.now() - 3500000) // 58 хвилин тому
  },
  {
    _id: '3',
    sender: '1',
    recipient: '2',
    content: 'Теж непогано. Хотів запитати, чи не хочеш зустрітися завтра?',
    read: true,
    createdAt: new Date(Date.now() - 3400000) // 56 хвилин тому
  },
  {
    _id: '4',
    sender: '2',
    recipient: '1',
    content: 'Так, звісно! О котрій годині?',
    read: false, // Непрочитане повідомлення
    createdAt: new Date(Date.now() - 3300000) // 55 хвилин тому
  },
  {
    _id: '5',
    sender: '3',
    recipient: '1',
    content: 'Привіт! Бачив твою нову локацію на карті!',
    read: false,
    createdAt: new Date(Date.now() - 1800000) // 30 хвилин тому
  }
];

// Тестові розмови для демонстрації
const testConversations = [
  {
    _id: '1',
    participants: ['1', '2'],
    lastMessage: '4',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3300000),
    unreadCount: new Map([['1', 1]]) // 1 непрочитане повідомлення для користувача 1
  },
  {
    _id: '2',
    participants: ['1', '3'],
    lastMessage: '5',
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 1800000),
    unreadCount: new Map([['1', 1]]) // 1 непрочитане повідомлення для користувача 1
  }
];

// Експортуємо тестові дані
module.exports = {
  testUsers,
  testMessages,
  testConversations
};
