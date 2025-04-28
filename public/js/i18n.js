/**
 * Simple internationalization utility for Era Platform
 * Supports dynamic loading of language packs and text translation
 */

// Language storage
const i18n = {
    // Current language code
    currentLang: 'en',

    // Available languages
    languages: {
        en: { name: 'English', nativeName: 'English' },
        es: { name: 'Spanish', nativeName: 'Español' },
        fr: { name: 'French', nativeName: 'Français' },
        de: { name: 'German', nativeName: 'Deutsch' },
        uk: { name: 'Ukrainian', nativeName: 'Українська' },
        ja: { name: 'Japanese', nativeName: '日本語' },
        zh: { name: 'Chinese', nativeName: '中文' }
    },

    // Translation data
    translations: {
        // Default English translations
        en: {
            // Common elements
            common: {
                appName: 'Era Platform',
                logout: 'Log out',
                login: 'Log in',
                register: 'Register',
                profile: 'Profile',
                settings: 'Settings',
                save: 'Save',
                cancel: 'Cancel',
                delete: 'Delete',
                edit: 'Edit',
                search: 'Search',
                loading: 'Loading...',
                submit: 'Submit',
                close: 'Close',
                back: 'Back',
                next: 'Next',
                yes: 'Yes',
                no: 'No',
                darkMode: 'Dark Mode',
                lightMode: 'Light Mode',
                error: 'Error',
                success: 'Success'
            },

            // Navigation
            nav: {
                home: 'Home',
                map: 'Map',
                chats: 'Chats',
                admin: 'Admin'
            },

            // Authentication
            auth: {
                loginTitle: 'Log in to your account',
                registerTitle: 'Create an account',
                username: 'Username',
                email: 'Email',
                password: 'Password',
                confirmPassword: 'Confirm Password',
                forgotPassword: 'Forgot password?',
                noAccount: 'Don\'t have an account?',
                haveAccount: 'Already have an account?',
                createAccount: 'Create account',
                loginToAccount: 'Log in to account',
                usernameRequired: 'Username is required',
                emailRequired: 'Email is required',
                passwordRequired: 'Password is required',
                passwordsNotMatch: 'Passwords do not match'
            },

            // Profile
            profile: {
                title: 'Your Profile',
                personalInfo: 'Personal Information',
                fullName: 'Full Name',
                bio: 'Bio',
                location: 'Location',
                website: 'Website',
                interests: 'Interests',
                socialLinks: 'Social Links',
                changeAvatar: 'Change Avatar',
                notifications: 'Notifications',
                language: 'Language',
                accountSettings: 'Account Settings',
                deleteAccount: 'Delete Account',
                changePassword: 'Change Password'
            },

            // Map
            map: {
                findMe: 'Find Me',
                addLocation: 'Add Location',
                findNearby: 'Find Nearby',
                myLocations: 'My Locations',
                publicLocations: 'Public Locations',
                searchLocations: 'Search locations',
                locationName: 'Location Name',
                locationAddress: 'Address',
                locationDescription: 'Description',
                locationTags: 'Tags',
                makePublic: 'Make this location public',
                saveLocation: 'Save Location',
                locationDeleted: 'Location deleted successfully',
                shareLocation: 'Share Location',
                stopSharing: 'Stop Sharing',
                showFriends: 'Show Friends on Map',
                hideFriends: 'Hide Friends'
            },

            // Chats
            chat: {
                newMessage: 'New Message',
                sendMessage: 'Send Message',
                typeMessage: 'Type a message...',
                noMessages: 'No messages yet',
                startConversation: 'Start a conversation',
                selectContact: 'Select a contact',
                typing: 'typing...',
                deleteConversation: 'Delete Conversation',
                blockUser: 'Block User',
                unreadMessages: 'Unread Messages'
            },

            // Admin
            admin: {
                dashboard: 'Admin Dashboard',
                users: 'Users',
                locations: 'Locations',
                analytics: 'Analytics',
                settings: 'Settings',
                addUser: 'Add User',
                exportData: 'Export Data',
                systemInfo: 'System Information',
                appSettings: 'Application Settings',
                createBackup: 'Create Backup',
                checkStatus: 'Check Status',
                totalUsers: 'Total Users',
                totalLocations: 'Total Locations',
                publicLocations: 'Public Locations',
                activeUsers: 'Active Users'
            },

            // Social
            social: {
                friends: 'Friends',
                followers: 'Followers',
                following: 'Following',
                addFriend: 'Add Friend',
                removeFriend: 'Remove Friend',
                pendingRequests: 'Pending Requests',
                acceptRequest: 'Accept',
                declineRequest: 'Decline',
                friendAdded: 'Friend added successfully',
                friendRemoved: 'Friend removed successfully',
                requestSent: 'Friend request sent',
                findFriends: 'Find Friends',
                activityFeed: 'Activity Feed'
            }
        }
    }
};

