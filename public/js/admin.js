document.addEventListener('DOMContentLoaded', function() {
    // Authentication check
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

    // Check if user is logged in and is admin
    if (!token || !userData) {
        window.location.href = '/auth.html';
        return;
    }

    // Check if user has admin role
    if (!userData.roles || !userData.roles.includes('ADMIN')) {
        showNotification('You do not have permission to access the admin dashboard.', 'error');
        setTimeout(() => {
            window.location.href = '/map.html';
        }, 3000);
        return;
    }

    // Update avatar from userData
    if (userData && userData.avatar) {
        document.getElementById('avatar').src = userData.avatar;
    }

    // Initialize UI
    initTabs();
    initModals();
    loadData();
    setupEventListeners();

    // Setup avatar dropdown toggle
    document.getElementById('avatar').addEventListener('click', function() {
        document.getElementById('dropdown').classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', function(e) {
        if (!document.getElementById('profile').contains(e.target)) {
            document.getElementById('dropdown').classList.add('hidden');
        }
    });

    // Profile button handler
    document.getElementById('profile-btn').addEventListener('click', function() {
        window.location.href = '/profile.html';
    });

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = '/auth.html';
    });

    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        document.getElementById('header')?.classList.toggle('dark-mode');
        document.getElementById('sidebar')?.classList.toggle('dark-mode');
        document.getElementById('header__input')?.classList.toggle('dark-mode');
        const darkModeButton = document.getElementById('dark-mode-toggle');
        darkModeButton.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
    });
});

// Initialize tab switching
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const tabContentContainer = document.querySelector('.tab-content-container');

    // Add click event to each tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Load the tab content
            const tabId = tab.getAttribute('data-tab');
            loadTabContent(tabId, tabContentContainer);
        });
    });

    // Load the first tab by default
    loadTabContent('users-tab', tabContentContainer);
}

// Load tab content
function loadTabContent(tabId, container) {
    // Clear container
    container.innerHTML = '';

    // Load content based on tab ID
    switch (tabId) {
        case 'users-tab':
            loadUsersTab(container);
            break;
        case 'locations-tab':
            loadLocationsTab(container);
            break;
        case 'analytics-tab':
            loadAnalyticsTab(container);
            break;
        case 'settings-tab':
            loadSettingsTab(container);
            break;
        default:
            container.innerHTML = '<p>Tab content not found</p>';
    }
}

