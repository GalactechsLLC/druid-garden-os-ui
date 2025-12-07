import { useUserStore } from '@/stores/userStore';
import type { User } from '@/types/user';

/**
 * Get authentication token from localStorage
 * @returns The stored authentication token or null if not found
 */
export function getAuthToken(): string | null {
    return localStorage.getItem('token');
}

/**
 * Set or remove authentication token in localStorage
 * @param token - The authentication token to store, or null to remove it
 */
export function setAuthToken(token: string | null): void {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

/**
 * Check if user is authenticated by verifying token existence
 * @returns True if authentication token exists, false otherwise
 */
export function checkAuth(): boolean {
    return !!getAuthToken();
}

/**
 * Initialize authentication for the application by restoring user session
 * @returns True if session was successfully restored, false if user needs to log in
 */
export function initializeAuth(): boolean {
    const userStore = useUserStore();

    const token = getAuthToken();
    const username = localStorage.getItem('username');

    if (token && username) {
        const user: User = {
            sub: username,
            eml: username,
            rol: username.toLowerCase() === 'admin' ? 'Admin' : 'User'
        };

        userStore.isLoggedIn = true;
        userStore.user = user;

        return true;
    } else {
        return false;
    }
}

/**
 * Setup periodic authentication monitoring to detect token removal
 * @returns Cleanup function to stop the monitoring interval
 */
export function setupAuthMonitoring(): () => void {
    const userStore = useUserStore();

    const intervalId = setInterval(() => {
        if (userStore.isAuthenticated && !getAuthToken()) {
            userStore.logout();
        }
    }, 60000);

    return () => {
        clearInterval(intervalId);
    };
}