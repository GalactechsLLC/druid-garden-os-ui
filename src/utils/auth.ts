import { useUserStore } from '@/stores/userStore';
import type { User } from '@/types/user';

/**
 * Get authentication token
 */
export function getAuthToken(): string | null {
    return localStorage.getItem('token');
}

/**
 * Set authentication token
 */
export function setAuthToken(token: string | null): void {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    if (!token) return {};
    return {
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Check authentication status - just checks if token exists
 */
export function checkAuth(): boolean {
    return !!getAuthToken();
}

/**
 * Initialize authentication for the application
 */
export function initializeAuth(): boolean {
    const userStore = useUserStore();

    // Check if token exists
    const token = getAuthToken();
    const username = localStorage.getItem('username');

    if (token && username) {
        console.log('Found existing auth token and username');

        // Create the user object directly without decoding the token
        const user: User = {
            sub: username,
            eml: username,
            rol: username.toLowerCase() === 'admin' ? 'Admin' : 'User'
        };

        // Use the setter methods instead of $patch
        userStore.isLoggedIn = true;
        userStore.user = user;

        console.log('Successfully restored user session');
        return true;
    } else {
        console.log('No valid auth token found, user will need to log in');
        return false;
    }
}

/**
 * Setup authentication monitoring - just checks if token exists
 */
export function setupAuthMonitoring(): () => void {
    const userStore = useUserStore();

    // Set up periodic auth check
    const intervalId = setInterval(() => {
        if (userStore.isAuthenticated && !getAuthToken()) {
            console.warn('Token missing during monitoring check');
            userStore.logout();
        }
    }, 60000); // Check every minute

    // Return cleanup function
    return () => {
        clearInterval(intervalId);
    };
}