document.addEventListener('DOMContentLoaded', () => {
	const loginForm = document.getElementById('loginForm')

	if (!loginForm) {
		console.error('Форма входу не знайдена!')
		return
	}

	loginForm.addEventListener('submit', async event => {
		event.preventDefault()

		const identifier = document.getElementById('identifier').value
		const password = document.getElementById('password').value

		const response = await fetch('/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier, password }),
		})

		const data = await response.json()
		console.log('Отримані дані:', data) // Додаємо лог для перевірки

		if (response.ok) {
			// ✅ Зберігаємо дані користувача в localStorage
			localStorage.setItem('user', JSON.stringify(data.user))

			window.location.href = data.redirect // Перенаправлення на profile.html
		} else {
			alert(data.message)
		}
	})

	// Додаємо код для налаштування тестових користувачів у режимі USE_MOCK_DB
	const setupMockUsers = () => {
		// Перевіряємо, чи включений режим мок-бази
		if (global.USE_MOCK_DB) {
			console.log('📝 Налаштування тестових користувачів для мок-режиму...');

			try {
				// Загальна мапа для зберігання мок-даних
				global.mockDatabase = global.mockDatabase || {};

				// Завантажуємо тестові дані
				const { testUsers, testMessages, testConversations } = require('./local-test-users');

				// Зберігаємо в глобальній змінній для доступу з інших модулів
				global.mockDatabase.users = testUsers;
				global.mockDatabase.messages = testMessages;
				global.mockDatabase.conversations = testConversations;

				console.log(`✅ Завантажено ${testUsers.length} тестових користувачів`);
				console.log(`✅ Завантажено ${testMessages.length} тестових повідомлень`);
				console.log(`✅ Завантажено ${testConversations.length} тестових розмов`);
				console.log('✅ Тестові облікові дані: testuser1 / password123');
			} catch (error) {
				console.error('❌ Помилка при налаштуванні тестових користувачів:', error);
			}
		}
	};

	// Викликаємо функцію налаштування мок-користувачів
	setupMockUsers();

	// Оновлення статусу активності
	app.use(async (req, res, next) => {
	  // Оновлюємо статус користувача тільки при авторизованих запитах
	  if (req.user && req.user.id) {
	    try {
	      // Оновити lastActive поле
	      await User.findByIdAndUpdate(req.user.id, {
	        lastActive: new Date()
	      });
	    } catch (error) {
	      console.error('Error updating user activity status:', error);
	    }
	  }
	  next();
	});
})
