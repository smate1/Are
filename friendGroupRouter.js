const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const User = mongoose.model('User');

// Отримати всі групи друзів користувача
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Якщо груп немає, повернути порожній масив
        if (!user.friendGroups || user.friendGroups.length === 0) {
            return res.json([]);
        }

        // Для кожної групи завантажити інформацію про користувачів
        const groups = [];

        for (const group of user.friendGroups) {
            // Зробити копію групи для безпечної модифікації
            const groupData = { ...group.toObject() };

            // Завантажити деталі для кожного учасника групи
            if (group.members && group.members.length > 0) {
                const members = await User.find({
                    _id: { $in: group.members }
                }).select('_id username fullName avatar bio');

                groupData.members = members;
            } else {
                groupData.members = [];
            }

            groups.push(groupData);
        }

        res.json(groups);
    } catch (error) {
        console.error('Error fetching friend groups:', error);
        res.status(500).json({ message: 'Server error fetching friend groups' });
    }
});

// Створити нову групу друзів
router.post('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, color, members, privacySettings } = req.body;

        // Базова валідація
        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ініціалізувати масив груп, якщо він відсутній
        if (!user.friendGroups) {
            user.friendGroups = [];
        }

        // Перевірити, чи існує вже група з такою назвою
        const existingGroup = user.friendGroups.find(g => g.name === name);
        if (existingGroup) {
            return res.status(400).json({ message: 'A group with this name already exists' });
        }

        // Перевірити, чи всі передані користувачі є друзями
        let validMembers = [];
        if (members && members.length > 0) {
            validMembers = members.filter(memberId =>
                user.friends.some(friendId => friendId.toString() === memberId)
            );

            // Якщо були передані недійсні ідентифікатори (не друзі)
            if (validMembers.length !== members.length) {
                console.warn(`Some provided members are not friends: ${members.filter(id => !validMembers.includes(id))}`);
            }
        }

        // Створити нову групу
        const newGroup = {
            name,
            description: description || '',
            color: color || '#0b93f6',
            members: validMembers,
            privacySettings: privacySettings || {
                canSeeLocation: true,
                canSeeActivity: true,
                canMessage: true
            },
            createdAt: new Date()
        };

        // Додати групу до користувача
        user.friendGroups.push(newGroup);

        // Зберегти користувача
        await user.save();

        // Завантажити деталі про членів групи для відповіді
        let groupWithMembers = { ...newGroup };
        if (validMembers.length > 0) {
            const memberDetails = await User.find({
                _id: { $in: validMembers }
            }).select('_id username fullName avatar bio');

            groupWithMembers.members = memberDetails;
        }

        // Перевірити досягнення
        if (global.checkAchievements) {
            global.checkAchievements(userId, 'friend_groups');
        }

        res.status(201).json({
            message: 'Friend group created successfully',
            group: groupWithMembers
        });
    } catch (error) {
        console.error('Error creating friend group:', error);
        res.status(500).json({ message: 'Server error creating friend group' });
    }
});

// Оновити групу друзів
router.put('/:groupName', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { groupName } = req.params;
        const { name, description, color, members, privacySettings } = req.body;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірити, чи існує група
        if (!user.friendGroups) {
            return res.status(404).json({ message: 'No friend groups found' });
        }

        // Знайти індекс групи
        const groupIndex = user.friendGroups.findIndex(g => g.name === groupName);
        if (groupIndex === -1) {
            return res.status(404).json({ message: 'Friend group not found' });
        }

        // Якщо змінюється ім'я, перевірити, чи не зайнято нове ім'я
        if (name && name !== groupName) {
            const existingGroup = user.friendGroups.find(g => g.name === name);
            if (existingGroup) {
                return res.status(400).json({ message: 'A group with this name already exists' });
            }
        }

        // Перевірити, чи всі передані користувачі є друзями
        let validMembers = user.friendGroups[groupIndex].members;
        if (members) {
            validMembers = members.filter(memberId =>
                user.friends.some(friendId => friendId.toString() === memberId)
            );

            // Якщо були передані недійсні ідентифікатори (не друзі)
            if (validMembers.length !== members.length) {
                console.warn(`Some provided members are not friends: ${members.filter(id => !validMembers.includes(id))}`);
            }
        }

        // Оновити дані групи
        if (name) user.friendGroups[groupIndex].name = name;
        if (description !== undefined) user.friendGroups[groupIndex].description = description;
        if (color) user.friendGroups[groupIndex].color = color;
        if (members) user.friendGroups[groupIndex].members = validMembers;

        // Оновити налаштування приватності
        if (privacySettings) {
            if (!user.friendGroups[groupIndex].privacySettings) {
                user.friendGroups[groupIndex].privacySettings = {};
            }

            if (privacySettings.canSeeLocation !== undefined) {
                user.friendGroups[groupIndex].privacySettings.canSeeLocation = privacySettings.canSeeLocation;
            }

            if (privacySettings.canSeeActivity !== undefined) {
                user.friendGroups[groupIndex].privacySettings.canSeeActivity = privacySettings.canSeeActivity;
            }

            if (privacySettings.canMessage !== undefined) {
                user.friendGroups[groupIndex].privacySettings.canMessage = privacySettings.canMessage;
            }
        }

        // Зберегти користувача
        await user.save();

        // Завантажити деталі про членів групи для відповіді
        const updatedGroup = { ...user.friendGroups[groupIndex].toObject() };

        if (updatedGroup.members && updatedGroup.members.length > 0) {
            const memberDetails = await User.find({
                _id: { $in: updatedGroup.members }
            }).select('_id username fullName avatar bio');

            updatedGroup.members = memberDetails;
        }

        res.json({
            message: 'Friend group updated successfully',
            group: updatedGroup
        });
    } catch (error) {
        console.error('Error updating friend group:', error);
        res.status(500).json({ message: 'Server error updating friend group' });
    }
});