// Load Users Tab Content
function loadUsersTab(container) {
    const token = localStorage.getItem('token');
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content active';
    tabContent.id = 'users-tab-content';

    // Add search and filter controls
    const controlsHTML = `
        <input type="text" class="search-bar" id="user-search" placeholder="Search users by username, email or name...">
        <div class="filter-controls">
            <select class="filter-select" id="role-filter">
                <option value="">All Roles</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
            </select>
            <select class="filter-select" id="sort-users">
                <option value="username">Sort by Username</option>
                <option value="email">Sort by Email</option>
                <option value="createdAt">Sort by Date Created</option>
            </select>
        </div>
    `;

    // Create user table
    const tableHTML = `
        <table id="users-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Full Name</th>
                    <th>Roles</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="6" style="text-align: center;">Loading users...</td>
                </tr>
            </tbody>
        </table>
        <div class="pagination" id="users-pagination"></div>
    `;

    // Combine HTML
    tabContent.innerHTML = controlsHTML + tableHTML;
    container.appendChild(tabContent);

    // Add event listeners for search and filters
    document.getElementById('user-search').addEventListener('input', debounce(filterUsers, 300));
    document.getElementById('role-filter').addEventListener('change', filterUsers);
    document.getElementById('sort-users').addEventListener('change', filterUsers);

    // Load users data
    fetch('/profile/users', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        return response.json();
    })
    .then(users => {
        // Store users data
        window.adminData = window.adminData || {};
        window.adminData.users = users;

        // Render users
        renderUsers(users);
    })
    .catch(error => {
        console.error('Error loading users:', error);
        document.querySelector('#users-table tbody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #e74c3c;">
                Error loading users: ${error.message}
            </td></tr>
        `;
    });
}

// Load Locations Tab Content
function loadLocationsTab(container) {
    const token = localStorage.getItem('token');
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content active';
    tabContent.id = 'locations-tab-content';

    // Add search and filter controls
    const controlsHTML = `
        <input type="text" class="search-bar" id="location-search" placeholder="Search locations by name, description or tags...">
        <div class="filter-controls">
            <select class="filter-select" id="visibility-filter">
                <option value="">All Locations</option>
                <option value="true">Public Only</option>
                <option value="false">Private Only</option>
            </select>
            <select class="filter-select" id="sort-locations">
                <option value="createdAt">Sort by Date Created</option>
                <option value="name">Sort by Name</option>
                <option value="user">Sort by User</option>
            </select>
        </div>
    `;

    // Create locations table
    const tableHTML = `
        <table id="locations-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>User</th>
                    <th>Visibility</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="6" style="text-align: center;">Loading locations...</td>
                </tr>
            </tbody>
        </table>
        <div class="pagination" id="locations-pagination"></div>
    `;

    // Combine HTML
    tabContent.innerHTML = controlsHTML + tableHTML;
    container.appendChild(tabContent);

    // Add event listeners for search and filters
    document.getElementById('location-search').addEventListener('input', debounce(filterLocations, 300));
    document.getElementById('visibility-filter').addEventListener('change', filterLocations);
    document.getElementById('sort-locations').addEventListener('change', filterLocations);

    // Load locations data
    fetch('/locations/public', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load locations');
        }
        return response.json();
    })
    .then(locations => {
        // Store locations data
        window.adminData = window.adminData || {};
        window.adminData.locations = locations;

        // Render locations
        renderLocations(locations);
    })
    .catch(error => {
        console.error('Error loading locations:', error);
        document.querySelector('#locations-table tbody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #e74c3c;">
                Error loading locations: ${error.message}
            </td></tr>
        `;
    });
}

