import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';

// --- Mocking Dependencies ---
// The following mocks are defined outside the test suite to be available globally.
// We'll create fresh reactive instances of these in the beforeEach hook.

// Mock the userStore module and its useUserStore function.
let mockUserStore;
vi.mock('@/stores/userStore', () => ({
    useUserStore: () => mockUserStore,
}));

// Mock the notificationStore.
let mockNotificationStore;
vi.mock('@/stores/notificationStore', () => ({
    useNotificationStore: () => mockNotificationStore,
}));

// Mock the vue-router.
let mockRouter;
vi.mock('vue-router', () => ({
    useRouter: () => mockRouter,
}));

// Mock the child components with simple stubs.
vi.mock('@/components/user/UserProfileCard.vue', () => ({
    default: {
        name: 'UserProfileCard',
        template: `
            <div class="user-profile-card" data-test="user-profile-card">
                <button @click="$emit('change-password')" data-test="change-password-btn">Change Password</button>
                <button @click="$emit('edit-profile')" data-test="edit-profile-btn">Edit Profile</button>
            </div>
        `,
        emits: ['change-password', 'edit-profile'],
    },
}));

vi.mock('@/components/user/PasswordChangeDialog.vue', () => ({
    default: {
        name: 'PasswordChangeDialog',
        template: `
          <div
              class="password-change-dialog"
              data-test="password-change-dialog"
              :class="{ 'dialog-visible': modelValue }"
          >
            Password Change Dialog - Forced: {{ forced }}
          </div>
        `,
        props: {
            modelValue: { type: Boolean, default: false },
            forced: { type: Boolean, default: false },
        },
        emits: ['update:modelValue'],
    },
}));

// Import the component after mocks are set up.
import UserPage from '@/pages/UserPage.vue';

// --- Test Utilities ---

/**
 * Creates and mounts the UserPage component with necessary global stubs.
 */
function createWrapper() {
    const defaultOptions = {
        global: {
            stubs: {
                'q-page': {
                    template: '<div class="q-page" data-test="q-page"><slot></slot></div>',
                    props: ['padding'],
                },
                'q-banner': {
                    template: `
                      <div class="q-banner" data-test="q-banner" :class="[bg, text]">
                        <slot name="avatar"></slot>
                        <slot></slot>
                        <slot name="action"></slot>
                      </div>
                    `,
                    props: ['class', 'color', 'bg'],
                },
                'q-icon': {
                    template: '<i data-test="q-icon" :class="name"></i>',
                    props: ['name'],
                },
                'q-btn': {
                    template: `
                      <button
                          data-test="q-btn"
                          :class="[flat ? 'flat' : '', color]"
                          @click="$emit('click')"
                      >
                        {{ label }}
                      </button>
                    `,
                    props: ['flat', 'label', 'color'],
                    emits: ['click'],
                },
            },
        },
    };
    return mount(UserPage, defaultOptions);
}

/**
 * Creates a clean, reactive mock store instance.
 * @returns {object} A reactive mock user store.
 */
function createMockUserStore() {
    return reactive({
        username: 'testuser',
        passwordUpdateRequired: false,
        refreshUserFromToken: vi.fn().mockResolvedValue(true),
        checkPasswordUpdateRequired: vi.fn().mockResolvedValue(false),
    });
}

/**
 * Creates a clean, reactive mock notification store.
 * @returns {object} A reactive mock notification store.
 */
function createMockNotificationStore() {
    return reactive({
        info: vi.fn(),
    });
}

/**
 * Creates a mock router instance.
 * @returns {object} A mock router.
 */
function createMockRouter() {
    return {
        push: vi.fn(),
    };
}

