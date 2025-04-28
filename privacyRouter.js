const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const User = mongoose.model('User');

// Отримати поточні налаштування приватності
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Зібрати всі налаштування приватності
        const privacySettings = {
            shareLocation: user.shareLocation || false,
            showOnlineStatus: user.showOnlineStatus !== false, // Default is true
            publicProfile: user.publicProfile || false,
            privacyMode: user.privacyMode || {
                isInvisible: false,
                invisibleUntil: null,
                visibleTo: [],
                visibleToGroups: []
            }
        };

        res.json(privacySettings);
    } catch (error) {
        console.error('Error getting privacy settings:', error);
        res.status(500).json({ message: 'Server error getting privacy settings' });
    }
});

// Оновити налаштування приватності
router.put('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { shareLocation, showOnlineStatus, publicProfile, privacyMode } = req.body;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Оновити базові налаштування
        if (shareLocation !== undefined) user.shareLocation = shareLocation;
        if (showOnlineStatus !== undefined) user.showOnlineStatus = showOnlineStatus;
        if (publicProfile !== undefined) user.publicProfile = publicProfile;

        // Також оновити isSharing в currentLocation, якщо вказано shareLocation
        if (shareLocation !== undefined && user.currentLocation) {
            user.currentLocation.isSharing = shareLocation;
        }

        // Оновити налаштування режиму приватності
        if (privacyMode) {
            // Ініціалізувати об'єкт privacyMode, якщо він ще не існує
            if (!user.privacyMode) {
                user.privacyMode = {
                    isInvisible: false,
                    invisibleUntil: null,
                    visibleTo: [],
                    visibleToGroups: []
                };
            }

            // Оновити поля, якщо вони передані
            if (privacyMode.isInvisible !== undefined) {
                user.privacyMode.isInvisible = privacyMode.isInvisible;

                // Якщо активовано режим невидимості, встановити час закінчення
                if (privacyMode.isInvisible) {
                    // Встановити кінцевий час невидимості (за замовчуванням 8 годин від поточного часу)
                    const duration = privacyMode.durationHours || 8;
                    const invisibleUntil = new Date();
                    invisibleUntil.setHours(invisibleUntil.getHours() + duration);
                    user.privacyMode.invisibleUntil = invisibleUntil;
                } else {
                    // Якщо режим вимкнено, скинути час
                    user.privacyMode.invisibleUntil = null;
                }
            }

            // Оновити список користувачів, які все одно бачать цього користувача
            if (privacyMode.visibleTo) {
                // Перевіряємо, що всі користувачі із списку є друзями
                const validVisibleTo = privacyMode.visibleTo.filter(id =>
                    user.friends.some(friendId => friendId.toString() === id)
                );

                user.privacyMode.visibleTo = validVisibleTo;
            }

            // Оновити список груп, для яких користувач все одно видимий
            if (privacyMode.visibleToGroups) {
                // Перевіряємо, що всі групи існують
                const validGroups = privacyMode.visibleToGroups.filter(groupName =>
                    user.friendGroups && user.friendGroups.some(g => g.name === groupName)
                );

                user.privacyMode.visibleToGroups = validGroups;
            }
        }

        // Якщо перетворюємося на невидимку, створимо перевірку досягнення
        if (privacyMode && privacyMode.isInvisible && !user.privacyMode.isInvisible) {
            if (global.checkAchievements) {
                global.checkAchievements(userId, 'invisible_man');
            }
        }

        // Зберегти користувача
        await user.save();

        res.json({
            message: 'Privacy settings updated successfully',
            privacySettings: {
                shareLocation: user.shareLocation,
                showOnlineStatus: user.showOnlineStatus,
                publicProfile: user.publicProfile,
                privacyMode: user.privacyMode
            }
        });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({ message: 'Server error updating privacy settings' });
    }
});