// Load Analytics Tab Content
function loadAnalyticsTab(container) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content active';
    tabContent.id = 'analytics-tab-content';

    // Create analytics dashboard layout
    const analyticsHTML = `
        <div class="analytics-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-users">-</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-locations">-</div>
                <div class="stat-label">Total Locations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="public-locations">-</div>
                <div class="stat-label">Public Locations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="active-users">-</div>
                <div class="stat-label">Active Users (24h)</div>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">User Growth</h3>
            <div class="chart-container">
                <canvas id="user-growth-chart"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">Location Distribution</h3>
            <div class="chart-container">
                <canvas id="location-chart"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">Most Active Users</h3>
            <table id="active-users-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Locations Created</th>
                        <th>Last Active</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="3" style="text-align: center;">Loading user activity data...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    tabContent.innerHTML = analyticsHTML;
    container.appendChild(tabContent);

    // Load and display analytics data
    loadAnalyticsData();
}

// Load Settings Tab Content
function loadSettingsTab(container) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content active';
    tabContent.id = 'settings-tab-content';

    // Create settings form
    const settingsHTML = `
        <div class="card">
            <h3 class="card-title">Application Settings</h3>
            <form id="settings-form">
                <div class="form-group">
                    <label class="form-label" for="app-name">Application Name</label>
                    <input type="text" id="app-name" name="appName" class="form-input" value="Era Platform">
                </div>

                <div class="form-group">
                    <label class="form-label" for="default-radius">Default Search Radius (meters)</label>
                    <input type="number" id="default-radius" name="defaultRadius" class="form-input" value="5000">
                </div>

                <div class="form-group">
                    <label class="form-label">Allowed Languages</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="en" checked>
                            <span style="margin-left: 5px;">English</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="es" checked>
                            <span style="margin-left: 5px;">Spanish</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="fr" checked>
                            <span style="margin-left: 5px;">French</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="de" checked>
                            <span style="margin-left: 5px;">German</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="uk" checked>
                            <span style="margin-left: 5px;">Ukrainian</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="ja">
                            <span style="margin-left: 5px;">Japanese</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="languages" value="zh">
                            <span style="margin-left: 5px;">Chinese</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Features Enabled</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="features" value="social" checked>
                            <span style="margin-left: 5px;">Social Features</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="features" value="location_tracking" checked>
                            <span style="margin-left: 5px;">Location Tracking</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="features" value="chat" checked>
                            <span style="margin-left: 5px;">Chat System</span>
                        </label>
                        <label style="display: flex; align-items: center; color: #ccc;">
                            <input type="checkbox" name="features" value="notifications" checked>
                            <span style="margin-left: 5px;">Push Notifications</span>
                        </label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="admin-button primary">Save Settings</button>
                </div>
            </form>
        </div>

        <div class="card">
            <h3 class="card-title">System Information</h3>
            <table style="margin-top: 15px;">
                <tbody>
                    <tr>
                        <td style="font-weight: 500; width: 200px;">Version</td>
                        <td>1.0.0</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 500;">Environment</td>
                        <td>Development</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 500;">Database Status</td>
                        <td id="db-status">Checking...</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 500;">Last Backup</td>
                        <td>Never</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 20px;">
                <button class="admin-button" id="check-system-btn">Check System Status</button>
                <button class="admin-button" id="backup-btn">Create Backup</button>
            </div>
        </div>
    `;

    tabContent.innerHTML = settingsHTML;
    container.appendChild(tabContent);

    // Add event listeners for settings form
    document.getElementById('settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings(this);
    });

    // Check database status
    fetch('/api/status', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('db-status').textContent =
            data.mockDb ? 'Mock Database (In-Memory)' : 'Connected to MongoDB';
    })
    .catch(() => {
        document.getElementById('db-status').textContent = 'Unknown';
    });

    // Add event listeners for system buttons
    document.getElementById('check-system-btn').addEventListener('click', checkSystemStatus);
    document.getElementById('backup-btn').addEventListener('click', createBackup);
}

// Render users in the table
function renderUsers(users, page = 1, perPage = 10) {
    const tbody = document.querySelector('#users-table tbody');
    const totalUsers = users.length;
    const totalPages = Math.ceil(totalUsers / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedUsers = users.slice(start, end);

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = paginatedUsers.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.fullName || '-'}</td>
            <td>${user.roles ? user.roles.join(', ') : 'USER'}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td class="actions">
                <button class="action-btn edit-user" data-id="${user._id}">Edit</button>
                <button class="action-btn delete action-delete-user" data-id="${user._id}">Delete</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to buttons
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', () => editUser(btn.dataset.id));
    });

    document.querySelectorAll('.action-delete-user').forEach(btn => {
        btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id));
    });

    // Create pagination
    const pagination = document.getElementById('users-pagination');
    pagination.innerHTML = '';

    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => renderUsers(users, i, perPage));
            pagination.appendChild(btn);
        }
    }
}

// Render locations in the table
function renderLocations(locations, page = 1, perPage = 10) {
    const tbody = document.querySelector('#locations-table tbody');
    const totalLocations = locations.length;
    const totalPages = Math.ceil(totalLocations / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedLocations = locations.slice(start, end);

    if (locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No locations found</td></tr>';
        return;
    }

    tbody.innerHTML = paginatedLocations.map(location => `
        <tr>
            <td>${location.name || 'Unnamed Location'}</td>
            <td>${location.address || '-'}</td>
            <td>${location.user ? (location.user.username || '-') : '-'}</td>
            <td>${location.isPublic ? 'Public' : 'Private'}</td>
            <td>${new Date(location.createdAt).toLocaleDateString()}</td>
            <td class="actions">
                <button class="action-btn view-location" data-id="${location._id}">View</button>
                <button class="action-btn delete action-delete-location" data-id="${location._id}">Delete</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to buttons
    document.querySelectorAll('.view-location').forEach(btn => {
        btn.addEventListener('click', () => viewLocation(btn.dataset.id));
    });

    document.querySelectorAll('.action-delete-location').forEach(btn => {
        btn.addEventListener('click', () => confirmDeleteLocation(btn.dataset.id));
    });

    // Create pagination
    const pagination = document.getElementById('locations-pagination');
    pagination.innerHTML = '';

    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => renderLocations(locations, i, perPage));
            pagination.appendChild(btn);
        }
    }
}