// --- Main Test Suite ---
describe('UserPage', () => {
    beforeEach(() => {
        // Reset and create new mock stores for each test to prevent state leakage.
        mockUserStore = createMockUserStore();
        mockNotificationStore = createMockNotificationStore();
        mockRouter = createMockRouter();

        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Component Rendering', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper();
            expect(wrapper.exists()).toBe(true);
        });

        it('renders main page structure', () => {
            const wrapper = createWrapper();
            expect(wrapper.find('[data-test="q-page"]').exists()).toBe(true);
            expect(wrapper.find('[data-test="user-profile-card"]').exists()).toBe(true);
            expect(wrapper.find('[data-test="password-change-dialog"]').exists()).toBe(true);
        });

        it('does not show password warning banner by default', () => {
            const wrapper = createWrapper();
            expect(wrapper.find('[data-test="q-banner"]').exists()).toBe(false);
        });

        it('shows password warning banner when password update is required', async () => {
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick();
            const banner = wrapper.find('[data-test="q-banner"]');
            expect(banner.exists()).toBe(true);
            expect(banner.text()).toContain('You are using the default admin password');
        });
    });

    describe('Authentication Check on Mount', () => {
        it('redirects to login when not authenticated', async () => {
            // Mock the userStore method to return a rejected promise to simulate failure
            mockUserStore.refreshUserFromToken.mockRejectedValue(new Error('Auth error'));
            createWrapper();

            // Wait for the asynchronous side effect (router.push) to happen
            await vi.waitFor(() => {
                expect(mockRouter.push).toHaveBeenCalledWith('/login');
            });
        });

        it('stays on page when authenticated', async () => {
            mockUserStore.refreshUserFromToken.mockResolvedValue(true);
            createWrapper();
            await nextTick();
            expect(mockUserStore.refreshUserFromToken).toHaveBeenCalled();
            expect(mockRouter.push).not.toHaveBeenCalled();
        });

        it('does not check password requirement when user is not authenticated', async () => {
            mockUserStore.refreshUserFromToken.mockResolvedValue(false);
            createWrapper();
            await nextTick();
            expect(mockUserStore.checkPasswordUpdateRequired).not.toHaveBeenCalled();
        });
    });

    describe('Password Update Required Logic', () => {
        it('shows dialog immediately when passwordUpdateRequired is true', async () => {
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick(); // Wait for onMounted to run and schedule the setTimeout

            // Use vi.waitFor to wait for the state to change as a result of the setTimeout.
            // This is more reliable than manually advancing timers.
            await vi.waitFor(() => {
                expect(wrapper.vm.showChangePasswordDialog).toBe(true);
            });
        });

        it('checks password requirement when passwordUpdateRequired is false', async () => {
            mockUserStore.passwordUpdateRequired = false;
            const wrapper = createWrapper();
            await vi.waitFor(() => {
                expect(mockUserStore.checkPasswordUpdateRequired).toHaveBeenCalledWith('testuser');
            });
        });

        it('shows dialog when checkPasswordUpdateRequired returns true', async () => {
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockResolvedValue(true);
            const wrapper = createWrapper();
            await vi.waitFor(() => {
                expect(mockUserStore.checkPasswordUpdateRequired).toHaveBeenCalledWith('testuser');
            });
            vi.advanceTimersByTime(500);
            await nextTick();
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
        });

        it('does not show dialog when checkPasswordUpdateRequired returns false', async () => {
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockResolvedValue(false);
            const wrapper = createWrapper();
            await nextTick();
            expect(wrapper.vm.showChangePasswordDialog).toBe(false);
        });

        it('handles error when checking password requirement', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockRejectedValue(new Error('API Error'));
            createWrapper();
            await vi.waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('Error checking password update requirement:', expect.any(Error));
            });
            consoleSpy.mockRestore();
        });
    });

    describe('Password Change Dialog Management', () => {
        it('initializes dialog as hidden', () => {
            const wrapper = createWrapper();
            expect(wrapper.vm.showChangePasswordDialog).toBe(false);
        });

        it('shows dialog when change password is clicked from profile card', async () => {
            const wrapper = createWrapper();
            const changePasswordBtn = wrapper.find('[data-test="change-password-btn"]');
            await changePasswordBtn.trigger('click');
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
        });

        it('shows dialog when change password is clicked from banner', async () => {
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick();
            const bannerBtn = wrapper.find('[data-test="q-btn"]');
            await bannerBtn.trigger('click');
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
        });

        it('passes forced=true to dialog when password update is required', async () => {
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick();
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('forced')).toBe(true);
        });

        it('passes forced=false to dialog when password update is not required', async () => {
            mockUserStore.passwordUpdateRequired = false;
            const wrapper = createWrapper();
            await nextTick();
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('forced')).toBe(false);
        });

        it('passes correct modelValue to dialog', async () => {
            const wrapper = createWrapper();
            expect(wrapper.findComponent({ name: 'PasswordChangeDialog' }).props('modelValue')).toBe(false);
            wrapper.vm.showChangePasswordDialog = true;
            await nextTick();
            expect(wrapper.findComponent({ name: 'PasswordChangeDialog' }).props('modelValue')).toBe(true);
        });
    });

    describe('Profile Management', () => {
        it('calls editProfile when edit profile button is clicked', async () => {
            const wrapper = createWrapper();
            const editBtn = wrapper.find('[data-test="edit-profile-btn"]');
            await editBtn.trigger('click');
            expect(mockNotificationStore.info).toHaveBeenCalledWith('Edit profile functionality to be implemented');
        });

        it('editProfile method shows info notification', () => {
            const wrapper = createWrapper();
            wrapper.vm.editProfile();
            expect(mockNotificationStore.info).toHaveBeenCalledWith('Edit profile functionality to be implemented');
        });
    });

    describe('UI State Management', () => {
        it('reactive showChangePasswordDialog state updates UI', async () => {
            const wrapper = createWrapper();
            expect(wrapper.vm.showChangePasswordDialog).toBe(false);
            wrapper.vm.showChangePasswordDialog = true;
            await nextTick();
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('modelValue')).toBe(true);
        });

        it('shows correct banner text and styling', async () => {
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick();
            const banner = wrapper.find('[data-test="q-banner"]');
            expect(banner.exists()).toBe(true);
            expect(banner.text()).toContain('You are using the default admin password');
            expect(banner.text()).toContain('For security reasons, please change your password immediately');
        });
    });

    describe('Integration Tests', () => {
        it('complete authenticated user flow without password requirement', async () => {
            mockUserStore.refreshUserFromToken.mockResolvedValue(true);
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockResolvedValue(false);
            const wrapper = createWrapper();
            await nextTick();
            expect(mockRouter.push).not.toHaveBeenCalled();
            await vi.waitFor(() => {
                expect(mockUserStore.checkPasswordUpdateRequired).toHaveBeenCalledWith('testuser');
            });
            expect(wrapper.find('[data-test="q-banner"]').exists()).toBe(false);
            expect(wrapper.vm.showChangePasswordDialog).toBe(false);
        });

        it('complete flow with password update requirement', async () => {
            mockUserStore.refreshUserFromToken.mockResolvedValue(true);
            mockUserStore.passwordUpdateRequired = true;
            const wrapper = createWrapper();
            await nextTick(); // Wait for onMounted to run and schedule the setTimeout

            // Use vi.waitFor to wait for the state to change.
            await vi.waitFor(() => {
                expect(wrapper.vm.showChangePasswordDialog).toBe(true);
            });

            expect(mockRouter.push).not.toHaveBeenCalled();
            expect(wrapper.find('[data-test="q-banner"]').exists()).toBe(true);
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('forced')).toBe(true);
        });

        it('complete flow checking password requirement from API', async () => {
            mockUserStore.refreshUserFromToken.mockResolvedValue(true);
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockResolvedValue(true);
            const wrapper = createWrapper();
            await vi.waitFor(() => {
                expect(mockUserStore.checkPasswordUpdateRequired).toHaveBeenCalledWith('testuser');
            });
            vi.advanceTimersByTime(500);
            await nextTick();
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('forced')).toBe(false);
        });

        it('handles user interaction flow', async () => {
            const wrapper = createWrapper();
            await nextTick();
            const editBtn = wrapper.find('[data-test="edit-profile-btn"]');
            await editBtn.trigger('click');
            expect(mockNotificationStore.info).toHaveBeenCalledWith('Edit profile functionality to be implemented');
            const changePasswordBtn = wrapper.find('[data-test="change-password-btn"]');
            await changePasswordBtn.trigger('click');
            expect(wrapper.vm.showChangePasswordDialog).toBe(true);
            const dialog = wrapper.findComponent({ name: 'PasswordChangeDialog' });
            expect(dialog.props('forced')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('handles authentication check gracefully by redirecting to login on failure', async () => {
            mockUserStore.refreshUserFromToken.mockRejectedValue(new Error('Auth error'));
            createWrapper();
            await vi.waitFor(() => {
                expect(mockRouter.push).toHaveBeenCalledWith('/login');
            });
        });

        it('continues execution when checkPasswordUpdateRequired fails', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockUserStore.passwordUpdateRequired = false;
            mockUserStore.checkPasswordUpdateRequired.mockRejectedValue(new Error('API Error'));
            createWrapper();
            await vi.waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('Error checking password update requirement:', expect.any(Error));
            });
            consoleSpy.mockRestore();
        });
    });
});