// Увімкнути режим невидимості на певний час
router.post('/invisible', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { durationHours, visibleTo, visibleToGroups } = req.body;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ініціалізувати об'єкт privacyMode, якщо він ще не існує
        if (!user.privacyMode) {
            user.privacyMode = {
                isInvisible: false,
                invisibleUntil: null,
                visibleTo: [],
                visibleToGroups: []
            };
        }

        // Встановити режим невидимості
        user.privacyMode.isInvisible = true;

        // Встановити час закінчення невидимості
        const duration = durationHours || 8; // За замовчуванням 8 годин
        const invisibleUntil = new Date();
        invisibleUntil.setHours(invisibleUntil.getHours() + duration);
        user.privacyMode.invisibleUntil = invisibleUntil;

        // Оновити список користувачів, які все одно бачать цього користувача
        if (visibleTo && Array.isArray(visibleTo)) {
            // Перевіряємо, що всі користувачі із списку є друзями
            const validVisibleTo = visibleTo.filter(id =>
                user.friends.some(friendId => friendId.toString() === id)
            );

            user.privacyMode.visibleTo = validVisibleTo;
        }

        // Оновити список груп, для яких користувач все одно видимий
        if (visibleToGroups && Array.isArray(visibleToGroups)) {
            // Перевіряємо, що всі групи існують
            const validGroups = visibleToGroups.filter(groupName =>
                user.friendGroups && user.friendGroups.some(g => g.name === groupName)
            );

            user.privacyMode.visibleToGroups = validGroups;
        }

        // Перевірити досягнення
        if (global.checkAchievements) {
            global.checkAchievements(userId, 'invisible_man');
        }

        // Зберегти користувача
        await user.save();

        res.json({
            message: 'Invisibility mode enabled',
            invisibleUntil,
            durationHours: duration
        });
    } catch (error) {
        console.error('Error enabling invisibility mode:', error);
        res.status(500).json({ message: 'Server error enabling invisibility mode' });
    }
});

// Вимкнути режим невидимості
router.delete('/invisible', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірити, чи ввімкнено режим невидимості
        if (!user.privacyMode || !user.privacyMode.isInvisible) {
            return res.status(400).json({ message: 'Invisibility mode is not active' });
        }

        // Вимкнути режим невидимості
        user.privacyMode.isInvisible = false;
        user.privacyMode.invisibleUntil = null;

        // Зберегти користувача
        await user.save();

        res.json({ message: 'Invisibility mode disabled' });
    } catch (error) {
        console.error('Error disabling invisibility mode:', error);
        res.status(500).json({ message: 'Server error disabling invisibility mode' });
    }
});

// Перевірити, чи видимий користувач для певного іншого користувача
router.get('/is-visible/:targetUserId', authMiddleware, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { targetUserId } = req.params;

        // Знайти цільового користувача
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        // Перевірити, чи знаходиться цільовий користувач у режимі невидимості
        const isInvisible = targetUser.privacyMode &&
                          targetUser.privacyMode.isInvisible &&
                          targetUser.privacyMode.invisibleUntil > new Date();

        // Якщо режим невидимості не активний, користувач видимий
        if (!isInvisible) {
            return res.json({ isVisible: true, reason: 'User is not in invisibility mode' });
        }

        // Перевірити, чи є поточний користувач у списку видимих для цільового
        const isInVisibleTo = targetUser.privacyMode.visibleTo &&
                            targetUser.privacyMode.visibleTo.some(id => id.toString() === currentUserId);

        if (isInVisibleTo) {
            return res.json({ isVisible: true, reason: 'You are in the visible to list' });
        }

        // Перевірити, чи належить поточний користувач до групи, видимої для цільового
        let isInVisibleGroup = false;

        // Знайти всі групи користувача, в яких є цільовий користувач
        if (targetUser.friendGroups && targetUser.privacyMode.visibleToGroups) {
            const visibleGroups = targetUser.privacyMode.visibleToGroups;

            // Перевірити кожну видиму групу
            for (const groupName of visibleGroups) {
                const group = targetUser.friendGroups.find(g => g.name === groupName);
                if (group && group.members.some(memberId => memberId.toString() === currentUserId)) {
                    isInVisibleGroup = true;
                    break;
                }
            }
        }

        if (isInVisibleGroup) {
            return res.json({ isVisible: true, reason: 'You are in a visible group' });
        }

        // Якщо не видимий ні за яким правилом, то користувач невидимий
        return res.json({ isVisible: false, reason: 'User is in invisibility mode' });
    } catch (error) {
        console.error('Error checking visibility:', error);
        res.status(500).json({ message: 'Server error checking visibility' });
    }
});

module.exports = router;
