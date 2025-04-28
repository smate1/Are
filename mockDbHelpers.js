// Допоміжні функції для роботи з мок-базою

// Перевірка, чи включений мок-режим
const isMockMode = () => {
  return global.USE_MOCK_DB === true;
};

// Отримати мок-колекцію за назвою
const getMockCollection = (collectionName) => {
  if (!global.mockDatabase) {
    global.mockDatabase = {};
  }

  if (!global.mockDatabase[collectionName]) {
    global.mockDatabase[collectionName] = [];
  }

  return global.mockDatabase[collectionName];
};

// Знайти документ у мок-колекції за ID
const findById = (collectionName, id) => {
  const collection = getMockCollection(collectionName);
  return Promise.resolve(collection.find(item => item._id === id));
};

// Знайти всі документи у мок-колекції
const findAll = (collectionName) => {
  const collection = getMockCollection(collectionName);
  return Promise.resolve([...collection]);
};

// Знайти документи у мок-колекції за умовою
const findByCondition = (collectionName, condition) => {
  const collection = getMockCollection(collectionName);

  // Спрощена реалізація фільтрації за умовою
  const results = collection.filter(item => {
    for (const key in condition) {
      // Підтримка простого порівняння значень
      if (key === '_id' && item._id === condition._id) {
        return true;
      }

      // Підтримка $ne (не дорівнює)
      if (typeof condition[key] === 'object' && condition[key].$ne !== undefined) {
        if (item[key] === condition[key].$ne) {
          return false;
        }
      }

      // Підтримка username, email з регулярними виразами
      if (key === 'username' || key === 'email') {
        if (typeof condition[key] === 'object' && condition[key].$regex) {
          const regex = condition[key].$regex;
          const options = condition[key].$options || '';
          const re = new RegExp(regex, options);
          if (!re.test(item[key])) {
            return false;
          }
        } else if (item[key] !== condition[key]) {
          return false;
        }
      }
    }
    return true;
  });

  return Promise.resolve(results);
};

// Створити документ у мок-колекції
const create = (collectionName, data) => {
  const collection = getMockCollection(collectionName);
  const newItem = { ...data, _id: data._id || String(Date.now()) };
  collection.push(newItem);
  return Promise.resolve(newItem);
};

// Оновити документ у мок-колекції
const updateById = (collectionName, id, data) => {
  const collection = getMockCollection(collectionName);
  const index = collection.findIndex(item => item._id === id);
  if (index !== -1) {
    collection[index] = { ...collection[index], ...data };
    return Promise.resolve(collection[index]);
  }
  return Promise.resolve(null);
};

// Видалити документ з мок-колекції
const deleteById = (collectionName, id) => {
  const collection = getMockCollection(collectionName);
  const index = collection.findIndex(item => item._id === id);
  if (index !== -1) {
    const deleted = collection.splice(index, 1)[0];
    return Promise.resolve(deleted);
  }
  return Promise.resolve(null);
};

// Додати друга
const addFriend = (userId, friendId) => {
  const users = getMockCollection('users');
  const userIndex = users.findIndex(u => u._id === userId);
  const friendIndex = users.findIndex(u => u._id === friendId);

  if (userIndex !== -1 && friendIndex !== -1) {
    // Ініціалізуємо масив друзів, якщо він не існує
    if (!users[userIndex].friends) {
      users[userIndex].friends = [];
    }
    if (!users[friendIndex].friends) {
      users[friendIndex].friends = [];
    }

    // Додаємо ID в масиви друзів
    if (!users[userIndex].friends.includes(friendId)) {
      users[userIndex].friends.push(friendId);
    }
    if (!users[friendIndex].friends.includes(userId)) {
      users[friendIndex].friends.push(userId);
    }

    return Promise.resolve(true);
  }

  return Promise.resolve(false);
};

// Відхилити запит на дружбу
const rejectFriendRequest = (userId, requesterId) => {
  const users = getMockCollection('users');
  const userIndex = users.findIndex(u => u._id === userId);
  const requesterIndex = users.findIndex(u => u._id === requesterId);

  if (userIndex !== -1 && requesterIndex !== -1) {
    // Ініціалізуємо об'єкти запитів, якщо вони не існують
    if (!users[userIndex].friendRequests) {
      users[userIndex].friendRequests = { received: [], sent: [] };
    }
    if (!users[requesterIndex].friendRequests) {
      users[requesterIndex].friendRequests = { received: [], sent: [] };
    }

    // Видаляємо ID з отриманих/надісланих запитів
    users[userIndex].friendRequests.received = (users[userIndex].friendRequests.received || [])
      .filter(id => id !== requesterId);

    users[requesterIndex].friendRequests.sent = (users[requesterIndex].friendRequests.sent || [])
      .filter(id => id !== userId);

    return Promise.resolve(true);
  }

  return Promise.resolve(false);
};

// Відправити запит на дружбу
const sendFriendRequest = (userId, recipientId) => {
  const users = getMockCollection('users');
  const userIndex = users.findIndex(u => u._id === userId);
  const recipientIndex = users.findIndex(u => u._id === recipientId);

  if (userIndex !== -1 && recipientIndex !== -1) {
    // Ініціалізуємо об'єкти запитів, якщо вони не існують
    if (!users[userIndex].friendRequests) {
      users[userIndex].friendRequests = { received: [], sent: [] };
    }
    if (!users[recipientIndex].friendRequests) {
      users[recipientIndex].friendRequests = { received: [], sent: [] };
    }

    // Додаємо ID в надіслані/отримані запити
    if (!users[userIndex].friendRequests.sent.includes(recipientId)) {
      users[userIndex].friendRequests.sent.push(recipientId);
    }
    if (!users[recipientIndex].friendRequests.received.includes(userId)) {
      users[recipientIndex].friendRequests.received.push(userId);
    }

    return Promise.resolve(true);
  }

  return Promise.resolve(false);
};

// Експортуємо функції
module.exports = {
  isMockMode,
  getMockCollection,
  findById,
  findAll,
  findByCondition,
  create,
  updateById,
  deleteById,
  addFriend,
  rejectFriendRequest,
  sendFriendRequest
};