// Видалити групу друзів
router.delete('/:groupName', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { groupName } = req.params;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірити, чи існує група
        if (!user.friendGroups) {
            return res.status(404).json({ message: 'No friend groups found' });
        }

        // Знайти індекс групи
        const groupIndex = user.friendGroups.findIndex(g => g.name === groupName);
        if (groupIndex === -1) {
            return res.status(404).json({ message: 'Friend group not found' });
        }

        // Видалити групу
        user.friendGroups.splice(groupIndex, 1);

        // Зберегти користувача
        await user.save();

        res.json({ message: 'Friend group deleted successfully' });
    } catch (error) {
        console.error('Error deleting friend group:', error);
        res.status(500).json({ message: 'Server error deleting friend group' });
    }
});

// Додати друга до групи
router.post('/:groupName/members/:friendId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { groupName, friendId } = req.params;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірити, чи існує група
        if (!user.friendGroups) {
            return res.status(404).json({ message: 'No friend groups found' });
        }

        // Знайти індекс групи
        const groupIndex = user.friendGroups.findIndex(g => g.name === groupName);
        if (groupIndex === -1) {
            return res.status(404).json({ message: 'Friend group not found' });
        }

        // Перевірити, чи є вказаний користувач другом
        const isFriend = user.friends.some(id => id.toString() === friendId);
        if (!isFriend) {
            return res.status(400).json({ message: 'The specified user is not your friend' });
        }

        // Перевірити, чи друг вже є в групі
        const isInGroup = user.friendGroups[groupIndex].members.some(id => id.toString() === friendId);
        if (isInGroup) {
            return res.status(400).json({ message: 'This friend is already in the group' });
        }

        // Додати друга до групи
        user.friendGroups[groupIndex].members.push(friendId);

        // Зберегти користувача
        await user.save();

        // Завантажити інформацію про доданого друга
        const friend = await User.findById(friendId).select('_id username fullName avatar bio');

        res.json({
            message: 'Friend added to group successfully',
            friend
        });
    } catch (error) {
        console.error('Error adding friend to group:', error);
        res.status(500).json({ message: 'Server error adding friend to group' });
    }
});

// Видалити друга з групи
router.delete('/:groupName/members/:friendId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { groupName, friendId } = req.params;

        // Знайти користувача
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірити, чи існує група
        if (!user.friendGroups) {
            return res.status(404).json({ message: 'No friend groups found' });
        }

        // Знайти індекс групи
        const groupIndex = user.friendGroups.findIndex(g => g.name === groupName);
        if (groupIndex === -1) {
            return res.status(404).json({ message: 'Friend group not found' });
        }

        // Перевірити, чи друг є в групі
        const memberIndex = user.friendGroups[groupIndex].members.findIndex(id => id.toString() === friendId);
        if (memberIndex === -1) {
            return res.status(400).json({ message: 'This friend is not in the group' });
        }

        // Видалити друга з групи
        user.friendGroups[groupIndex].members.splice(memberIndex, 1);

        // Зберегти користувача
        await user.save();

        res.json({ message: 'Friend removed from group successfully' });
    } catch (error) {
        console.error('Error removing friend from group:', error);
        res.status(500).json({ message: 'Server error removing friend from group' });
    }
});

module.exports = router;