// Load analytics data and create charts
function loadAnalyticsData() {
    // Get stored data
    const users = window.adminData?.users || [];
    const locations = window.adminData?.locations || [];

    // Update stat cards
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('total-locations').textContent = locations.length;
    document.getElementById('public-locations').textContent =
        locations.filter(loc => loc.isPublic).length;

    // For this demo, we'll simulate active users
    const activeUserCount = Math.min(Math.floor(users.length * 0.7), users.length);
    document.getElementById('active-users').textContent = activeUserCount;

    // Create user growth chart (mock data)
    const userGrowthCtx = document.getElementById('user-growth-chart').getContext('2d');
    const now = new Date();
    const months = [];
    const userData = [];

    for (let i = 6; i >= 0; i--) {
        const month = new Date(now);
        month.setMonth(now.getMonth() - i);
        months.push(month.toLocaleDateString('default', { month: 'short' }));

        // Create mock growth data
        const baseline = users.length > 10 ? Math.floor(users.length * 0.5) : 5;
        const growth = Math.floor(baseline * (1 + (i * 0.2)));
        userData.push(growth);
    }

    new Chart(userGrowthCtx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Users',
                data: userData,
                backgroundColor: 'rgba(11, 147, 246, 0.2)',
                borderColor: 'rgba(11, 147, 246, 1)',
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#aaa'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#aaa'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ccc'
                    }
                }
            }
        }
    });

    // Create location distribution chart
    const locationCtx = document.getElementById('location-chart').getContext('2d');
    new Chart(locationCtx, {
        type: 'pie',
        data: {
            labels: ['Public', 'Private'],
            datasets: [{
                data: [
                    locations.filter(loc => loc.isPublic).length,
                    locations.filter(loc => !loc.isPublic).length
                ],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ccc'
                    }
                }
            }
        }
    });

    // Create active users table (mock data)
    const activeUsersTable = document.getElementById('active-users-table').querySelector('tbody');

    // Sort users by most locations created (mock data)
    const sortedUsers = [...users]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

    activeUsersTable.innerHTML = sortedUsers.map(user => {
        const locationsCreated = Math.floor(Math.random() * 10);
        const lastActive = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));

        return `
            <tr>
                <td>${user.username}</td>
                <td>${locationsCreated}</td>
                <td>${lastActive.toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

// Filter users based on search and filters
function filterUsers() {
    const users = window.adminData?.users || [];
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const roleFilter = document.getElementById('role-filter').value;
    const sortBy = document.getElementById('sort-users').value;

    // Filter users
    let filteredUsers = users.filter(user => {
        const matchesSearch = !searchTerm ||
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.fullName && user.fullName.toLowerCase().includes(searchTerm));

        const matchesRole = !roleFilter ||
            (user.roles && user.roles.includes(roleFilter));

        return matchesSearch && matchesRole;
    });

    // Sort users
    filteredUsers.sort((a, b) => {
        switch (sortBy) {
            case 'username':
                return (a.username || '').localeCompare(b.username || '');
            case 'email':
                return (a.email || '').localeCompare(b.email || '');
            case 'createdAt':
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            default:
                return 0;
        }
    });

    // Render filtered users
    renderUsers(filteredUsers);
}

// Filter locations based on search and filters
function filterLocations() {
    const locations = window.adminData?.locations || [];
    const searchTerm = document.getElementById('location-search').value.toLowerCase();
    const visibilityFilter = document.getElementById('visibility-filter').value;
    const sortBy = document.getElementById('sort-locations').value;

    // Filter locations
    let filteredLocations = locations.filter(location => {
        const matchesSearch = !searchTerm ||
            (location.name && location.name.toLowerCase().includes(searchTerm)) ||
            (location.description && location.description.toLowerCase().includes(searchTerm)) ||
            (location.tags && location.tags.some(tag => tag.toLowerCase().includes(searchTerm)));

        const matchesVisibility = visibilityFilter === '' ||
            (visibilityFilter === 'true' && location.isPublic) ||
            (visibilityFilter === 'false' && !location.isPublic);

        return matchesSearch && matchesVisibility;
    });

    // Sort locations
    filteredLocations.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'user':
                return (a.user?.username || '').localeCompare(b.user?.username || '');
            case 'createdAt':
            default:
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
    });

    // Render filtered locations
    renderLocations(filteredLocations);
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Edit user
function editUser(userId) {
    const token = localStorage.getItem('token');
    const users = window.adminData?.users || [];
    const user = users.find(u => u._id === userId);

    if (!user) {
        showNotification('User not found', 'error');
        return;
    }

    // Set up form
    const form = document.getElementById('user-form');
    form.innerHTML = createUserFormHTML(user);
    form.dataset.mode = 'edit';
    form.dataset.userId = userId;

    // Setup form submission
    form.onsubmit = function(e) {
        e.preventDefault();
        updateUser(this, userId);
    };

    // Show modal
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('user-modal').classList.add('active');
}

// Initialize modals
function initModals() {
    // User modal close button
    document.getElementById('user-modal-close').addEventListener('click', () => {
        document.getElementById('user-modal').classList.remove('active');
    });

    // Confirmation modal close button
    document.getElementById('confirm-modal-close').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('active');
    });

    // Cancel action button
    document.getElementById('cancel-action').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('active');
    });

    // Add user button
    document.getElementById('add-user-btn').addEventListener('click', () => {
        // Reset form
        const form = document.getElementById('user-form');
        form.innerHTML = createUserFormHTML();
        form.dataset.mode = 'add';
        form.dataset.userId = '';

        // Setup form submission
        form.onsubmit = function(e) {
            e.preventDefault();
            const mode = this.dataset.mode;
            if (mode === 'add') {
                addUser(this);
            } else if (mode === 'edit') {
                updateUser(this, this.dataset.userId);
            }
        };

        // Show modal
        document.getElementById('user-modal-title').textContent = 'Add New User';
        document.getElementById('user-modal').classList.add('active');
    });

    // Export data button
    document.getElementById('export-data-btn').addEventListener('click', exportData);
}

// Setup additional event listeners
function setupEventListeners() {
    // Additional event listeners can be added here
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification';
    notification.classList.add(type);
    notification.classList.add('active');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('active');
    }, 5000);
}

// Create HTML for user form
function createUserFormHTML(user = null) {
    return `
        <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input type="text" id="username" name="username" class="form-input" required
                value="${user ? user.username : ''}">
        </div>
        <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input type="email" id="email" name="email" class="form-input" required
                value="${user ? user.email : ''}">
        </div>
        <div class="form-group">
            <label class="form-label" for="password">Password ${user ? '(leave blank to keep current)' : ''}</label>
            <input type="password" id="password" name="password" class="form-input"
                ${user ? '' : 'required'}>
        </div>
        <div class="form-group">
            <label class="form-label" for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" class="form-input"
                value="${user && user.fullName ? user.fullName : ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Roles</label>
            <div style="display: flex; gap: 15px;">
                <label style="display: flex; align-items: center; color: #ccc;">
                    <input type="checkbox" name="roles" value="USER"
                        ${!user || (user.roles && user.roles.includes('USER')) ? 'checked' : ''}>
                    <span style="margin-left: 5px;">User</span>
                </label>
                <label style="display: flex; align-items: center; color: #ccc;">
                    <input type="checkbox" name="roles" value="ADMIN"
                        ${user && user.roles && user.roles.includes('ADMIN') ? 'checked' : ''}>
                    <span style="margin-left: 5px;">Admin</span>
                </label>
            </div>
        </div>
        <div class="form-actions">
            <button type="button" class="admin-button"
                onclick="document.getElementById('user-modal').classList.remove('active')">
                Cancel
            </button>
            <button type="submit" class="admin-button primary">
                ${user ? 'Update User' : 'Add User'}
            </button>
        </div>
    `;
}

// Load app data
function loadData() {
    // This function can be extended to load initial data
    // For now, the data will be loaded when each tab is clicked
}

// Export data as JSON
function exportData() {
    const token = localStorage.getItem('token');

    // Create confirmation modal
    document.getElementById('confirm-message').textContent =
        'Are you sure you want to export all data? This may take a few moments.';

    document.getElementById('confirm-action').onclick = function() {
        // Show loading notification
        showNotification('Exporting data, please wait...', 'success');

        // Close modal
        document.getElementById('confirm-modal').classList.remove('active');

        // In a real implementation, we would fetch data from server
        // For this demo, we'll create a simple data structure

        // Simulate API calls to get data
        Promise.all([
            fetch('/profile/users', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()),
            fetch('/locations/public', { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json())
        ])
        .then(([users, locations]) => {
            // Build export data object
            const exportData = {
                users: users,
                locations: locations,
                exportDate: new Date().toISOString(),
                exportedBy: JSON.parse(localStorage.getItem('user')).username
            };

            // Convert to JSON string
            const dataStr = JSON.stringify(exportData, null, 2);

            // Create download link
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `era-export-${new Date().toISOString().slice(0,10)}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();

            showNotification('Data exported successfully!', 'success');
        })
        .catch(error => {
            console.error('Export error:', error);
            showNotification('Error exporting data: ' + error.message, 'error');
        });
    };

    // Show confirmation modal
    document.getElementById('confirm-modal').classList.add('active');
}

