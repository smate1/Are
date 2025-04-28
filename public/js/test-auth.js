document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:5002';
    const testResults = document.getElementById('test-results');
    const runTestButton = document.getElementById('run-test-button');

    if (!testResults || !runTestButton) return;

    async function appendResult(message, isError = false) {
        const resultItem = document.createElement('li');
        resultItem.textContent = message;
        resultItem.className = isError ? 'error' : 'success';
        testResults.appendChild(resultItem);
        console.log(isError ? `❌ ${message}` : `✅ ${message}`);
    }

    async function clearResults() {
        testResults.innerHTML = '';
    }

    async function testApiConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/status`);

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const data = await response.json();
            appendResult(`✅ API Connection: ${data.status}, Mock DB: ${data.mockDb}, Time: ${data.time}`);
            return true;
        } catch (error) {
            appendResult(`❌ API Connection failed: ${error.message}`, true);
            return false;
        }
    }

    async function testRegistration() {
        try {
            // Generate random username to avoid conflicts
            const randomSuffix = Math.floor(Math.random() * 10000);
            const username = `testuser${randomSuffix}`;
            const email = `test${randomSuffix}@example.com`;
            const password = 'password123';

            const response = await fetch(`${API_BASE_URL}/auth/registration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                appendResult(`✅ Registration: Successfully registered user ${username}`);
                return { username, password, success: true };
            } else {
                appendResult(`❌ Registration failed: ${data.message}`, true);
                return { success: false };
            }
        } catch (error) {
            appendResult(`❌ Registration error: ${error.message}`, true);
            return { success: false };
        }
    }

    async function testLogin(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier: username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                appendResult(`✅ Login: Successfully logged in as ${username}`);
                if (data.token) {
                    return { token: data.token, success: true };
                } else {
                    appendResult('⚠️ Warning: No token returned, but login succeeded');
                    return { success: true };
                }
            } else {
                appendResult(`❌ Login failed: ${data.message}`, true);
                return { success: false };
            }
        } catch (error) {
            appendResult(`❌ Login error: ${error.message}`, true);
            return { success: false };
        }
    }

    async function testProfile(token) {
        try {
            const response = await fetch(`${API_BASE_URL}/profile/profile`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Profile request failed with status ${response.status}`);
            }

            const data = await response.json();
            appendResult(`✅ Profile: Successfully fetched profile for ${data.username}`);
            return true;
        } catch (error) {
            appendResult(`❌ Profile fetch error: ${error.message}`, true);
            return false;
        }
    }

    async function runTests() {
        clearResults();
        appendResult('Starting authentication tests...');

        const apiConnected = await testApiConnection();
        if (!apiConnected) {
            appendResult('❌ Tests aborted: No API connection', true);
            return;
        }

        const registrationResult = await testRegistration();
        if (!registrationResult.success) {
            appendResult('⚠️ Continuing tests with default credentials');
            registrationResult.username = 'testuser';
            registrationResult.password = 'password123';
        }

        const loginResult = await testLogin(registrationResult.username, registrationResult.password);
        if (!loginResult.success) {
            appendResult('❌ Tests aborted: Login failed', true);
            return;
        }

        if (loginResult.token) {
            await testProfile(loginResult.token);
        } else {
            appendResult('⚠️ Skipping profile test: No token available');
        }

        appendResult('Authentication tests completed');
    }

    runTestButton.addEventListener('click', runTests);
});
