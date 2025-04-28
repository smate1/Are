// Main JavaScript for Era project
// This file is used on multiple pages for shared functionality

document.addEventListener('DOMContentLoaded', function() {
  console.log('Era application loaded successfully');

  // Check if user is logged in (for pages that need authentication)
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user) {
    console.log('User is logged in:', user.username);
  }

  // Common form handlers and UI interactions can be added here
});
