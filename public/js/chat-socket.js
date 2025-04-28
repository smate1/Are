// Socket.io chat manager for Era platform
class EraSocketChat {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.token = localStorage.getItem('token');
    this.userId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).id : null;

    // Callbacks
    this.onMessageReceived = null;
    this.onMessageSent = null;
    this.onMessageRead = null;
    this.onUserTyping = null;
    this.onUserStatus = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onConversationUpdate = null;

    // Typing indicator debounce
    this.typingTimeout = null;
  }

  // Initialize the socket connection
  connect() {
    if (!this.token) {
      console.error('No auth token available');
      return false;
    }

    // Load socket.io from CDN if not available
    if (!window.io) {
      console.error('Socket.io not found. Please include socket.io-client library');
      return false;
    }

    // Create socket connection with auth token
    const socketUrl = window.location.origin;
    console.log('Connecting to socket at:', socketUrl);
    this.socket = io(socketUrl, {
      auth: { token: this.token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Setup event listeners
    this._setupListeners();

    return true;
  }

  // Setup socket event listeners
  _setupListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected = true;

      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;

      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);

      if (this.onError) {
        this.onError({ type: 'connection', message: error.message });
      }
    });

    // Message events
    this.socket.on('private_message', (message) => {
      console.log('Message received:', message);

      if (this.onMessageReceived) {
        this.onMessageReceived(message);
      }
    });

    this.socket.on('message_sent', (message) => {
      console.log('Message sent confirmation:', message);

      if (this.onMessageSent) {
        this.onMessageSent(message);
      }
    });

    this.socket.on('message_read', (data) => {
      console.log('Message read:', data);

      if (this.onMessageRead) {
        this.onMessageRead(data);
      }
    });

    // Typing events
    this.socket.on('user_typing', (data) => {
      console.log('User typing:', data);

      if (this.onUserTyping) {
        this.onUserTyping(data);
      }
    });

    // User status events
    this.socket.on('user_status', (data) => {
      console.log('User status update:', data);

      if (this.onUserStatus) {
        this.onUserStatus(data);
      }
    });

    // Conversation updates
    this.socket.on('conversation_update', (data) => {
      console.log('Conversation update:', data);

      if (this.onConversationUpdate) {
        this.onConversationUpdate(data);
      }
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);

      if (this.onError) {
        this.onError(error);
      }
    });
  }

  // Send a private message
  sendMessage(recipientId, content) {
    if (!this.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('private_message', {
      recipientId: recipientId,
      content: content
    });

    return true;
  }

  // Mark message as read
  markMessageRead(messageId) {
    if (!this.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('mark_read', {
      messageId: messageId
    });

    return true;
  }

  // Send typing indicator
  sendTypingStatus(recipientId, isTyping = true) {
    if (!this.connected) {
      console.error('Socket not connected');
      return false;
    }

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Send typing status
    this.socket.emit('typing', {
      recipientId: recipientId,
      isTyping: isTyping
    });

    // Automatically stop typing after 3 seconds of inactivity
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.sendTypingStatus(recipientId, false);
      }, 3000);
    }

    return true;
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Check if connected
  isConnected() {
    return this.connected;
  }

  // Get online users
  getOnlineUsers() {
    return this.onlineUsers || [];
  }
}

// Export for global use
window.EraSocketChat = EraSocketChat;
