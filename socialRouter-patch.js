/**
 * Цей файл містить патч для socialRouter.js
 * Щоб застосувати зміни, скопіюйте наступні функції в кінець файлу socialRouter.js перед module.exports
 */

// Допоміжні функції для роботи з мок-даними
const socialEnhancements = require('./social-enhancements');

// Додатковий роут для перевірки тестових користувачів
if (global.USE_MOCK_DB) {
  router.get('/test-users', authMiddleware, async (req, res) => {
    try {
      console.log('Забезпечення наявності тестових користувачів...');

      // Переконатись, що всі тестові користувачі завантажені
      socialEnhancements.ensureTestUsers();

      // Отримати всіх користувачів
      const users = await socialEnhancements.getAllUsers();

      console.log(`Знайдено ${users.length} тестових користувачів`);

      // Відправка списку користувачів (без чутливих даних)
      const safeUsers = users.map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName || '',
        bio: user.bio || '',
        avatar: user.avatar || 'images/default-avatar.svg',
        roles: user.roles || ['USER']
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('[Test Users Error]:', error);
      res.status(500).json({ message: 'Server error getting test users' });
    }
  });

  // Роут для встановлення конкретного користувача як поточного (для тестування)
  router.post('/test-login/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // Перевірити, чи існує користувач
      const users = socialEnhancements.getMockCollection('users');
      const user = users.find(u => u._id === userId);

      if (!user) {
        return res.status(404).json({ message: 'Test user not found' });
      }

      // Створити JWT токен для користувача
      const token = jwt.sign(
        { id: user._id, username: user.username, roles: user.roles || ['USER'] },
        config.secret,
        { expiresIn: '24h' }
      );

      // Відправити відповідь
      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName || '',
          avatar: user.avatar || 'images/default-avatar.svg',
          roles: user.roles || ['USER']
        }
      });
    } catch (error) {
      console.error('[Test Login Error]:', error);
      res.status(500).json({ message: 'Server error during test login' });
    }
  });
}
