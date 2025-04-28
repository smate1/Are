// Admin Authentication Monitoring JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    // Configuration
    const API_BASE_URL = window.location.origin;
    let token = localStorage.getItem('token');

    // DOM Elements - Tabs
    const tabElements = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // DOM Elements - Stats Cards
    const totalUsersEl = document.getElementById('total-users');
    const totalUsersChangeEl = document.getElementById('total-users-change');
    const activeUsersEl = document.getElementById('active-users');
    const activeUsersChangeEl = document.getElementById('active-users-change');
    const successRateEl = document.getElementById('success-rate');
    const successRateChangeEl = document.getElementById('success-rate-change');
    const activeSessionsEl = document.getElementById('active-sessions');
    const activeSessionsChangeEl = document.getElementById('active-sessions-change');

    // DOM Elements - Filters
    const sessionsUsernameFilter = document.getElementById('sessions-username-filter');
    const sessionsDeviceFilter = document.getElementById('sessions-device-filter');
    const sessionsIpFilter = document.getElementById('sessions-ip-filter');
    const applySessionsFilter = document.getElementById('apply-sessions-filter');

    const patternsUsernameFilter = document.getElementById('patterns-username-filter');
    const patternsStartDate = document.getElementById('patterns-start-date');
    const patternsEndDate = document.getElementById('patterns-end-date');
    const applyPatternsFilter = document.getElementById('apply-patterns-filter');

    // DOM Elements - Tables
    const sessionsTableBody = document.getElementById('sessions-table-body');
    const sessionsPagination = document.getElementById('sessions-pagination');

    const patternsTableBody = document.getElementById('patterns-table-body');
    const patternsPagination = document.getElementById('patterns-pagination');

    // Chart References
    let loginAttemptsChart, authMethodsChart, deviceTypesChart, loginTrendsChart;

    // Global State
    let currentSessionsPage = 1;
    let currentPatternsPage = 1;

    // Check Authentication
    checkAuth();

    // Initialize the page
    async function initialize() {
        initTabs();
        await loadStats();
        await loadLoginStats();
        loadActiveSessions();
        loadAuthPatterns();
        setupLogout();
    }

    // Tab Navigation
    function initTabs() {
        tabElements.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');

                // Update active tab
                tabElements.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show active content
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    // Check if user is authenticated and has admin role
    async function checkAuth() {
        if (!token) {
            window.location.href = '/auth.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/validate-token`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const data = await response.json();

            // Check if user has admin role
            if (!data.user || !data.user.roles.includes('ADMIN')) {
                window.location.href = '/profile.html';
                if (window.EraNotification) {
                    window.EraNotification.error('Admin access required', 'Access Denied');
                }
                return;
            }

            // Load data for authenticated admin
            initialize();

        } catch (error) {
            console.error('Authentication error:', error);
            window.location.href = '/auth.html';
        }
    }

    // Load Dashboard Stats
    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/admin/login-stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load stats');
            }

            const data = await response.json();

            // Update stats cards
            totalUsersEl.textContent = data.userStats.totalUsers.toLocaleString();
            activeUsersEl.textContent = data.userStats.activeUsers.toLocaleString();

            const successRate = (data.loginStats.successfulAttempts / data.loginStats.totalAttempts * 100).toFixed(1);
            successRateEl.textContent = `${successRate}%`;

            activeSessionsEl.textContent = data.sessionStats.totalActiveSessions.toLocaleString();

            // Simulate changes (in a real app, we'd compare with previous period)
            totalUsersChangeEl.textContent = '+5% from last month';
            activeUsersChangeEl.textContent = '+12% from last month';
            successRateChangeEl.textContent = '+2.3% from last month';
            successRateChangeEl.classList.add('positive');
            activeSessionsChangeEl.textContent = '-3% from last month';
            activeSessionsChangeEl.classList.add('negative');

        } catch (error) {
            console.error('Error loading stats:', error);
            if (window.EraNotification) {
                window.EraNotification.error('Error loading statistics', 'API Error');
            }
        }
    }

    // Load and Initialize Charts
    async function loadLoginStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/admin/login-stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load login stats');
            }

            const data = await response.json();

            // Initialize Charts
            createLoginAttemptsChart(data);
            createAuthMethodsChart(data);
            createDeviceTypesChart(data);
            createLoginTrendsChart(data);

        } catch (error) {
            console.error('Error loading login stats:', error);
            if (window.EraNotification) {
                window.EraNotification.error('Error loading login statistics', 'API Error');
            }
        }
    }

    // Create Login Attempts Chart
    function createLoginAttemptsChart(data) {
        const ctx = document.getElementById('login-attempts-chart').getContext('2d');

        // Destroy existing chart if it exists
        if (loginAttemptsChart) loginAttemptsChart.destroy();

        loginAttemptsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [data.loginStats.successfulAttempts, data.loginStats.failedAttempts],
                    backgroundColor: ['rgba(76, 175, 80, 0.7)', 'rgba(244, 67, 54, 0.7)'],
                    borderColor: ['#4caf50', '#f44336'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
    }

    // Create Auth Methods Chart
    function createAuthMethodsChart(data) {
        const ctx = document.getElementById('auth-methods-chart').getContext('2d');

        // Destroy existing chart if it exists
        if (authMethodsChart) authMethodsChart.destroy();

        // Prepare data
        const methods = data.loginStats.authMethods;
        const authData = [
            methods.password || 0,
            methods.biometric || 0,
            methods.oauth?.google || 0,
            methods.oauth?.facebook || 0,
            methods.oauth?.github || 0,
            methods.oauth?.twitter || 0
        ];

        authMethodsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Password', 'Biometric', 'Google', 'Facebook', 'GitHub', 'Twitter'],
                datasets: [{
                    label: 'Login Count',
                    data: authData,
                    backgroundColor: [
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(244, 67, 54, 0.7)',
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(0, 0, 0, 0.7)',
                        'rgba(29, 161, 242, 0.7)'
                    ],
                    borderColor: [
                        '#2196f3',
                        '#4caf50',
                        '#f44336',
                        '#2196f3',
                        '#000000',
                        '#1da1f2'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#aaa'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#aaa'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Create Device Types Chart
    function createDeviceTypesChart(data) {
        const ctx = document.getElementById('device-types-chart').getContext('2d');

        // Destroy existing chart if it exists
        if (deviceTypesChart) deviceTypesChart.destroy();

        // Prepare data
        const devices = data.loginStats.deviceTypes;

        deviceTypesChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Mobile', 'Desktop', 'Tablet', 'Other'],
                datasets: [{
                    data: [devices.mobile, devices.desktop, devices.tablet, devices.other],
                    backgroundColor: [
                        'rgba(255, 152, 0, 0.7)',
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(156, 39, 176, 0.7)',
                        'rgba(96, 125, 139, 0.7)'
                    ],
                    borderColor: [
                        '#ff9800',
                        '#2196f3',
                        '#9c27b0',
                        '#607d8b'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e0e0e0'
                        }
                    }
                }
            }
        });
    }

    // Create Login Trends Chart
    function createLoginTrendsChart(data) {
        const ctx = document.getElementById('login-trends-chart').getContext('2d');

        // Destroy existing chart if it exists
        if (loginTrendsChart) loginTrendsChart.destroy();

        // Prepare data
        const timeData = data.loginStats.timeDistribution;
        const labels = timeData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const successData = timeData.map(item => item.successCount);
        const failData = timeData.map(item => item.failCount);

        loginTrendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Successful',
                        data: successData,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2
                    },
                    {
                        label: 'Failed',
                        data: failData,
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#aaa'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#aaa'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0'
                        }
                    }
                }
            }
        });
    }

    // Load Active Sessions Data
    async function loadActiveSessions(page = 1, filters = {}) {
        currentSessionsPage = page;

        try {
            // Show loading indicator
            sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-indicator">
                        <span class="spinner"></span> Loading sessions...
                    </td>
                </tr>
            `;

            // Build query string from filters
            let queryParams = new URLSearchParams();
            queryParams.append('page', page);
            queryParams.append('limit', 10);

            if (filters.username) queryParams.append('username', filters.username);
            if (filters.device) queryParams.append('device', filters.device);
            if (filters.ip) queryParams.append('ip', filters.ip);

            const response = await fetch(`${API_BASE_URL}/auth/admin/active-sessions?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load active sessions');
            }

            const data = await response.json();
            renderSessionsTable(data.sessions);
            renderPagination(sessionsPagination, data.pagination, 'loadActiveSessions');

        } catch (error) {
            console.error('Error loading sessions:', error);
            sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-indicator">
                        Error loading sessions: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    // Render Sessions Table
    function renderSessionsTable(sessions) {
        if (!sessions || sessions.length === 0) {
            sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-indicator">
                        No active sessions found
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';

        sessions.forEach(session => {
            const lastActive = new Date(session.lastActive).toLocaleString();
            const created = new Date(session.createdAt).toLocaleString();
            const expires = session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'Never';

            html += `
                <tr>
                    <td>${session.username}</td>
                    <td>${session.deviceInfo || 'Unknown Device'}</td>
                    <td>${session.ipAddress || 'Unknown IP'}</td>
                    <td>${session.location || 'Unknown Location'}</td>
                    <td>${lastActive}</td>
                    <td>${created}</td>
                    <td>${expires}</td>
                </tr>
            `;
        });

        sessionsTableBody.innerHTML = html;
    }

    // Load Authentication Patterns
    async function loadAuthPatterns(page = 1, filters = {}) {
        currentPatternsPage = page;

        try {
            // Show loading indicator
            patternsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-indicator">
                        <span class="spinner"></span> Loading auth patterns...
                    </td>
                </tr>
            `;

            // Build query string from filters
            let queryParams = new URLSearchParams();
            queryParams.append('page', page);
            queryParams.append('limit', 10);

            if (filters.username) queryParams.append('username', filters.username);
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);

            const response = await fetch(`${API_BASE_URL}/auth/admin/auth-patterns?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load authentication patterns');
            }

            const data = await response.json();
            renderPatternsTable(data.authPatterns);
            renderPagination(patternsPagination, data.pagination, 'loadAuthPatterns');

        } catch (error) {
            console.error('Error loading auth patterns:', error);
            patternsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-indicator">
                        Error loading auth patterns: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    // Render Authentication Patterns Table
    function renderPatternsTable(patterns) {
        if (!patterns || patterns.length === 0) {
            patternsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-indicator">
                        No authentication patterns found
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';

        patterns.forEach(pattern => {
            const lastLogin = pattern.lastLogin ? new Date(pattern.lastLogin).toLocaleString() : 'Never';

            // Create auth methods badges
            let authMethodsHtml = '';
            if (pattern.authMethods.password) {
                authMethodsHtml += '<span class="badge blue">Password</span>';
            }
            if (pattern.authMethods.biometric) {
                authMethodsHtml += '<span class="badge green">Biometric</span>';
            }
            if (pattern.authMethods.social) {
                authMethodsHtml += '<span class="badge orange">Social</span>';
            }

            // Create devices badges
            let devicesHtml = '';
            const deviceTypes = pattern.deviceTypes;

            if (deviceTypes.mobile > 0) {
                devicesHtml += `<span class="badge orange">Mobile (${deviceTypes.mobile})</span>`;
            }
            if (deviceTypes.desktop > 0) {
                devicesHtml += `<span class="badge blue">Desktop (${deviceTypes.desktop})</span>`;
            }
            if (deviceTypes.tablet > 0) {
                devicesHtml += `<span class="badge green">Tablet (${deviceTypes.tablet})</span>`;
            }
            if (deviceTypes.other > 0) {
                devicesHtml += `<span class="badge">Other (${deviceTypes.other})</span>`;
            }

            html += `
                <tr>
                    <td>${pattern.username}</td>
                    <td>${pattern.email}</td>
                    <td>${lastLogin}</td>
                    <td>${authMethodsHtml}</td>
                    <td>${pattern.activeSessions}</td>
                    <td>${devicesHtml}</td>
                </tr>
            `;
        });

        patternsTableBody.innerHTML = html;
    }

    // Render Pagination
    function renderPagination(container, pagination, callbackName) {
        if (!pagination || pagination.total === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        const currentPage = pagination.page;
        const totalPages = pagination.pages;

        // Previous button
        if (currentPage > 1) {
            html += `<button class="pagination-button" onclick="${callbackName}(${currentPage - 1}, getFilters('${callbackName}'))">Prev</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" onclick="${callbackName}(${i}, getFilters('${callbackName}'))">${i}</button>`;
        }

        // Next button
        if (currentPage < totalPages) {
            html += `<button class="pagination-button" onclick="${callbackName}(${currentPage + 1}, getFilters('${callbackName}'))">Next</button>`;
        }

        container.innerHTML = html;
    }

    // Get current filters based on tab
    function getFilters(callbackName) {
        if (callbackName === 'loadActiveSessions') {
            return {
                username: sessionsUsernameFilter.value,
                device: sessionsDeviceFilter.value,
                ip: sessionsIpFilter.value
            };
        } else if (callbackName === 'loadAuthPatterns') {
            return {
                username: patternsUsernameFilter.value,
                startDate: patternsStartDate.value,
                endDate: patternsEndDate.value
            };
        }

        return {};
    }

    // Setup filter events
    applySessionsFilter.addEventListener('click', () => {
        loadActiveSessions(1, {
            username: sessionsUsernameFilter.value,
            device: sessionsDeviceFilter.value,
            ip: sessionsIpFilter.value
        });
    });

    applyPatternsFilter.addEventListener('click', () => {
        loadAuthPatterns(1, {
            username: patternsUsernameFilter.value,
            startDate: patternsStartDate.value,
            endDate: patternsEndDate.value
        });
    });

    // Setup logout
    function setupLogout() {
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                        method: 'POST',
                        credentials: 'include'
                    });

                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/auth.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/auth.html';
                }
            });
        }
    }

    // Expose functions to window for pagination callbacks
    window.loadActiveSessions = loadActiveSessions;
    window.loadAuthPatterns = loadAuthPatterns;
});
