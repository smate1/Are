// Social.js - Core functionality for the social network features

// Global state for social data
const socialState = {
    friends: [],
    requests: {
        sent: [],
        received: []
    },
    activity: [],
    searchResults: [],
    nearbyUsers: [],
    socket: null
};

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Social network module loaded');

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user) {
        console.log('User not logged in, redirecting to auth page');
        window.location.href = '/auth.html';
        return;
    }

    // Initialize UI elements
    initializeUI();

    // Load user's friends
    loadFriends();

    // Load friend requests
    loadFriendRequests();

    // Initialize socket connection
    initSocketConnection(token);

    // Load initial data
    loadSocialData();

    // Setup other event listeners
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

// Initialize UI elements
function initializeUI() {
    // Set up user profile section
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userUsername = document.getElementById('user-username');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (userAvatar && user.avatar) {
        userAvatar.src = user.avatar;
    }

    if (userName && user.fullName) {
        userName.textContent = user.fullName;
    }

    if (userUsername && user.username) {
        userUsername.textContent = '@' + user.username;
    }

    // Set up event listeners
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            searchUsers(searchInput.value);
        }, 300));
    }

    // Setup tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            activateTab(tabName);
        });
    });
}

// Load user's friends
function loadFriends() {
    const token = localStorage.getItem('token');
    const friendsList = document.getElementById('friends-list');

    if (!friendsList) return;

    // Display loading state
    friendsList.innerHTML = '<p class="loading">Loading friends...</p>';

    // Normally we would fetch from the server
    // For demo, we'll use mock data
    setTimeout(() => {
        // Sample empty state
        friendsList.innerHTML = '<p class="empty-state">You don\'t have any friends yet. Use the search to find users.</p>';
    }, 1000);
}

// Load friend requests
function loadFriendRequests() {
    const receivedList = document.getElementById('received-requests');
    const sentList = document.getElementById('sent-requests');

    if (!receivedList || !sentList) return;

    // Display loading state
    receivedList.innerHTML = '<p class="loading">Loading received requests...</p>';
    sentList.innerHTML = '<p class="loading">Loading sent requests...</p>';

    // Normally we would fetch from the server
    // For demo, we'll use mock data
    setTimeout(() => {
        // Sample empty states
        receivedList.innerHTML = '<p class="empty-state">No friend requests received.</p>';
        sentList.innerHTML = '<p class="empty-state">No friend requests sent.</p>';
    }, 1000);
}

// Search users
function searchUsers(query) {
    const searchResults = document.getElementById('search-results');

    if (!searchResults || !query || query.length < 2) {
        searchResults.innerHTML = '<p class="instruction">Type at least 2 characters to search</p>';
        return;
    }

    // Display loading state
    searchResults.innerHTML = '<p class="loading">Searching users...</p>';

    // Normally we would fetch from the server
    // For demo, we'll use mock data
    setTimeout(() => {
        // No results state
        searchResults.innerHTML = '<p class="empty-state">No users found matching your search.</p>';
    }, 1000);
}

// Activate tab
function activateTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Deactivate all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Activate selected tab and content
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-content`)?.classList.add('active');
}

// Initialize socket connection for real-time updates
function initSocketConnection(token) {
    // Check if socket.io is loaded
    if (typeof io === 'undefined') {
        // Socket.io not available, load it dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.6.0/socket.io.min.js';
        script.onload = () => connectSocket(token);
        document.head.appendChild(script);
    } else {
        // Socket.io already loaded
        connectSocket(token);
    }
}

// Connect to socket with auth token
function connectSocket(token) {
    try {
        // Get the server URL from current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port;
        const socketUrl = `${protocol}//${host}${port ? ':' + port : ''}`;

        // Connect to socket with auth token
        socialState.socket = io(socketUrl, {
            auth: { token }
        });

        // Setup socket event handlers
        setupSocketEvents();
    } catch (error) {
        console.error('Socket connection error:', error);
    }
}

