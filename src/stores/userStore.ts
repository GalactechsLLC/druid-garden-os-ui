import { defineStore } from 'pinia';
import { useNotificationStore } from '@/stores/notificationStore';
import {
    type User,
    type PasswordChangeRequest,
    type LoginRequest,
} from '@/types/user';
import {
    get,
    post,
    put
} from '@/utils/api';
import {
    getAuthToken,
    setAuthToken,
} from '@/utils/auth';

/**
 * User authentication and profile management store
 */
export const useUserStore = defineStore('user', {
    state: () => ({
        isLoggedIn: false,
        user: null as User | null,
        loading: false,
        error: null as string | null,
        passwordUpdateRequired: false
    }),

    getters: {
        isAuthenticated: (state) => state.isLoggedIn,
        userRole: (state) => state.user?.rol || 'user',
        username: (state) => state.user?.eml || '',
        userId: (state) => state.user?.sub || '',
        isAdmin: (state) => state.user?.rol === 'Admin'
    },

    actions: {
        /**
         * Authenticate user with username and password
         * Performs login request, retrieves JWT token, and sets up user session
         */
        async login(username: string, password: string): Promise<boolean> {
            const notificationStore = useNotificationStore();
            this.loading = true;
            this.error = null;

            try {
                // Send login credentials
                try {
                    await post('auth/login',
                        { username, password } as LoginRequest,
                        {
                            showSuccessNotification: false,
                            showErrorNotification: false,
                            silent: true
                        }
                    );
                } catch (loginErr) {
                    throw new Error('Authentication failed');
                }

                // Retrieve and store JWT token
                try {
                    const token = await get(`auth/jwt`, {
                        showSuccessNotification: false,
                        showErrorNotification: false,
                        silent: true
                    });

                    if (!token || typeof token !== 'string') {
                        throw new Error('Invalid token received');
                    }

                    setAuthToken(token);
                    localStorage.setItem('username', username);
                } catch (tokenErr) {
                    throw new Error('Authentication succeeded but failed to retrieve user token');
                }

                // Create user object and set login state
                this.user = {
                    sub: username,
                    eml: username,
                    rol: username.toLowerCase() === 'admin' ? 'Admin' : 'User'
                };

                this.isLoggedIn = true;

                // Check if password update is required (non-blocking)
                try {
                    await this.checkPasswordUpdateRequired(username);
                } catch (err) {
                    this.passwordUpdateRequired = false;
                }

                notificationStore.notify('positive', 'Login successful', {});
                return true;
            } catch (err: any) {
                this.error = err.message || 'Authentication failed';
                notificationStore.notify('negative', this.error || '',{});
                return false;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Register a new user account
         */
        async register(username: string, password: string): Promise<boolean> {
            const notificationStore = useNotificationStore();
            this.loading = true;
            this.error = null;

            try {
                await post('api/users/register',
                    { username, password },
                    {
                        showSuccessNotification: false,
                        showErrorNotification: false,
                        silent: true
                    }
                );

                notificationStore.notify('positive', 'Registration successful! You can now log in.',{});
                return true;
            } catch (err: any) {
                this.error = err.message || 'Registration failed';
                notificationStore.notify('negative', this.error || '',{});
                return false;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Update user password with old password verification
         */
        async updatePassword(oldPassword: string, newPassword: string): Promise<boolean> {
            const notificationStore = useNotificationStore();
            this.loading = true;
            this.error = null;

            try {
                await put('api/users/password',
                    {
                        username: this.user?.eml,
                        old_password: oldPassword,
                        new_password: newPassword
                    } as PasswordChangeRequest,
                    {
                        showSuccessNotification: false,
                        showErrorNotification: false,
                        silent: true
                    }
                );

                this.passwordUpdateRequired = false;
                notificationStore.notify('positive', 'Password updated successfully', {});
                return true;
            } catch (err: any) {
                this.error = err.message || 'Password update failed';
                notificationStore.notify('negative', this.error || '', {});
                return false;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Check if user needs to update their password
         * Handles various response formats (boolean, string, number)
         */
        async checkPasswordUpdateRequired(username: string): Promise<boolean> {
            this.error = null;

            try {
                const response = await get(`api/users/password/${username}`, {
                    silent: true,
                    showErrorNotification: false
                });

                if (response && (response === true || response === 'true' || response === 1)) {
                    this.passwordUpdateRequired = true;
                    return true;
                } else {
                    this.passwordUpdateRequired = false;
                    return false;
                }
            } catch (err: any) {
                this.error = err.message || 'Failed to check password status';
                this.passwordUpdateRequired = false;
                return false;
            }
        },

        /**
         * Restore user session from stored token and username
         * Called on app initialization to maintain login state
         */
        refreshUserFromToken(): boolean {
            const token = getAuthToken();
            const username = localStorage.getItem('username');

            if (!token || !username) {
                this.isLoggedIn = false;
                this.user = null;
                this.passwordUpdateRequired = false;
                return false;
            }

            const isAdmin = username === 'Admin';

            this.user = {
                sub: username,
                eml: username,
                rol: isAdmin ? 'Admin' : 'User'
            };

            this.isLoggedIn = true;

            // Check password status asynchronously (non-blocking)
            this.checkPasswordUpdateRequired(username)
                .catch(err => {
                    this.passwordUpdateRequired = false;
                });

            return true;
        },

        /**
         * Clear user session and redirect to login
         */
        logout(): void {
            const notificationStore = useNotificationStore();
            localStorage.removeItem('token');
            localStorage.removeItem('username');

            this.user = null;
            this.isLoggedIn = false;
            this.passwordUpdateRequired = false;
            this.error = null;

            notificationStore.notify('info', 'You have been logged out', {});
        },

        /**
         * Initialize store by attempting to restore user session
         */
        init(): void {
            this.refreshUserFromToken();
        }
    }
});