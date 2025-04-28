const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const Achievement = require('./models/Achievement');
const User = mongoose.model('User');

// Отримати всі доступні досягнення
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Отримати всі активні досягнення, не приховані (якщо не передано параметр includeHidden)
        const includeHidden = req.query.includeHidden === 'true';
        const category = req.query.category;

        let query = { isEnabled: true };

        if (!includeHidden) {
            query.isHidden = false;
        }

        if (category) {
            query.category = category;
        }

        const achievements = await Achievement.find(query).sort('displayOrder category');

        res.json(achievements);
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ message: 'Server error fetching achievements' });
    }
});

// Отримати досягнення користувача
router.get('/user', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Отримати користувача з його досягненнями
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Отримати повні деталі для кожного досягнення користувача
        const userAchievements = [];

        if (user.achievements && user.achievements.length > 0) {
            for (const userAchievement of user.achievements) {
                const achievementDetails = await Achievement.findOne({ id: userAchievement.achievementId });

                if (achievementDetails) {
                    userAchievements.push({
                        ...achievementDetails.toObject(),
                        progress: userAchievement.progress,
                        unlockedAt: userAchievement.unlockedAt,
                        displayed: userAchievement.displayed
                    });
                }
            }
        }

        res.json(userAchievements);
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        res.status(500).json({ message: 'Server error fetching user achievements' });
    }
});

// Перевірити всі досягнення для користувача
router.post('/check', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Викликати метод перевірки всіх досягнень
        const unlockedAchievements = await Achievement.checkAllForUser(userId);

        res.json({
            message: 'Achievements checked successfully',
            unlockedAchievements,
            count: unlockedAchievements.length
        });
    } catch (error) {
        console.error('Error checking achievements:', error);
        res.status(500).json({ message: 'Server error checking achievements' });
    }
});

// Позначити досягнення як переглянуте
router.post('/:achievementId/display', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { achievementId } = req.params;

        // Знайти користувача і оновити статус відображення досягнення
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Знайти досягнення у списку користувача
        const achievementIndex = user.achievements.findIndex(a => a.achievementId === achievementId);

        if (achievementIndex === -1) {
            return res.status(404).json({ message: 'Achievement not found for this user' });
        }

        // Оновити статус відображення
        user.achievements[achievementIndex].displayed = true;
        await user.save();

        res.json({ message: 'Achievement marked as displayed', achievementId });
    } catch (error) {
        console.error('Error marking achievement as displayed:', error);
        res.status(500).json({ message: 'Server error updating achievement' });
    }
});

// Отримати статистику для досягнень
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        // Перевірка на адміністратора
        if (!req.user.roles.includes('ADMIN')) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Отримати статистику по досягненнях
        const achievements = await Achievement.find();
        const stats = {
            total: achievements.length,
            enabled: achievements.filter(a => a.isEnabled).length,
            hidden: achievements.filter(a => a.isHidden).length,
            byCategory: {},
            byTier: {},
            mostUnlocked: []
        };

        // Підрахувати по категоріях
        achievements.forEach(achievement => {
            // По категоріям
            if (!stats.byCategory[achievement.category]) {
                stats.byCategory[achievement.category] = 0;
            }
            stats.byCategory[achievement.category]++;

            // По рівнях
            if (!stats.byTier[achievement.tier]) {
                stats.byTier[achievement.tier] = 0;
            }
            stats.byTier[achievement.tier]++;
        });

        // Найбільш розблоковані досягнення
        stats.mostUnlocked = achievements
            .sort((a, b) => b.timesUnlocked - a.timesUnlocked)
            .slice(0, 5)
            .map(a => ({
                id: a.id,
                name: a.name,
                timesUnlocked: a.timesUnlocked
            }));

        res.json(stats);
    } catch (error) {
        console.error('Error fetching achievement stats:', error);
        res.status(500).json({ message: 'Server error fetching achievement stats' });
    }
});

module.exports = router;