// Load initial social data from API
function loadSocialData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Show loading state
    showLoadingState();

    // Fetch friends, requests, and activity data in parallel
    Promise.all([
        fetch('/social/friends', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch friends: ${res.status}`);
            return res.json();
        }),
        fetch('/social/friend-requests', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch friend requests: ${res.status}`);
            return res.json();
        }),
        fetch('/social/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
            return res.json();
        })
    ]).then(([friends, requests, activity]) => {
        console.log('Loaded social data:', { friends, requests, activity });

        // Update state with fetched data
        socialState.friends = friends || [];
        socialState.requests = requests || { sent: [], received: [] };
        socialState.activity = activity || [];

        // Re-render current tab
        const activeTab = document.querySelector('.social-tab.active');
        if (activeTab) {
            renderTabContent(activeTab.getAttribute('data-tab'), document.getElementById('tab-content'));
        }

        hideLoadingState();
    }).catch(error => {
        console.error('Error loading social data:', error);
        showErrorState('Failed to load social data. Please try again.');
        hideLoadingState();
    });
}

// Setup socket event handlers for real-time updates
function setupSocketEvents() {
    const socket = socialState.socket;
    if (!socket) return;

    // Listen for friend request events
    socket.on('friend_request_received', data => {
        // Update pending requests
        socialState.requests.received.push(data.request);

        // Update UI if on requests tab
        if (document.querySelector('.social-tab[data-tab="requests-tab"]').classList.contains('active')) {
            renderRequestsTab();
        }

        // Show notification
        showNotification(`New friend request from ${data.request.username}`);
    });

    // Listen for friend request accepted events
    socket.on('friend_request_accepted', data => {
        // Remove from sent requests
        socialState.requests.sent = socialState.requests.sent.filter(r => r._id !== data.userId);

        // Add to friends list
        socialState.friends.push(data.user);

        // Update UI
        if (document.querySelector('.social-tab[data-tab="friends-tab"]').classList.contains('active')) {
            renderFriendsTab();
        }

        // Show notification
        showNotification(`${data.user.username} accepted your friend request`);
    });

    // Listen for new activity events
    socket.on('new_activity', data => {
        // Add to activity feed
        socialState.activity.unshift(data.activity);

        // Update UI if on activity tab
        if (document.querySelector('.social-tab[data-tab="activity-tab"]').classList.contains('active')) {
            renderActivityTab();
        }
    });

    // Listen for friend location updates
    socket.on('friend_location_update', data => {
        // Update friend's location in friends list
        const friend = socialState.friends.find(f => f._id === data.userId);
        if (friend) {
            friend.currentLocation = {
                coordinates: data.coordinates,
                lastUpdated: new Date(data.lastUpdated),
                isSharing: true
            };
        }
    });

    // Listen for friend location sharing stopped
    socket.on('friend_location_stopped', data => {
        // Update friend's location sharing status
        const friend = socialState.friends.find(f => f._id === data.userId);
        if (friend && friend.currentLocation) {
            friend.currentLocation.isSharing = false;
        }
    });
}

// Utility function: Debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Show loading state
function showLoadingState() {
    const contentContainer = document.getElementById('tab-content');
    contentContainer.innerHTML = `
        <div class="loading-state" style="text-align: center; padding: 50px;">
            <div style="font-size: 20px; margin-bottom: 10px; color: #aaa;">
                ${window.i18n ? window.i18n.getText('common.loading') : 'Loading...'}
            </div>
        </div>
    `;
}

// Hide loading state
function hideLoadingState() {
    // This will be handled by rendering the tab content
}

// Show error state
function showErrorState(message) {
    const contentContainer = document.getElementById('tab-content');
    contentContainer.innerHTML = `
        <div class="error-state" style="text-align: center; padding: 50px;">
            <div style="font-size: 20px; margin-bottom: 10px; color: #e74c3c;">
                ${window.i18n ? window.i18n.getText('common.error') : 'Error'}
            </div>
            <div style="color: #aaa;">${message}</div>
            <button class="button" style="margin-top: 20px;" onclick="loadSocialData()">
                ${window.i18n ? window.i18n.getText('common.retry') : 'Retry'}
            </button>
        </div>
    `;
}

// Show a notification
function showNotification(message, type = 'info') {
    // Check if notification container exists, create if not
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.style.backgroundColor = type === 'error' ? '#e74c3c' : '#0b93f6';
    notification.style.color = 'white';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '5px';
    notification.style.marginBottom = '10px';
    notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    notification.style.transition = 'all 0.3s ease';
    notification.style.opacity = '0';
    notification.textContent = message;

    // Add to container
    notificationContainer.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}
