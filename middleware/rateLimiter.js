/**
 * Rate Limiter Middleware
 * Обмежує кількість запитів з однієї IP-адреси за певний проміжок часу
 */

// Зберігаємо спроби входу в пам'яті
// В реальному продакшні це краще зберігати в Redis або іншій базі даних
const loginAttempts = new Map();
const blockedIPs = new Map();

/**
 * Middleware для захисту від брутфорсу на сторінці входу
 * Блокує IP після певної кількості невдалих спроб входу
 */
const loginRateLimiter = (maxAttempts = 5, windowMs = 15 * 60 * 1000, blockDuration = 30 * 60 * 1000) => {
    return (req, res, next) => {
        // Отримуємо IP-адресу
        const ip = req.ip || req.connection.remoteAddress;

        // Перевіряємо, чи заблокований IP
        if (blockedIPs.has(ip)) {
            const blockedUntil = blockedIPs.get(ip);

            // Якщо блокування ще активне
            if (Date.now() < blockedUntil) {
                const remainingTime = Math.ceil((blockedUntil - Date.now()) / 1000 / 60);
                return res.status(429).json({
                    error: 'Too many failed login attempts',
                    message: `Your account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingTime} minutes.`,
                    blockedUntil,
                    remainingTime
                });
            } else {
                // Якщо блокування закінчилося, видаляємо з блокування
                blockedIPs.delete(ip);
                loginAttempts.delete(ip);
            }
        }

        // Перевіряємо запит за шляхом і методом
        if (req.path.includes('/login') && req.method === 'POST') {
            // Обробляємо спробу входу
            const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };

            // Якщо минув час вікна, скидаємо лічильник
            if (Date.now() > attempts.firstAttempt + windowMs) {
                attempts.count = 0;
                attempts.firstAttempt = Date.now();
            }

            // Зберігаємо в оригінальному запиті для використання в логіці авторизації
            req.loginAttempts = attempts;

            // Встановлюємо функцію для реєстрації невдалих спроб входу
            req.failedLoginAttempt = () => {
                attempts.count += 1;
                loginAttempts.set(ip, attempts);

                // Якщо перевищили максимальну кількість спроб, блокуємо IP
                if (attempts.count >= maxAttempts) {
                    const blockUntil = Date.now() + blockDuration;
                    blockedIPs.set(ip, blockUntil);

                    // Відправляємо інформацію про блокування
                    return {
                        blocked: true,
                        attempts: attempts.count,
                        blockUntil,
                        remainingTime: Math.ceil(blockDuration / 1000 / 60)
                    };
                }

                return {
                    blocked: false,
                    attempts: attempts.count,
                    remaining: maxAttempts - attempts.count
                };
            };

            // Встановлюємо функцію для скидання лічильника при успішному вході
            req.successfulLogin = () => {
                loginAttempts.delete(ip);
            };
        }

        next();
    };
};

/**
 * Загальний middleware для обмеження запитів
 */
const apiRateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();

    return (req, res, next) => {
        // Отримуємо IP-адресу
        const ip = req.ip || req.connection.remoteAddress;

        // Отримуємо поточний стан запитів для цього IP
        const requestData = requests.get(ip) || { count: 0, firstRequest: Date.now() };

        // Якщо минув час вікна, скидаємо лічильник
        if (Date.now() > requestData.firstRequest + windowMs) {
            requestData.count = 0;
            requestData.firstRequest = Date.now();
        }

        // Збільшуємо лічильник запитів
        requestData.count += 1;
        requests.set(ip, requestData);

        // Якщо перевищено ліміт, відмовляємо у запиті
        if (requestData.count > maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                message: 'You have exceeded the rate limit. Please try again later.',
            });
        }

        // Додаємо заголовки з інформацією про обмеження
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestData.count));
        res.setHeader('X-RateLimit-Reset', new Date(requestData.firstRequest + windowMs).getTime());

        next();
    };
};

module.exports = {
    loginRateLimiter,
    apiRateLimiter
};
