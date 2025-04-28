/**
 * Auth Fix - вирішення проблеми з циклічними перенаправленнями при авторизації
 */

document.addEventListener('DOMContentLoaded', function() {
    // Функція для перевірки наявності token у локальному сховищі
    function checkToken() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        const tokenExpires = localStorage.getItem('tokenExpires');

        console.log('Auth-fix: Checking token in localStorage:', token ? 'Present' : 'Not found');
        console.log('Auth-fix: User data in localStorage:', user ? 'Present' : 'Not found');
        console.log('Auth-fix: Token expires:', tokenExpires || 'Not set');

        // Check if token is expired
        let isTokenExpired = false;
        if (tokenExpires) {
            try {
                const expiryDate = new Date(tokenExpires);
                const now = new Date();
                isTokenExpired = now >= expiryDate;
                console.log('Auth-fix: Token expired?', isTokenExpired);
            } catch (e) {
                console.error('Auth-fix: Error checking token expiration:', e);
                isTokenExpired = true;
            }
        }

        // Перевіряємо наявність параметрів захисту від циклічного перенаправлення
        const preventRedirect = sessionStorage.getItem('preventRedirect') === 'true';
        const redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
        const now = new Date().getTime();
        const lastRedirectTime = parseInt(sessionStorage.getItem('lastRedirectTime') || '0');
        const timeSinceLastRedirect = now - lastRedirectTime;

        // Якщо перенаправлення відбувається занадто часто (менше 2 секунд між ними)
        // і вже було принаймні 2 перенаправлення, активуємо захист
        if (timeSinceLastRedirect < 2000 && redirectCount >= 2) {
            console.warn('Auth-fix: Detected rapid redirects! Count:', redirectCount, 'Time since last:', timeSinceLastRedirect, 'ms');

            // Активуємо захист від перенаправлень
            sessionStorage.setItem('preventRedirect', 'true');

            // Створюємо повідомлення для користувача
            const errorDiv = document.createElement('div');
            errorDiv.style.backgroundColor = '#ffeeee';
            errorDiv.style.color = '#cc0000';
            errorDiv.style.padding = '15px';
            errorDiv.style.margin = '15px 0';
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '10px';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translateX(-50%)';
            errorDiv.style.zIndex = '9999';
            errorDiv.style.maxWidth = '80%';
            errorDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            errorDiv.innerHTML = `
                <strong>Помилка автентифікації:</strong> Виявлено цикл перенаправлень.<br>
                <div style="margin-top: 10px;">
                    <button id="clear-redirect-data" style="padding:5px 10px;background:#cc0000;color:white;border:none;border-radius:3px;cursor:pointer;margin-right:5px;">
                        Очистити дані сесії
                    </button>
                    <button id="force-login" style="padding:5px 10px;background:#0b93f6;color:white;border:none;border-radius:3px;cursor:pointer;">
                        Автоматичний вхід
                    </button>
                </div>
            `;
            document.body.appendChild(errorDiv);

            // Додаємо обробники для кнопок
            document.getElementById('clear-redirect-data').addEventListener('click', function() {
                // Очищаємо всі дані авторизації
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('tokenExpires');
                localStorage.removeItem('rememberMe');
                sessionStorage.removeItem('preventRedirect');
                sessionStorage.removeItem('redirectCount');
                sessionStorage.removeItem('lastRedirectTime');
                sessionStorage.removeItem('profileRedirectCount');
                sessionStorage.removeItem('profileRedirectTime');

                // Видаляємо повідомлення і перезавантажуємо сторінку
                errorDiv.remove();
                window.location.href = '/auth.html';
            });

            document.getElementById('force-login').addEventListener('click', function() {
                // Пробуємо автоматичний вхід з тестовими даними
                autoLogin();
            });

            return; // Припиняємо подальше виконання
        }

        // Увімкнено захист від перенаправлень, просто показуємо повідомлення
        if (preventRedirect) {
            console.warn('Auth-fix: Redirect prevention is active');
            return;
        }

        // В профілі перевіряємо наявність token і user
        // Якщо на сторінці auth.html, то нічого не робимо
        const isAuthPage = window.location.pathname.includes('auth.html') ||
                          window.location.pathname === '/' ||
                          window.location.pathname === '/auth';

        // Якщо ми на сторінці, що не є auth, але немає токена або він протермінований
        if (!isAuthPage && (!token || isTokenExpired) && !preventRedirect) {
            console.log('Auth-fix: Not on auth page but token is missing or expired, redirecting to login');

            // Оновлюємо лічильник перенаправлень і час
            sessionStorage.setItem('redirectCount', (redirectCount + 1).toString());
            sessionStorage.setItem('lastRedirectTime', now.toString());

            // Додаємо затримку перед перенаправленням
            setTimeout(() => {
                window.location.href = '/auth.html';
            }, 500);
        }
        // Якщо ми на сторінці авторизації, але маємо дійсний токен
        else if (isAuthPage && token && !isTokenExpired && !preventRedirect) {
            console.log('Auth-fix: On auth page with valid token, redirecting to profile');

            // Оновлюємо лічильник перенаправлень і час
            sessionStorage.setItem('redirectCount', (redirectCount + 1).toString());
            sessionStorage.setItem('lastRedirectTime', now.toString());

            // Додаємо затримку перед перенаправленням
            setTimeout(() => {
                window.location.href = '/profile.html';
            }, 500);
        }
    }

    // Функція для автоматичного входу в систему з тестовими даними
    async function autoLogin() {
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'testuser',
                    password: 'password123',
                    rememberMe: true
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // Зберігаємо токен і дані користувача
                localStorage.setItem('token', data.token);
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }

                // Зберігаємо інформацію про термін дії токена
                if (data.expiresIn) {
                    const expirationTime = new Date();
                    if (data.expiresIn === '30d') {
                        expirationTime.setDate(expirationTime.getDate() + 30);
                    } else {
                        expirationTime.setHours(expirationTime.getHours() + 24);
                    }
                    localStorage.setItem("tokenExpires", expirationTime.toISOString());
                }

                // Скидаємо лічильники захисту від перенаправлень
                sessionStorage.removeItem('preventRedirect');
                sessionStorage.removeItem('redirectCount');
                sessionStorage.removeItem('lastRedirectTime');

                // Показуємо повідомлення про успіх
                if (window.EraNotification) {
                    window.EraNotification.success('Автоматичний вхід успішний!', 'Ласкаво просимо');
                } else {
                    alert('Автоматичний вхід успішний!');
                }

                // Перенаправляємо на сторінку профілю
                setTimeout(() => {
                    window.location.href = '/profile.html';
                }, 1000);
            } else {
                console.error('Auth-fix: Auto login failed', response.status);
                if (window.EraNotification) {
                    window.EraNotification.error('Помилка при автоматичному вході', 'Спробуйте очистити дані сесії');
                } else {
                    alert('Помилка при автоматичному вході. Спробуйте очистити дані сесії і увійти вручну.');
                }
            }
        } catch (error) {
            console.error('Auth-fix: Auto login error', error);
            if (window.EraNotification) {
                window.EraNotification.error(`Помилка з'єднання: ${error.message}`, 'Помилка входу');
            } else {
                alert('Помилка при автоматичному вході: ' + error.message);
            }
        }
    }

    // Викликаємо перевірку токена при завантаженні сторінки
    checkToken();
});
