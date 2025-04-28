/**
 * Era Platform Notification Badge Component
 * Provides a real-time notification counter for the app header
 */

class NotificationBadge {
  constructor(options = {}) {
    this.options = {
      selector: options.selector || '#notification-badge',
      apiUrl: options.apiUrl || `${window.location.origin}/notifications/unread/count`,
      socketUrl: options.socketUrl || window.location.origin,
      updateInterval: options.updateInterval || 60000, // Default 1 minute
      maxCount: options.maxCount || 99,
      animationDuration: options.animationDuration || 500,
      token: options.token || localStorage.getItem('token')
    };

    this.count = 0;
    this.element = null;
    this.socket = null;
    this.intervalId = null;

    this.init();
  }

  init() {
    // Find or create the badge element
    this.element = document.querySelector(this.options.selector);

    if (!this.element) {
      console.warn(`Notification badge element not found with selector: ${this.options.selector}`);
      return;
    }

    // Hide badge initially
    this.element.style.display = 'none';

    // Initial count fetch
    this.fetchCount();

    // Setup interval for periodic updates
    this.intervalId = setInterval(() => {
      this.fetchCount();
    }, this.options.updateInterval);

    // Setup Socket.io connection for real-time updates
    this.setupSocket();
  }

  async fetchCount() {
    if (!this.options.token) {
      this.options.token = localStorage.getItem('token');
      if (!this.options.token) {
        console.warn('No authentication token found for notification badge');
        return;
      }
    }

    try {
      const response = await fetch(this.options.apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.options.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notification count: ${response.status}`);
      }

      const data = await response.json();
      this.updateCount(data.count);

    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }

  setupSocket() {
    if (!window.io) {
      console.warn('Socket.io client not found. Real-time notification updates will not work.');
      return;
    }

    // Connect to socket
    this.socket = io(this.options.socketUrl, {
      auth: {
        token: this.options.token
      }
    });

    // Listen for notification count updates
    this.socket.on('unread_notifications_count', (data) => {
      this.updateCount(data.count);
    });

    // Listen for new notifications
    this.socket.on('notification', (notification) => {
      // Increment count by 1 for each new notification
      this.updateCount(this.count + 1);

      // Show notification if EraNotification is available
      if (window.EraNotification) {
        window.EraNotification.info(
          notification.content,
          notification.title,
          8000
        );
      }
    });

    // Handle reconnection
    this.socket.on('reconnect', () => {
      this.fetchCount(); // Refresh count after reconnection
    });
  }

  updateCount(newCount) {
    // If count hasn't changed, do nothing
    if (this.count === newCount) {
      return;
    }

    const oldCount = this.count;
    this.count = newCount;

    // Update the badge
    if (newCount <= 0) {
      // Hide badge if count is 0
      this.element.style.display = 'none';
      this.element.textContent = '';
    } else {
      // Format the count
      const displayCount = newCount > this.options.maxCount ? `${this.options.maxCount}+` : newCount.toString();

      // Update badge text
      this.element.textContent = displayCount;

      // Show badge
      this.element.style.display = 'flex';

      // Add animation if count increased
      if (newCount > oldCount) {
        this.animateBadge();
      }
    }

    // Dispatch event for other components to react
    const event = new CustomEvent('notificationCountUpdated', {
      detail: { count: newCount }
    });
    document.dispatchEvent(event);
  }

  animateBadge() {
    // Simple pulse animation
    this.element.classList.add('pulse-animation');

    setTimeout(() => {
      this.element.classList.remove('pulse-animation');
    }, this.options.animationDuration);
  }

  destroy() {
    // Clean up resources
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Add pulse animation style
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-animation {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }

    .pulse-animation {
      animation: pulse-animation 0.5s ease;
    }

    .notification-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: -8px;
      right: -8px;
      min-width: 18px;
      height: 18px;
      background-color: #e74c3c;
      color: white;
      font-size: 12px;
      font-weight: bold;
      border-radius: 9px;
      padding: 0 5px;
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);
});

// Export the NotificationBadge class
window.NotificationBadge = NotificationBadge;
