document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const avatarElement = document.getElementById('avatar');
    const headerAvatarElement = document.getElementById('header-avatar');
    const usernameElement = document.getElementById('username');
    const userEmailElement = document.getElementById('user-email');
    const userFullnameElement = document.getElementById('user-fullname');
    const userBioElement = document.getElementById('user-bio');
    const avatarUpload = document.getElementById('avatarUpload');
    const saveAvatarBtn = document.getElementById('saveAvatar');
    const logoutBtn = document.getElementById('logout');
    const changePasswordBtn = document.getElementById('change-password');
    const editProfileBtn = document.getElementById('edit-profile');

    // Session management elements
    const sessionsListEl = document.getElementById('sessions-list');
    const endAllSessionsBtn = document.getElementById('end-all-sessions');
    const sessionModal = document.getElementById('session-modal');
    const sessionDeviceEl = document.getElementById('session-device');
    const sessionLocationEl = document.getElementById('session-location');
    const sessionLastActiveEl = document.getElementById('session-last-active');
    const confirmEndSessionBtn = document.getElementById('confirm-end-session');
    const cancelEndSessionBtn = document.getElementById('cancel-end-session');

    // Modal elements
    const profileEditModal = document.getElementById('profile-edit-modal');
    const passwordChangeModal = document.getElementById('password-change-modal');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    const editFullnameInput = document.getElementById('edit-fullname');
    const editBioInput = document.getElementById('edit-bio');
    const editLocationInput = document.getElementById('edit-location');
    const addInterestInput = document.getElementById('add-interest');
    const interestTagsContainer = document.getElementById('interest-tags');
    const languagePreferenceSelect = document.getElementById('language-preference');
    const shareLocationCheckbox = document.getElementById('share-location');
    const showOnlineStatusCheckbox = document.getElementById('show-online-status');
    const publicProfileCheckbox = document.getElementById('public-profile');
    const themeOptions = document.querySelectorAll('input[name="theme"]');
    const profileEditForm = document.getElementById('profile-edit-form');
    const passwordChangeForm = document.getElementById('password-change-form');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const cancelPasswordBtn = document.getElementById('cancel-password');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStrengthBar = document.getElementById('password-strength-bar');

    // Set the API base URL to handle both localhost and production environments
    const API_BASE_URL = window.location.origin;
    // Set the socket URL (in case of different socket server)
    const SOCKET_URL = window.location.origin;

    // User data storage
    let userData = null;
    let userInterests = [];
    let token = localStorage.getItem('token');
    let tokenExpires = localStorage.getItem('tokenExpires');
    let rememberMe = localStorage.getItem('rememberMe') === 'true';

    // Function to show a notification using our notification system
    function showNotification(message, isError = false) {
        if (window.EraNotification) {
            if (isError) {
                window.EraNotification.error(message);
            } else {
                window.EraNotification.success(message);
            }
        } else {
            // Fallback to alert if notification system isn't loaded
            alert(message);
        }
    }

    // Check if token is expired
    function isTokenExpired() {
        if (!tokenExpires) return true;

        try {
            const expiryDate = new Date(tokenExpires);
            const now = new Date();
            return now >= expiryDate;
        } catch (e) {
            console.error('Error parsing token expiration:', e);
            return true; // Assume expired if we can't parse it
        }
    }

    // Check if user is authenticated
    console.log('Token from localStorage:', token ? 'Present (length: ' + token.length + ')' : 'Not found');
    console.log('Token expires:', tokenExpires || 'Not set');
    console.log('Remember me:', rememberMe ? 'Yes' : 'No');

    // Check token expiration
    if (token && isTokenExpired()) {
        console.log('Token is expired, will attempt to refresh');
        // Не видаляємо токен відразу, спробуємо оновити його
        // token = null; // Consider token invalid if expired
    }

    // Get user data from localStorage - a fallback if token validation fails
    userData = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    console.log('User data from localStorage:', userData);

    // Check for redirect loop prevention
    const preventRedirect = sessionStorage.getItem('preventRedirect') === 'true';
    const now = new Date().getTime();
    const lastRedirectTime = parseInt(sessionStorage.getItem('profileRedirectTime') || '0');
    const redirectCount = parseInt(sessionStorage.getItem('profileRedirectCount') || '0');

    // If we're being redirected to auth too quickly and too often
    if (now - lastRedirectTime < 3000 && redirectCount > 0) {
        sessionStorage.setItem('profileRedirectCount', (redirectCount + 1).toString());
        console.warn(`Potential redirect loop detected (${redirectCount + 1} redirects in < 3s)`);

        if (redirectCount >= 2) {
            // Prevent further redirects
            sessionStorage.setItem('preventRedirect', 'true');
            console.error('Detected auth redirect loop - preventing further redirects');

            // Show a clear error message to the user
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
                <strong>Authentication Error:</strong> A login loop was detected.<br>
                Using fallback display mode with limited functionality.<br>
                <button id="clear-redirect-protection" style="margin-top:10px;padding:5px 10px;background:#cc0000;color:white;border:none;border-radius:3px;cursor:pointer;">
                    Reset Protection & Try Again
                </button>
            `;
            document.body.appendChild(errorDiv);

            // Add button listener to clear protection
            document.getElementById('clear-redirect-protection').addEventListener('click', function() {
                sessionStorage.removeItem('preventRedirect');
                sessionStorage.removeItem('profileRedirectCount');
                sessionStorage.removeItem('profileRedirectTime');
                sessionStorage.removeItem('lastRedirectTime');
                sessionStorage.removeItem('redirectCount');
                errorDiv.style.display = 'none';
                location.reload();
            });
        }
    } else {
        // Reset counter if it's been more than 3 seconds
        sessionStorage.setItem('profileRedirectCount', '1');
    }
    sessionStorage.setItem('profileRedirectTime', now.toString());

    // Immediately display user data from localStorage while validating token
    if (userData) {
        displayUserData(userData);
    }

    // Модифікуємо логіку перенаправлення на авторизацію
    // Перенаправляємо тільки якщо немає ні токена, ні даних користувача, і лише якщо не активований захист від циклу перенаправлень
    if (!token && !userData && !preventRedirect) {
        console.log('No authentication token or user data found, redirecting to login');
        // Додаємо затримку перед перенаправленням, щоб запобігти циклу
        setTimeout(() => {
            window.location.href = '/auth.html';
        }, 1000);
        return; // Зупиняємо виконання скрипта після перенаправлення
    } else if (!token && !userData && preventRedirect) {
        console.log('No authentication token found, but redirect prevention is active');
        if (window.EraNotification) {
            window.EraNotification.error('Authentication error: Unable to connect to your account.', 'Authentication Failed');
        }
    }

    // Auto login if we have user data but no token (or expired token)
    if (!token && userData) {
        console.log('No token but user data exists, trying to login automatically with:', userData.username);
        // Show notification
        if (window.EraNotification) {
            window.EraNotification.info('Attempting to reconnect your session...', 'Session Expired');
        }

        // Use the user data to log in again silently
        try {
            // For the demo, we'll use one of the test users
            const username = userData.username || 'user';
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: 'password123', // Using default password for demo
                    rememberMe // Keep the same remember me preference
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                token = data.token;
                localStorage.setItem('token', token);
                console.log('Auto-login successful, new token acquired');

                // Store token expiration
                if (data.expiresIn) {
                    const expirationTime = new Date();
                    if (data.expiresIn === '30d') {
                        expirationTime.setDate(expirationTime.getDate() + 30);
                    } else {
                        expirationTime.setHours(expirationTime.getHours() + 24);
                    }
                    localStorage.setItem("tokenExpires", expirationTime.toISOString());
                    tokenExpires = expirationTime.toISOString();
                    console.log('Token expiration updated:', tokenExpires);
                }

                // Show success notification
                if (window.EraNotification) {
                    window.EraNotification.success('Session reconnected successfully', 'Welcome Back');
                }

                // Update user data if needed
                if (data.user) {
                    userData = data.user;
                    localStorage.setItem('user', JSON.stringify(userData));
                }
            } else {
                console.log('Auto-login failed, but we still have user data to display');
                // Show warning notification
                if (window.EraNotification) {
                    window.EraNotification.warning('Session expired, some features may be limited. Please log in again for full access.', 'Limited Access Mode');
                }
                // Continue with cached user data instead of immediate redirect
            }
        } catch (error) {
            console.error('Error during auto-login:', error);
            // Show error notification
            if (window.EraNotification) {
                window.EraNotification.error('Could not reconnect your session. Using cached data instead.', 'Connection Error');
            }
            // Continue with cached user data instead of immediate redirect
        }
    }

    // Log all localStorage items for debugging
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`localStorage[${key}]: ${key === 'token' ? '***' : localStorage.getItem(key)}`);
    }

    // Validate token before proceeding
    if (token) {
        try {
            console.log('Validating token...');
            const validationResponse = await fetch(`${API_BASE_URL}/auth/validate-token`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!validationResponse.ok) {
                console.error('Token validation failed with status:', validationResponse.status);

                // Don't redirect immediately, just try to refresh the token if needed
                if (userData) {
                    console.log('Using cached user data for display while trying to refresh token');

                    // Show warning notification
                    if (window.EraNotification) {
                        window.EraNotification.warning('Your session needs to be refreshed. Some features may be limited.', 'Authentication Issue');
                    }

                    // Try to get a new token in the background but don't redirect if it fails
                    refreshToken(userData);
                }
            } else {
                console.log('Token validated successfully');
                const validationData = await validationResponse.json();
                console.log('Validation data:', validationData);

                // Update user data with the validated data
                if (validationData.user) {
                    userData = validationData.user;
                    localStorage.setItem('user', JSON.stringify(userData));
                }

                // Show success notification
                if (window.EraNotification) {
                    window.EraNotification.success(`Welcome back, ${validationData.user.username}!`, 'Authentication Successful');
                }

                // Proceed with loading profile data
                await loadProfileData(token);
            }
        } catch (error) {
            console.error('Error validating token:', error);

            // If validation fails but we have user data, use it
            if (userData) {
                displayUserData(userData);

                // Show warning notification
                if (window.EraNotification) {
                    window.EraNotification.warning('Using cached profile data due to connection issues.', 'Offline Mode');
                }
            }
        }
    }

    // Function to display user data without API call
    function displayUserData(user) {
        usernameElement.textContent = user.username || 'User';
        userEmailElement.textContent = user.email || 'email@example.com';

        // Set fullname and bio if available
        userFullnameElement.textContent = user.fullName || '';
        userBioElement.textContent = user.bio || '';

        // Set avatar if available
        if (user.avatar) {
            const avatarUrl = user.avatar.startsWith('http')
                ? user.avatar
                : `${API_BASE_URL}/${user.avatar}`;

            avatarElement.src = avatarUrl;
            if (headerAvatarElement) {
                headerAvatarElement.src = avatarUrl;
            }
        }

        // Store interests if available
        if (user.interests && Array.isArray(user.interests)) {
            userInterests = [...user.interests];
        }

        // Set theme preference if available
        if (user.themePreference) {
            applyThemePreference(user.themePreference);
        }

        // Set language preference if available
        if (user.languagePreference && languagePreferenceSelect) {
            languagePreferenceSelect.value = user.languagePreference;
        }
    }

    // Try to refresh the token
    async function refreshToken(user) {
        console.log('Attempting to refresh token for user:', user.username);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: user.username,
                    password: 'password123' // Using default password for demo
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                token = data.token;
                localStorage.setItem('token', token);
                console.log('Token refresh successful');

                // Show success notification
                if (window.EraNotification) {
                    window.EraNotification.success('Your session has been refreshed successfully.', 'Session Refreshed');
                }

                return true;
            }
            console.log('Token refresh failed, but continuing with cached user data');

            // Show warning notification
            if (window.EraNotification) {
                window.EraNotification.warning('Could not refresh your session. Limited functionality available.', 'Limited Access');
            }

            return false;
        } catch (error) {
            console.error('Token refresh error:', error);

            // Show error notification
            if (window.EraNotification) {
                window.EraNotification.error('Failed to refresh your session due to a connection error.', 'Connection Error');
            }

            return false;
        }
    }

    // Function to load profile data
    async function loadProfileData(token) {
        try {
            console.log('Fetching profile data...');
            const response = await fetch(`${API_BASE_URL}/profile/profile`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            // Check response status
            if (!response.ok) {
                console.error('Profile data fetch failed with status:', response.status);

                if (response.status === 401) {
                    console.log('Authentication failed with 401 status, but keeping current view');
                    // Don't redirect, just keep using the cached user data

                    // Show warning notification
                    if (window.EraNotification) {
                        window.EraNotification.warning('Session expired. Using cached profile data.', 'Authentication Required');
                    }

                    return;
                }

                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const profileData = await response.json();
            console.log('Profile data received:', profileData);

            // Update local user data
            userData = profileData;
            localStorage.setItem('user', JSON.stringify(userData));

            // Update UI with profile data
            displayUserData(profileData);

            // Show success notification
            if (window.EraNotification) {
                window.EraNotification.info('Profile data loaded successfully.', 'Profile Updated');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            showNotification(`Failed to load profile: ${error.message}`, true);
        }
    }

    // Apply theme preference
    function applyThemePreference(preference) {
        // Get the correct radio button
        const radioButton = document.querySelector(`input[name="theme"][value="${preference}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }

        // Apply theme to document
        if (preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Theme preference change handler
    themeOptions.forEach(option => {
        option.addEventListener('change', function() {
            if (this.checked) {
                applyThemePreference(this.value);

                // Save preference to user data
                if (userData) {
                    userData.themePreference = this.value;
                    localStorage.setItem('user', JSON.stringify(userData));

                    // Send to server
                    updateUserProfile({ themePreference: this.value });
                }
            }
        });
    });

    // Handle interest tags
    function renderInterestTags() {
        // Clear container
        interestTagsContainer.innerHTML = '';

        // Add each interest as a tag
        userInterests.forEach(interest => {
            const tag = document.createElement('div');
            tag.className = 'interest-tag';
            tag.innerHTML = `${interest} <span class="remove-tag" data-interest="${interest}">&times;</span>`;
            interestTagsContainer.appendChild(tag);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-tag').forEach(button => {
            button.addEventListener('click', function() {
                const interest = this.getAttribute('data-interest');
                removeInterest(interest);
            });
        });
    }

    function addInterest(interest) {
        if (!interest || userInterests.includes(interest)) return;

        userInterests.push(interest);
        renderInterestTags();

        // Update user data
        if (userData) {
            userData.interests = [...userInterests];
            localStorage.setItem('user', JSON.stringify(userData));
        }
    }

    function removeInterest(interest) {
        userInterests = userInterests.filter(item => item !== interest);
        renderInterestTags();

        // Update user data
        if (userData) {
            userData.interests = [...userInterests];
            localStorage.setItem('user', JSON.stringify(userData));
        }
    }

    // Add interest input handler
    if (addInterestInput) {
        addInterestInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();

                const interest = this.value.trim();
                if (interest) {
                    addInterest(interest);
                    this.value = '';
                }
            }
        });
    }

    // Password strength checker
    function checkPasswordStrength(password) {
        // Remove any existing classes
        if (!passwordStrengthBar) return 0;

        if (!password) {
            passwordStrengthBar.style.width = '0';
            passwordStrengthBar.style.backgroundColor = '#ff4d4d';
            return 0;
        }

        // Basic strength criteria
        const hasLowercase = /[a-z]/.test(password);
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasLength = password.length >= 8;

        // Calculate strength
        let strength = 0;
        if (hasLowercase) strength += 1;
        if (hasUppercase) strength += 1;
        if (hasNumbers) strength += 1;
        if (hasSpecial) strength += 1;
        if (hasLength) strength += 1;

        // Update visual indicator
        const percentage = (strength / 5) * 100;
        passwordStrengthBar.style.width = `${percentage}%`;

        // Update color based on strength
        if (strength <= 1) {
            passwordStrengthBar.style.backgroundColor = '#ff4d4d'; // Red
        } else if (strength <= 2) {
            passwordStrengthBar.style.backgroundColor = '#ffa64d'; // Orange
        } else if (strength <= 3) {
            passwordStrengthBar.style.backgroundColor = '#ffee4d'; // Yellow
        } else if (strength <= 4) {
            passwordStrengthBar.style.backgroundColor = '#71da71'; // Light green
        } else {
            passwordStrengthBar.style.backgroundColor = '#4dff4d'; // Green
        }

        return strength;
    }

    // New password input handler
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }

    // Modal handlers
    function openModal(modal) {
        if (!modal) return;
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.style.display = 'none';
    }

    // Close modal when clicking the X
    closeModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });

    // Cancel buttons
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            closeModal(profileEditModal);
        });
    }

    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', function() {
            closeModal(passwordChangeModal);
        });
    }

    // Edit profile button handler
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function() {
            // Populate form with current user data
            if (userData) {
                editFullnameInput.value = userData.fullName || '';
                editBioInput.value = userData.bio || '';
                editLocationInput.value = userData.location || '';

                // Set interests
                userInterests = userData.interests || [];
                renderInterestTags();

                // Set theme preference
                const themeValue = userData.themePreference || 'light';
                const themeRadio = document.querySelector(`input[name="theme"][value="${themeValue}"]`);
                if (themeRadio) themeRadio.checked = true;

                // Set language preference
                if (languagePreferenceSelect) {
                    languagePreferenceSelect.value = userData.languagePreference || 'en';
                }

                // Set privacy settings
                if (shareLocationCheckbox) {
                    shareLocationCheckbox.checked = userData.shareLocation || false;
                }

                if (showOnlineStatusCheckbox) {
                    showOnlineStatusCheckbox.checked = userData.showOnlineStatus !== false; // Default to true
                }

                if (publicProfileCheckbox) {
                    publicProfileCheckbox.checked = userData.publicProfile || false;
                }
            }

            openModal(profileEditModal);
        });
    }

    // Change password button handler
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            // Reset form
            if (passwordChangeForm) {
                passwordChangeForm.reset();
            }

            // Reset password strength indicator
            if (passwordStrengthBar) {
                passwordStrengthBar.style.width = '0';
            }

            openModal(passwordChangeModal);
        });
    }

    // Update user profile
    async function updateUserProfile(profileData) {
        if (!token) {
            showNotification('You need to be logged in to update your profile', true);
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/profile/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }

            const data = await response.json();

            // Update local user data
            userData = {...userData, ...data.user};
            localStorage.setItem('user', JSON.stringify(userData));

            // Update UI
            displayUserData(userData);

            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification(`Failed to update profile: ${error.message}`, true);
            return false;
        }
    }

    // Change password
    async function changePassword(currentPassword, newPassword) {
        if (!token) {
            showNotification('You need to be logged in to change your password', true);
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/profile/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to change password');
            }

            return true;
        } catch (error) {
            console.error('Error changing password:', error);
            showNotification(`Failed to change password: ${error.message}`, true);
            return false;
        }
    }

    // Profile edit form submission
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            // Show loading notification
            let loadingNotification = null;
            if (window.EraNotification) {
                loadingNotification = window.EraNotification.info('Saving your profile changes...', 'Updating Profile', 0, false);
            }

            // Collect form data
            const profileData = {
                fullName: editFullnameInput.value.trim(),
                bio: editBioInput.value.trim(),
                location: editLocationInput.value.trim(),
                interests: [...userInterests],
                themePreference: document.querySelector('input[name="theme"]:checked').value,
                languagePreference: languagePreferenceSelect.value,
                shareLocation: shareLocationCheckbox.checked,
                showOnlineStatus: showOnlineStatusCheckbox.checked,
                publicProfile: publicProfileCheckbox.checked
            };

            const success = await updateUserProfile(profileData);

            // Close loading notification
            if (loadingNotification && window.EraNotification) {
                window.EraNotification.close(loadingNotification);
            }

            if (success) {
                // Show success notification
                showNotification('Profile updated successfully');

                // Close modal
                closeModal(profileEditModal);
            }
        });
    }

    // Password change form submission
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validate passwords
            if (!currentPassword) {
                showNotification('Please enter your current password', true);
                return;
            }

            if (!newPassword) {
                showNotification('Please enter a new password', true);
                return;
            }

            const strength = checkPasswordStrength(newPassword);
            if (strength < 3) {
                showNotification('Your new password is too weak. Please use a stronger password with uppercase, lowercase, numbers, and special characters.', true);
                return;
            }

            if (newPassword !== confirmPassword) {
                showNotification('New passwords do not match', true);
                return;
            }

            // Show loading notification
            let loadingNotification = null;
            if (window.EraNotification) {
                loadingNotification = window.EraNotification.info('Changing your password...', 'Updating Password', 0, false);
            }

            const success = await changePassword(currentPassword, newPassword);

            // Close loading notification
            if (loadingNotification && window.EraNotification) {
                window.EraNotification.close(loadingNotification);
            }

            if (success) {
                // Show success notification
                showNotification('Password changed successfully');

                // Close modal
                closeModal(passwordChangeModal);

                // Reset form
                passwordChangeForm.reset();
            }
        });
    }

    // Handle avatar upload
    if (saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', async () => {
            if (!avatarUpload.files.length) {
                showNotification('Please select an image to upload', true);
                return;
            }

            const file = avatarUpload.files[0];

            // Check file size
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                showNotification('Image file is too large. Maximum size is 5MB', true);
                return;
            }

            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                showNotification('Please select a valid image file (JPEG, PNG, GIF, WEBP)', true);
                return;
            }

            // Show loading notification
            let loadingNotification;
            if (window.EraNotification) {
                loadingNotification = window.EraNotification.info('Uploading your avatar...', 'Uploading', 0, false);
            }

            const formData = new FormData();
            formData.append('avatar', file);

            try {
                const response = await fetch(`${API_BASE_URL}/profile/update-avatar`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                // Close loading notification
                if (loadingNotification) {
                    window.EraNotification.close(loadingNotification);
                }

                if (!response.ok) {
                    throw new Error(`Failed to upload avatar: ${response.status}`);
                }

                const data = await response.json();
                showNotification('Avatar updated successfully');

                // Update avatar display
                if (data.avatarUrl) {
                    const avatarUrl = data.avatarUrl.startsWith('http')
                        ? data.avatarUrl
                        : `${API_BASE_URL}/${data.avatarUrl}`;
                    avatarElement.src = avatarUrl;
                    headerAvatarElement.src = avatarUrl;

                    // Update in localStorage too
                    if (userData) {
                        userData.avatar = data.avatarUrl;
                        localStorage.setItem('user', JSON.stringify(userData));
                    }
                }
            } catch (error) {
                console.error('Error uploading avatar:', error);
                showNotification(`Failed to upload avatar: ${error.message}`, true);
            }
        });
    }

    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Show confirmation
            if (window.EraNotification) {
                window.EraNotification.info('Logging you out...', 'Goodbye');
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                // Clear auth data and redirect
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // Short delay before redirect for notification to be seen
                setTimeout(() => {
                    window.location.href = '/auth.html';
                }, 1000);
            } catch (error) {
                console.error('Error during logout:', error);
                // Even if logout fails on server, clear local data
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                setTimeout(() => {
                    window.location.href = '/auth.html';
                }, 1000);
            }
        });
    }

    // Function to load active sessions
    async function loadActiveSessions() {
        try {
            if (!token) {
                console.log('Cannot load sessions: No token available');
                sessionsListEl.innerHTML = `
                    <div style="text-align: center; color: #ccc;">
                        <p>Please log in again to view your sessions</p>
                    </div>
                `;
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load sessions: ${response.status}`);
            }

            const data = await response.json();
            renderSessionsList(data.sessions);
        } catch (error) {
            console.error('Error loading sessions:', error);
            sessionsListEl.innerHTML = `
                <div style="text-align: center; color: #ccc;">
                    <p>Error loading sessions: ${error.message}</p>
                </div>
            `;
        }
    }

    // Function to render the sessions list
    function renderSessionsList(sessions) {
        if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
            sessionsListEl.innerHTML = `
                <div style="text-align: center; color: #ccc;">
                    <p>No active sessions found</p>
                </div>
            `;
            return;
        }

        // Sort sessions: current first, then by lastActive date (most recent first)
        sessions.sort((a, b) => {
            if (a.isCurrent) return -1;
            if (b.isCurrent) return 1;
            return new Date(b.lastActive) - new Date(a.lastActive);
        });

        let html = '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse; color: #ccc;">';
        html += `
            <thead>
                <tr style="border-bottom: 1px solid #333;">
                    <th style="padding: 10px; text-align: left;">Device</th>
                    <th style="padding: 10px; text-align: left;">Location</th>
                    <th style="padding: 10px; text-align: left;">Last Active</th>
                    <th style="padding: 10px; text-align: center;">Actions</th>
                </tr>
            </thead>
            <tbody>
        `;

        sessions.forEach(session => {
            const lastActive = new Date(session.lastActive).toLocaleString();
            const isCurrent = session.isCurrent;

            html += `
                <tr style="${isCurrent ? 'background-color: rgba(11, 147, 246, 0.2);' : ''} border-bottom: 1px solid #333;">
                    <td style="padding: 10px;">
                        ${escapeHtml(session.deviceInfo || 'Unknown Device')}
                        ${isCurrent ? '<span style="color: #0b93f6; margin-left: 5px; font-size: 12px;">(Current)</span>' : ''}
                    </td>
                    <td style="padding: 10px;">${escapeHtml(session.location || 'Unknown Location')}</td>
                    <td style="padding: 10px;">${lastActive}</td>
                    <td style="padding: 10px; text-align: center;">
                        ${isCurrent
                            ? '<span style="color: #888; font-size: 12px;">Current Session</span>'
                            : `<button class="end-session-btn" data-session-id="${session.sessionId}"
                                data-device="${escapeHtml(session.deviceInfo || 'Unknown Device')}"
                                data-location="${escapeHtml(session.location || 'Unknown Location')}"
                                data-last-active="${lastActive}"
                                style="background: none; border: none; color: #e74c3c; cursor: pointer; text-decoration: underline;">
                                End Session
                               </button>`
                        }
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        sessionsListEl.innerHTML = html;

        // Add event listeners to end session buttons
        document.querySelectorAll('.end-session-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-session-id');
                const device = this.getAttribute('data-device');
                const location = this.getAttribute('data-location');
                const lastActive = this.getAttribute('data-last-active');

                // Set modal info
                sessionDeviceEl.textContent = device;
                sessionLocationEl.textContent = location;
                sessionLastActiveEl.textContent = lastActive;

                // Set session ID to confirm button
                confirmEndSessionBtn.setAttribute('data-session-id', sessionId);

                // Show modal
                sessionModal.style.display = 'block';
            });
        });
    }

    // Function to end a specific session
    async function endSession(sessionId) {
        try {
            if (!token) {
                throw new Error('No token available');
            }

            const response = await fetch(`${API_BASE_URL}/auth/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || `Failed to end session: ${response.status}`);
            }

            // Show success notification
            showNotification('Session ended successfully');

            // Reload sessions list
            loadActiveSessions();
        } catch (error) {
            console.error('Error ending session:', error);
            showNotification('Error ending session: ' + error.message, true);
        }
    }

    // Function to end all other sessions
    async function endAllSessions() {
        try {
            if (!token) {
                throw new Error('No token available');
            }

            const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || `Failed to end all sessions: ${response.status}`);
            }

            // Show success notification
            showNotification('All other sessions ended successfully');

            // Reload sessions list
            loadActiveSessions();
        } catch (error) {
            console.error('Error ending all sessions:', error);
            showNotification('Error ending all sessions: ' + error.message, true);
        }
    }

    // Helper function to escape HTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Session management event listeners
    if (endAllSessionsBtn) {
        endAllSessionsBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to end all other sessions? This will log you out from all other devices.')) {
                endAllSessions();
            }
        });
    }

    if (confirmEndSessionBtn) {
        confirmEndSessionBtn.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-session-id');
            if (sessionId) {
                endSession(sessionId);
                sessionModal.style.display = 'none';
            }
        });
    }

    if (cancelEndSessionBtn) {
        cancelEndSessionBtn.addEventListener('click', function() {
            sessionModal.style.display = 'none';
        });
    }

    // Close modal when clicking on the X or outside the modal
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Initialize: Load profile data, biometric devices, and sessions
    async function initialize() {
        await loadProfileData(token);
        loadActiveSessions();
    }

    if (token && !isTokenExpired()) {
        initialize();
    }

    // Apply initial theme based on system preference
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDarkMode) {
        document.body.classList.add('dark-mode');
    }
});
