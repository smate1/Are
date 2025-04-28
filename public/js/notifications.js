/**
 * Era Platform Notification System
 * Provides toast notifications for the frontend
 */

// Create notification container if it doesn't exist
function createNotificationContainer() {
    let container = document.getElementById('notification-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }

            .notification {
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: white;
                transform: translateX(120%);
                transition: transform 0.4s ease;
                animation: slide-in 0.4s forwards;
            }

            .notification.closing {
                animation: slide-out 0.4s forwards;
            }

            .notification-success {
                background-color: #2ecc71;
            }

            .notification-error {
                background-color: #e74c3c;
            }

            .notification-info {
                background-color: #3498db;
            }

            .notification-warning {
                background-color: #f39c12;
            }

            .notification-content {
                flex: 1;
                margin-right: 15px;
            }

            .notification-title {
                font-weight: 600;
                margin-bottom: 5px;
            }

            .notification-message {
                font-size: 14px;
            }

            .notification-close {
                cursor: pointer;
                font-size: 20px;
                opacity: 0.8;
                transition: opacity 0.2s;
                line-height: 1;
            }

            .notification-close:hover {
                opacity: 1;
            }

            @keyframes slide-in {
                from {
                    transform: translateX(120%);
                }
                to {
                    transform: translateX(0);
                }
            }

            @keyframes slide-out {
                from {
                    transform: translateX(0);
                }
                to {
                    transform: translateX(120%);
                }
            }
        `;
        document.head.appendChild(style);
    }

    return container;
}

/**
 * Show a notification
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, info, warning)
 * @param {string} title - Optional title for the notification
 * @param {number} duration - Duration in milliseconds before auto-close (0 for no auto-close)
 * @param {boolean} dismissible - Whether the notification can be dismissed by clicking the X
 * @return {HTMLElement} The notification element
 */
function showNotification(message, type = 'info', title = '', duration = 5000, dismissible = true) {
    const container = createNotificationContainer();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';

    if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'notification-message';
    messageEl.textContent = message;
    content.appendChild(messageEl);

    notification.appendChild(content);

    // Create close button if dismissible
    if (dismissible) {
        const closeBtn = document.createElement('div');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => closeNotification(notification));
        notification.appendChild(closeBtn);
    }

    // Add to container
    container.appendChild(notification);

    // Auto-close after duration if specified
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                closeNotification(notification);
            }
        }, duration);
    }

    // Add to activity log if debug is enabled
    if (window.logDebug && typeof window.logDebug === 'function') {
        window.logDebug(`Notification [${type}]: ${title ? title + ' - ' : ''}${message}`);
    }

    return notification;
}

/**
 * Close a notification with animation
 * @param {HTMLElement} notification - The notification element to close
 */
function closeNotification(notification) {
    notification.classList.add('closing');

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 400); // Match the animation duration
}

/**
 * Show a success notification
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the notification
 * @param {number} duration - Duration in milliseconds before auto-close
 */
function showSuccess(message, title = 'Success', duration = 5000) {
    return showNotification(message, 'success', title, duration);
}

/**
 * Show an error notification
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the notification
 * @param {number} duration - Duration in milliseconds before auto-close
 */
function showError(message, title = 'Error', duration = 8000) {
    return showNotification(message, 'error', title, duration);
}

/**
 * Show an info notification
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the notification
 * @param {number} duration - Duration in milliseconds before auto-close
 */
function showInfo(message, title = 'Information', duration = 5000) {
    return showNotification(message, 'info', title, duration);
}

/**
 * Show a warning notification
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the notification
 * @param {number} duration - Duration in milliseconds before auto-close
 */
function showWarning(message, title = 'Warning', duration = 6000) {
    return showNotification(message, 'warning', title, duration);
}

/**
 * Clear all notifications
 */
function clearAllNotifications() {
    const container = document.getElementById('notification-container');
    if (container) {
        const notifications = container.querySelectorAll('.notification');
        notifications.forEach(notification => {
            closeNotification(notification);
        });
    }
}

// Export functions
window.EraNotification = {
    show: showNotification,
    success: showSuccess,
    error: showError,
    info: showInfo,
    warning: showWarning,
    clear: clearAllNotifications,
    close: closeNotification
};