// Add new user
function addUser(form) {
    const token = localStorage.getItem('token');

    // Get form data
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const fullName = form.fullName.value.trim();
    const rolesElements = form.querySelectorAll('input[name="roles"]:checked');
    const roles = Array.from(rolesElements).map(el => el.value);

    // Validate form
    if (!username || !email || !password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Prepare user data
    const userData = {
        username,
        email,
        password,
        fullName,
        roles
    };

    // Send to server
    fetch('/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Failed to create user');
            });
        }
        return response.json();
    })
    .then(data => {
        // Close modal
        document.getElementById('user-modal').classList.remove('active');

        // Add user to local data
        if (window.adminData && window.adminData.users) {
            window.adminData.users.push(data.user);

            // Re-render users table
            renderUsers(window.adminData.users);
        }

        showNotification('User created successfully', 'success');
    })
    .catch(error => {
        console.error('Error creating user:', error);
        showNotification(error.message, 'error');
    });
}

// Update existing user
function updateUser(form, userId) {
    const token = localStorage.getItem('token');

    // Get form data
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const fullName = form.fullName.value.trim();
    const rolesElements = form.querySelectorAll('input[name="roles"]:checked');
    const roles = Array.from(rolesElements).map(el => el.value);

    // Validate form
    if (!username || !email) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Prepare user data
    const userData = {
        username,
        email,
        fullName,
        roles
    };

    // Add password only if provided
    if (password) {
        userData.password = password;
    }

    // Send to server
    fetch(`/profile/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Failed to update user');
            });
        }
        return response.json();
    })
    .then(data => {
        // Close modal
        document.getElementById('user-modal').classList.remove('active');

        // Update user in local data
        if (window.adminData && window.adminData.users) {
            const index = window.adminData.users.findIndex(u => u._id === userId);
            if (index !== -1) {
                window.adminData.users[index] = data.user;
            }

            // Re-render users table
            renderUsers(window.adminData.users);
        }

        showNotification('User updated successfully', 'success');
    })
    .catch(error => {
        console.error('Error updating user:', error);
        showNotification(error.message, 'error');
    });
}

// Confirm user deletion
function confirmDeleteUser(userId) {
    const users = window.adminData?.users || [];
    const user = users.find(u => u._id === userId);

    if (!user) {
        showNotification('User not found', 'error');
        return;
    }

    // Setup confirmation modal
    document.getElementById('confirm-message').textContent =
        `Are you sure you want to delete the user "${user.username}"? This action cannot be undone.`;

    document.getElementById('confirm-action').onclick = function() {
        deleteUser(userId);
        document.getElementById('confirm-modal').classList.remove('active');
    };

    // Show confirmation modal
    document.getElementById('confirm-modal').classList.add('active');
}

// Delete user
function deleteUser(userId) {
    const token = localStorage.getItem('token');

    fetch(`/profile/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Failed to delete user');
            });
        }
        return response.json();
    })
    .then(data => {
        // Remove user from local data
        if (window.adminData && window.adminData.users) {
            window.adminData.users = window.adminData.users.filter(u => u._id !== userId);

            // Re-render users table
            renderUsers(window.adminData.users);
        }

        showNotification('User deleted successfully', 'success');
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        showNotification(error.message, 'error');
    });
}

