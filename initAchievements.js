const mongoose = require('mongoose');
const Achievement = require('./models/Achievement');
const config = require('./config');

// Функція для ініціалізації базових досягнень
async function initAchievements() {
    console.log('🏆 Initializing achievements...');

    try {
        // Базовий набір досягнень
        const achievements = [
            // Соціальні досягнення
            {
                id: 'first_friend',
                name: 'Перший друг',
                description: 'Додайте свого першого друга',
                icon: '/images/achievements/first_friend.svg',
                color: '#4CAF50',
                category: 'social',
                tier: 1,
                criteria: 'user.friends.length > 0',
                xpReward: 10,
                displayOrder: 10
            },
            {
                id: 'social_butterfly',
                name: 'Соціальний метелик',
                description: 'Додайте 10 друзів',
                icon: '/images/achievements/social_butterfly.svg',
                color: '#4CAF50',
                category: 'social',
                tier: 2,
                criteria: 'user.friends.length >= 10',
                xpReward: 30,
                displayOrder: 20
            },
            {
                id: 'friend_groups',
                name: 'Організатор',
                description: 'Створіть 3 групи друзів',
                icon: '/images/achievements/friend_groups.svg',
                color: '#4CAF50',
                category: 'social',
                tier: 2,
                criteria: 'user.friendGroups.length >= 3',
                xpReward: 25,
                displayOrder: 30
            },

            // Досягнення локацій
            {
                id: 'explorer',
                name: 'Дослідник',
                description: 'Відвідайте 5 різних місць',
                icon: '/images/achievements/explorer.svg',
                color: '#FF9800',
                category: 'location',
                tier: 1,
                criteria: 'user.stats.locationsVisited >= 5',
                xpReward: 15,
                displayOrder: 40
            },
            {
                id: 'location_master',
                name: 'Майстер локацій',
                description: 'Поділіться 10 локаціями з друзями',
                icon: '/images/achievements/location_master.svg',
                color: '#FF9800',
                category: 'location',
                tier: 3,
                criteria: 'user.stats.locationsShared >= 10',
                xpReward: 40,
                displayOrder: 50
            },

            // Досягнення активності
            {
                id: 'daily_login',
                name: 'Щоденний відвідувач',
                description: 'Заходьте в додаток 3 дні поспіль',
                icon: '/images/achievements/daily_login.svg',
                color: '#2196F3',
                category: 'activity',
                tier: 1,
                criteria: 'user.stats.loginStreak >= 3',
                xpReward: 15,
                displayOrder: 60
            },
            {
                id: 'chatterbox',
                name: 'Балакун',
                description: 'Обміняйтеся 100 повідомленнями',
                icon: '/images/achievements/chatterbox.svg',
                color: '#2196F3',
                category: 'activity',
                tier: 2,
                criteria: 'user.stats.messagesExchanged >= 100',
                xpReward: 25,
                displayOrder: 70
            },

            // Досягнення профілю
            {
                id: 'complete_profile',
                name: 'Заповнений профіль',
                description: 'Повністю заповніть свій профіль (ім\'я, біо, аватар, інтереси)',
                icon: '/images/achievements/complete_profile.svg',
                color: '#9C27B0',
                category: 'profile',
                tier: 1,
                criteria: 'hasFullProfile',
                xpReward: 20,
                displayOrder: 80
            },

            // Приховані досягнення
            {
                id: 'night_owl',
                name: 'Нічна сова',
                description: 'Будьте активні після опівночі',
                icon: '/images/achievements/night_owl.svg',
                color: '#607D8B',
                category: 'special',
                tier: 1,
                criteria: 'isNightTime',
                xpReward: 15,
                displayOrder: 200,
                isHidden: true
            },
            {
                id: 'invisible_man',
                name: 'Невидимка',
                description: 'Увімкніть режим невидимки на 24 години',
                icon: '/images/achievements/invisible_man.svg',
                color: '#607D8B',
                category: 'special',
                tier: 2,
                criteria: 'user.privacyMode.isInvisible',
                xpReward: 30,
                displayOrder: 210,
                isHidden: true
            }
        ];

        // Перевірити і додати кожне досягнення, якщо воно ще не існує
        for (const achievement of achievements) {
            const existingAchievement = await Achievement.findOne({ id: achievement.id });

            if (!existingAchievement) {
                await Achievement.create(achievement);
                console.log(`✅ Created achievement: ${achievement.name}`);
            } else {
                // Оновлюємо існуюче досягнення
                Object.assign(existingAchievement, achievement);
                await existingAchievement.save();
                console.log(`🔄 Updated achievement: ${achievement.name}`);
            }
        }

        console.log('🎉 All achievements initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing achievements:', error);
    }
}

// Автоматично запускаємо ініціалізацію, якщо файл виконується безпосередньо
if (require.main === module) {
    // З'єднуємось з базою даних
    mongoose.connect(config.dbUrl, config.dbOptions)
        .then(() => {
            console.log('✅ Connected to MongoDB');
            return initAchievements();
        })
        .then(() => {
            console.log('✅ Achievements initialization complete');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Error:', err);
            process.exit(1);
        });
} else {
    // Експортуємо функцію для використання в інших модулях
    module.exports = initAchievements;
}