// Load language from local storage or user settings
function initLanguage() {
    // Check for language preference in localStorage
    const savedLang = localStorage.getItem('language');
    if (savedLang && i18n.languages[savedLang]) {
        i18n.currentLang = savedLang;
    } else {
        // Try to get user language preference from server if logged in
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

        if (token && userData && userData.languagePreference) {
            i18n.currentLang = userData.languagePreference;
        } else {
            // Default to browser language or English
            const browserLang = navigator.language.split('-')[0];
            i18n.currentLang = i18n.languages[browserLang] ? browserLang : 'en';
        }
    }

    // Load language pack if not already loaded
    loadLanguagePack(i18n.currentLang);
}

// Load language pack from server
function loadLanguagePack(langCode) {
    // Skip if already loaded or it's English (which is built-in)
    if (langCode === 'en' || (i18n.translations[langCode] && Object.keys(i18n.translations[langCode]).length > 0)) {
        return Promise.resolve();
    }

    // For demo purposes, we'll create some basic translations for other languages
    // In a real app, you'd load these from server
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simple demo translations for Spanish
            if (langCode === 'es' && !i18n.translations.es) {
                i18n.translations.es = {
                    common: {
                        appName: 'Plataforma Era',
                        logout: 'Cerrar sesión',
                        login: 'Iniciar sesión',
                        register: 'Registrarse',
                        profile: 'Perfil',
                        settings: 'Configuración',
                        save: 'Guardar',
                        cancel: 'Cancelar',
                        delete: 'Eliminar',
                        edit: 'Editar',
                        search: 'Buscar',
                        loading: 'Cargando...',
                        submit: 'Enviar',
                        close: 'Cerrar',
                        back: 'Atrás',
                        next: 'Siguiente',
                        yes: 'Sí',
                        no: 'No',
                        darkMode: 'Modo oscuro',
                        lightMode: 'Modo claro',
                        error: 'Error',
                        success: 'Éxito'
                    },
                    nav: {
                        home: 'Inicio',
                        map: 'Mapa',
                        chats: 'Chats',
                        admin: 'Admin'
                    }
                    // Add more Spanish translations as needed
                };
            }

            // For other languages, you would add their translations here
            // or load them from server

            resolve();
        }, 100);
    });
}

// Change the current language
function changeLanguage(langCode) {
    if (!i18n.languages[langCode]) {
        console.error(`Language ${langCode} is not supported`);
        return Promise.reject(`Language ${langCode} is not supported`);
    }

    return loadLanguagePack(langCode)
        .then(() => {
            i18n.currentLang = langCode;
            localStorage.setItem('language', langCode);

            // If user is logged in, save preference to server
            const token = localStorage.getItem('token');
            if (token) {
                return fetch('/profile/language', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ language: langCode })
                })
                .then(response => {
                    if (!response.ok) {
                        console.warn('Failed to save language preference to server');
                    }
                    return langCode;
                })
                .catch(error => {
                    console.warn('Error saving language preference:', error);
                    return langCode;
                });
            }

            return langCode;
        });
}

// Get text translation
function getText(key, defaultText) {
    // Split key by dots to navigate nested objects
    const keys = key.split('.');
    const lang = i18n.currentLang;

    // Start with the current language's translations
    let result = i18n.translations[lang];

    // Navigate through the nested keys
    for (const k of keys) {
        if (result && result[k] !== undefined) {
            result = result[k];
        } else {
            // If key not found in current language, try English
            if (lang !== 'en') {
                result = i18n.translations.en;
                for (const k of keys) {
                    if (result && result[k] !== undefined) {
                        result = result[k];
                    } else {
                        // If not found in English either, return default or key
                        return defaultText || key;
                    }
                }
            } else {
                // Not found in English, return default or key
                return defaultText || key;
            }
        }
    }

    return result;
}

// Translate all elements with data-i18n attribute
function translatePage() {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = getText(key, el.textContent);

        if (translation) {
            el.textContent = translation;
        }
    });

    // Also translate placeholders
    const inputs = document.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(input => {
        const key = input.getAttribute('data-i18n-placeholder');
        const translation = getText(key, input.placeholder);

        if (translation) {
            input.placeholder = translation;
        }
    });
}

// Export the i18n API
window.i18n = {
    init: initLanguage,
    getLanguages: () => i18n.languages,
    getCurrentLanguage: () => i18n.currentLang,
    changeLanguage,
    getText,
    translatePage
};

// Initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
    initLanguage();
    translatePage();
});