// View location details
function viewLocation(locationId) {
    const token = localStorage.getItem('token');
    const locations = window.adminData?.locations || [];
    const location = locations.find(l => l._id === locationId);

    if (!location) {
        showNotification('Location not found', 'error');
        return;
    }

    // Redirect to map page with location ID
    window.location.href = `/map.html?location=${locationId}`;
}

// Confirm location deletion
function confirmDeleteLocation(locationId) {
    const locations = window.adminData?.locations || [];
    const location = locations.find(l => l._id === locationId);

    if (!location) {
        showNotification('Location not found', 'error');
        return;
    }

    // Setup confirmation modal
    document.getElementById('confirm-message').textContent =
        `Are you sure you want to delete the location "${location.name || 'Unnamed Location'}"? This action cannot be undone.`;

    document.getElementById('confirm-action').onclick = function() {
        deleteLocation(locationId);
        document.getElementById('confirm-modal').classList.remove('active');
    };

    // Show confirmation modal
    document.getElementById('confirm-modal').classList.add('active');
}

// Delete location
function deleteLocation(locationId) {
    const token = localStorage.getItem('token');

    fetch(`/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Failed to delete location');
            });
        }
        return response.json();
    })
    .then(data => {
        // Remove location from local data
        if (window.adminData && window.adminData.locations) {
            window.adminData.locations = window.adminData.locations.filter(l => l._id !== locationId);

            // Re-render locations table
            renderLocations(window.adminData.locations);
        }

        showNotification('Location deleted successfully', 'success');
    })
    .catch(error => {
        console.error('Error deleting location:', error);
        showNotification(error.message, 'error');
    });
}

// Save application settings
function saveSettings(form) {
    // Get form data
    const appName = form.appName.value.trim();
    const defaultRadius = parseInt(form.defaultRadius.value);
    const languageElements = form.querySelectorAll('input[name="languages"]:checked');
    const languages = Array.from(languageElements).map(el => el.value);
    const featureElements = form.querySelectorAll('input[name="features"]:checked');
    const features = Array.from(featureElements).map(el => el.value);

    // In a real app, we would save these settings to server
    // For this demo, we'll just show a notification

    const settingsData = {
        appName,
        defaultRadius,
        languages,
        features
    };

    console.log('Saving settings:', settingsData);

    // Simulate server request with a timeout
    setTimeout(() => {
        // Save settings to localStorage for demo purposes
        localStorage.setItem('adminSettings', JSON.stringify(settingsData));

        showNotification('Settings saved successfully', 'success');
    }, 500);
}

// Check system status
function checkSystemStatus() {
    const token = localStorage.getItem('token');

    // Show loading notification
    showNotification('Checking system status...', 'success');

    // Check API status
    fetch('/api/status', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        // Show status information
        const statusMessage = `
            System is online.
            Environment: ${data.environment}
            Database: ${data.mockDb ? 'Mock Database (In-Memory)' : 'MongoDB Connected'}
            Server Time: ${new Date(data.time).toLocaleString()}
        `;

        showNotification(statusMessage, 'success');
    })
    .catch(error => {
        console.error('Error checking system status:', error);
        showNotification('Error checking system status: ' + error.message, 'error');
    });
}

// Create backup (mock function)
function createBackup() {
    // Show loading notification
    showNotification('Creating backup...', 'success');

    // Simulate backup process with timeout
    setTimeout(() => {
        showNotification('Backup created successfully', 'success');

        // Update backup time in UI
        const backupTimeCells = document.querySelectorAll('table td');
        backupTimeCells.forEach(cell => {
            if (cell.previousElementSibling &&
                cell.previousElementSibling.textContent === 'Last Backup') {
                cell.textContent = new Date().toLocaleString();
            }
        });
    }, 2000);
}
