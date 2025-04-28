const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const User = require('./models/User');

// Get all conversations for the current user
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        // Find all conversations where the current user is a participant
        const conversations = await Conversation.find({
            participants: req.user.id
        })
        .sort({ updatedAt: -1 })
        .populate({
            path: 'participants',
            select: 'username avatar fullName'
        })
        .populate({
            path: 'lastMessage',
            select: 'content createdAt sender'
        });

        // Format the conversations for the client
        const formattedConversations = conversations.map(conversation => {
            // Find the other participant(s) in the conversation
            const otherParticipants = conversation.participants.filter(
                participant => participant._id.toString() !== req.user.id
            );

            // Get unread count for current user
            const unreadCount = conversation.unreadCount && conversation.unreadCount.get(req.user.id) || 0;

            return {
                id: conversation._id,
                participants: otherParticipants,
                lastMessage: conversation.lastMessage,
                unreadCount: unreadCount,
                updatedAt: conversation.updatedAt
            };
        });

        res.json(formattedConversations);
    } catch (error) {
        console.error('[Get Conversations Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при отриманні розмов' });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        const { conversationId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // Validate conversation ID
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ message: 'Невірний ID розмови' });
        }

        // Check if the conversation exists and the user is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user.id
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Розмову не знайдено або ви не є учасником' });
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get messages for the conversation
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: { $in: conversation.participants } },
                { recipient: req.user.id, sender: { $in: conversation.participants } }
            ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'username avatar')
        .populate('recipient', 'username avatar');

        // Mark unread messages as read
        await Message.updateMany(
            { recipient: req.user.id, read: false },
            { read: true }
        );

        // Reset unread count for this user in the conversation
        if (conversation.unreadCount) {
            conversation.unreadCount.set(req.user.id, 0);
            await conversation.save();
        }

        res.json(messages);
    } catch (error) {
        console.error('[Get Messages Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при отриманні повідомлень' });
    }
});

// Send a message
router.post('/send', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        const { recipientId, content } = req.body;

        // Validate required fields
        if (!recipientId || !content) {
            return res.status(400).json({ message: 'Відсутні обов\'язкові поля' });
        }

        // Validate recipient ID
        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: 'Невірний ID отримувача' });
        }

        // Check if the recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'Отримувача не знайдено' });
        }

        // Create the message
        const message = new Message({
            sender: req.user.id,
            recipient: recipientId,
            content,
            read: false
        });

        await message.save();

        // Find or create conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user.id, recipientId] }
        });

        if (!conversation) {
            // Create a new conversation
            conversation = new Conversation({
                participants: [req.user.id, recipientId],
                lastMessage: message._id,
                unreadCount: new Map([[recipientId, 1]])
            });
        } else {
            // Update existing conversation
            conversation.lastMessage = message._id;
            conversation.updatedAt = new Date();

            // Increment unread count for recipient
            if (!conversation.unreadCount) {
                conversation.unreadCount = new Map();
            }

            const currentCount = conversation.unreadCount.get(recipientId) || 0;
            conversation.unreadCount.set(recipientId, currentCount + 1);
        }

        await conversation.save();

        // Return the saved message with sender info
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar')
            .populate('recipient', 'username avatar');

        res.status(201).json({
            message: 'Повідомлення надіслано',
            data: populatedMessage
        });
    } catch (error) {
        console.error('[Send Message Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при надсиланні повідомлення' });
    }
});

// Delete a message
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        const { messageId } = req.params;

        // Validate message ID
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: 'Невірний ID повідомлення' });
        }

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Повідомлення не знайдено' });
        }

        // Check if the user is the sender of the message
        if (message.sender.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Ви не можете видалити це повідомлення' });
        }

        // Delete the message
        await message.deleteOne();

        // Update conversation if needed
        const conversation = await Conversation.findOne({
            participants: { $all: [message.sender, message.recipient] }
        });

        if (conversation && conversation.lastMessage && conversation.lastMessage.toString() === messageId) {
            // Find the new last message
            const newLastMessage = await Message.findOne({
                $or: [
                    { sender: message.sender, recipient: message.recipient },
                    { sender: message.recipient, recipient: message.sender }
                ]
            }).sort({ createdAt: -1 });

            if (newLastMessage) {
                conversation.lastMessage = newLastMessage._id;
            } else {
                // No messages left, the conversation might be deleted or just have no lastMessage
                conversation.lastMessage = null;
            }

            await conversation.save();
        }

        res.json({ message: 'Повідомлення видалено' });
    } catch (error) {
        console.error('[Delete Message Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при видаленні повідомлення' });
    }
});

// Search users to start a conversation
router.get('/users/search', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Неавторизований запит' });
        }

        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ message: 'Запит пошуку повинен містити принаймні 2 символи' });
        }

        // Search for users by username, email, or fullName
        const users = await User.find({
            $and: [
                { _id: { $ne: req.user.id } }, // Exclude current user
                {
                    $or: [
                        { username: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } },
                        { fullName: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        })
        .select('username avatar fullName')
        .limit(10);

        res.json(users);
    } catch (error) {
        console.error('[Search Users Error]:', error);
        res.status(500).json({ message: 'Помилка сервера при пошуку користувачів' });
    }
});

module.exports = router;
