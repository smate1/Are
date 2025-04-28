# Розгортання проекту Era Platform

Ця інструкція допоможе вам розгорнути проект Era Platform з тестовими користувачами на різних платформах.

## Передумови

- Node.js версії 18 або новіше
- npm (встановлюється разом з Node.js)
- Акаунт на одній з платформ для хостингу (Netlify, Render, Railway або Heroku)

## Локальний запуск

1. Клонуйте репозиторій:
   ```
   git clone <URL_репозиторію>
   cd era-platform
   ```

2. Встановіть залежності:
   ```
   npm install
   ```

3. Запустіть проект з мок-даними:
   ```
   USE_MOCK_DB=true npm run start:node
   ```

4. Відкрийте http://localhost:5002 у вашому браузері

5. Для тестування соціальних функцій відкрийте http://localhost:5002/social-test.html

## Деплой на Netlify

1. Зареєструйтесь/увійдіть на [Netlify](https://www.netlify.com/)

2. Підключіть ваш GitHub репозиторій

3. Налаштування для деплою:
   - Build command: `npm install`
   - Publish directory: `public`
   - Environment variables:
     - `USE_MOCK_DB`: `true`
     - `NODE_VERSION`: `18`

4. Натисніть "Deploy" і чекайте, поки проект розгорнеться

## Деплой на Render

1. Зареєструйтесь/увійдіть на [Render](https://render.com/)

2. Створіть новий Web Service та підключіть ваш GitHub репозиторій

3. Налаштування:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `USE_MOCK_DB=true npm run start:node`
   - Environment Variables:
     - `USE_MOCK_DB`: `true`
     - `NODE_VERSION`: `18`

4. Натисніть "Create Web Service" і чекайте, поки проект розгорнеться

## Деплой на Railway

1. Зареєструйтесь/увійдіть на [Railway](https://railway.app/)

2. Створіть новий проект та підключіть ваш GitHub репозиторій

3. Railway автоматично визначить налаштування з файлу `railway.json`

4. Переконайтеся, що змінна середовища `USE_MOCK_DB` встановлена в `true`

5. Натисніть "Deploy" і чекайте, поки проект розгорнеться

## Деплой на Heroku

1. Зареєструйтесь/увійдіть на [Heroku](https://www.heroku.com/)

2. Встановіть Heroku CLI і виконайте такі команди:
   ```
   heroku create
   git push heroku main
   ```

3. Налаштуйте змінні середовища:
   ```
   heroku config:set USE_MOCK_DB=true
   heroku config:set NODE_VERSION=18
   ```

4. Відкрийте веб-сайт:
   ```
   heroku open
   ```

## Доступ до тестових користувачів

Після деплою відкрийте `/social-test.html` на вашому сайті, щоб побачити доступних тестових користувачів і протестувати функціональність.

Дані для входу для всіх тестових користувачів:
- Логін: вказано на сторінці тестування
- Пароль: `password123`

## Усунення несправностей

- Якщо ви отримуєте помилку "Cannot find module", переконайтеся, що ви встановили всі залежності, виконавши `npm install`
- Якщо соціальні функції не працюють, переконайтеся, що `USE_MOCK_DB` встановлена на `true`
- Якщо у вас проблеми з деплоєм, перевірте логи на платформі хостингу для отримання додаткової інформації
