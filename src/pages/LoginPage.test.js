import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

// Create reactive mock store that Vue can track
const createMockUserStore = () => reactive({
    loading: false,
    login: vi.fn().mockResolvedValue(true)
})

const createMockRouter = () => ({
    push: vi.fn().mockResolvedValue(undefined)
})

let mockUserStore
let mockRouter

// Mock modules
vi.mock('@/stores/userStore', () => ({
    useUserStore: () => mockUserStore
}))

vi.mock('vue-router', () => ({
    useRouter: () => mockRouter
}))

// Mock the Notification component
vi.mock('@/components/Notification.vue', () => ({
    default: {
        name: 'Notification',
        template: '<div class="notification-component"></div>'
    }
}))

// Import the component after mocks are set up
import LoginPage from '@/pages/LoginPage.vue'

function createWrapper() {
    const defaultOptions = {
        global: {
            stubs: {
                'q-page': {
                    template: '<div class="q-page" data-test="q-page"><slot></slot></div>'
                },
                'q-card': {
                    template: '<div class="q-card" data-test="q-card"><slot></slot></div>'
                },
                'q-card-section': {
                    template: '<div class="q-card-section" data-test="q-card-section"><slot></slot></div>'
                },
                'q-form': {
                    template: '<form @submit.prevent="$emit(\'submit\', $event)" data-test="q-form"><slot></slot></form>',
                    emits: ['submit']
                },
                'q-input': {
                    name: 'QInput',
                    template: `
                        <div class="q-input-wrapper" data-test="q-input">
                            <input 
                                :value="modelValue" 
                                :type="type || 'text'"
                                @input="$emit('update:modelValue', $event.target.value)"
                                data-input="true"
                            />
                        </div>
                    `,
                    props: {
                        modelValue: { type: String, default: '' },
                        label: { type: String, default: '' },
                        type: { type: String, default: 'text' },
                        rules: { type: Array, default: () => [] }
                    },
                    emits: ['update:modelValue']
                },
                'q-btn': {
                    name: 'QBtn',
                    template: `
                        <button 
                            :type="type || 'button'" 
                            :disabled="loading"
                            class="q-btn-wrapper"
                            data-test="q-btn"
                        >
                            {{ label || 'Login' }}
                        </button>
                    `,
                    props: {
                        type: { type: String, default: 'button' },
                        color: { type: String, default: '' },
                        label: { type: String, default: 'Login' },
                        loading: { type: Boolean, default: false }
                    }
                },
                'Notification': {
                    template: '<div class="notification-component" data-test="notification"></div>'
                }
            }
        }
    }

    return mount(LoginPage, defaultOptions)
}

describe('LoginPage', () => {
    beforeEach(() => {
        // Create fresh reactive instances for each test
        mockUserStore = createMockUserStore()
        mockRouter = createMockRouter()

        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
        })

        it('displays login form elements', () => {
            const wrapper = createWrapper()

            // Check for form structure
            expect(wrapper.find('form').exists()).toBe(true)

            // Check for input fields
            const inputs = wrapper.findAll('input')
            expect(inputs).toHaveLength(2) // username and password

            // Check for login button
            expect(wrapper.find('button').exists()).toBe(true)
            expect(wrapper.find('button').text()).toContain('Login')
        })

        it('displays correct labels and structure', () => {
            const wrapper = createWrapper()

            // Find components using the component name
            const inputComponents = wrapper.findAllComponents({ name: 'QInput' })
            expect(inputComponents).toHaveLength(2)

            // Check for username input
            const usernameInput = inputComponents[0]
            expect(usernameInput.props('label')).toBe('Username')

            // Check for password input
            const passwordInput = inputComponents[1]
            expect(passwordInput.props('label')).toBe('Password')
            expect(passwordInput.props('type')).toBe('password')
        })

        it('displays loading state correctly', async () => {
            const wrapper = createWrapper()

            // Set loading state
            mockUserStore.loading = true
            await nextTick()

            expect(wrapper.vm.loading).toBe(true)

            const button = wrapper.findComponent({ name: 'QBtn' })
            expect(button.props('loading')).toBe(true)
        })

        it('includes Notification component', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('[data-test="notification"]').exists()).toBe(true)
        })
    })

    describe('Form Data Management', () => {
        it('initializes with empty form data', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.loginForm.username).toBe('')
            expect(wrapper.vm.loginForm.password).toBe('')
        })

        it('updates username when input changes', async () => {
            const wrapper = createWrapper()

            const usernameInput = wrapper.findAllComponents({ name: 'QInput' })[0]
            await usernameInput.vm.$emit('update:modelValue', 'testuser')
            await nextTick()

            expect(wrapper.vm.loginForm.username).toBe('testuser')
        })

        it('updates password when input changes', async () => {
            const wrapper = createWrapper()

            const passwordInput = wrapper.findAllComponents({ name: 'QInput' })[1]
            await passwordInput.vm.$emit('update:modelValue', 'testpass')
            await nextTick()

            expect(wrapper.vm.loginForm.password).toBe('testpass')
        })

        it('maintains form data during user interaction', async () => {
            const wrapper = createWrapper()

            // Set both fields
            const inputs = wrapper.findAllComponents({ name: 'QInput' })
            await inputs[0].vm.$emit('update:modelValue', 'username123')
            await inputs[1].vm.$emit('update:modelValue', 'password456')
            await nextTick()

            expect(wrapper.vm.loginForm.username).toBe('username123')
            expect(wrapper.vm.loginForm.password).toBe('password456')
        })
    })

    describe('Form Validation', () => {
        it('has username validation rules', () => {
            const wrapper = createWrapper()

            const usernameInput = wrapper.findAllComponents({ name: 'QInput' })[0]
            const rules = usernameInput.props('rules')

            expect(rules).toHaveLength(1)
            expect(rules[0]('')).toBe('Username is required')
            expect(rules[0]('test')).toBe(true)
        })

        it('has password validation rules', () => {
            const wrapper = createWrapper()

            const passwordInput = wrapper.findAllComponents({ name: 'QInput' })[1]
            const rules = passwordInput.props('rules')

            expect(rules).toHaveLength(1)
            expect(rules[0]('')).toBe('Password is required')
            expect(rules[0]('test')).toBe(true)
        })
    })

    describe('Login Functionality', () => {
        it('calls login function on form submit', async () => {
            const wrapper = createWrapper()

            // Set form data
            wrapper.vm.loginForm.username = 'testuser'
            wrapper.vm.loginForm.password = 'testpass'

            // Submit form
            await wrapper.find('form').trigger('submit')

            expect(mockUserStore.login).toHaveBeenCalledWith('testuser', 'testpass')
        })

        it('redirects to home page on successful login', async () => {
            const wrapper = createWrapper()

            wrapper.vm.loginForm.username = 'testuser'
            wrapper.vm.loginForm.password = 'testpass'

            await wrapper.vm.login()

            expect(mockUserStore.login).toHaveBeenCalledWith('testuser', 'testpass')
            expect(mockRouter.push).toHaveBeenCalledWith('/')
        })

        it('handles successful login workflow', async () => {
            const wrapper = createWrapper()

            // Set form data
            const inputs = wrapper.findAllComponents({ name: 'QInput' })
            await inputs[0].vm.$emit('update:modelValue', 'validuser')
            await inputs[1].vm.$emit('update:modelValue', 'validpass')
            await nextTick()

            // Submit form directly via the component's login method
            await wrapper.vm.login()

            expect(mockUserStore.login).toHaveBeenCalledWith('validuser', 'validpass')
            expect(mockRouter.push).toHaveBeenCalledWith('/')
        })

        it('handles login failure gracefully', async () => {
            const wrapper = createWrapper()
            mockUserStore.login.mockResolvedValueOnce(false)

            wrapper.vm.loginForm.username = 'invaliduser'
            wrapper.vm.loginForm.password = 'invalidpass'

            await wrapper.vm.login()

            expect(mockUserStore.login).toHaveBeenCalledWith('invaliduser', 'invalidpass')
            expect(mockRouter.push).not.toHaveBeenCalled()
        })

        it('handles login errors gracefully', async () => {
            const wrapper = createWrapper()
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            mockUserStore.login.mockRejectedValueOnce(new Error('Network error'))

            wrapper.vm.loginForm.username = 'testuser'
            wrapper.vm.loginForm.password = 'testpass'

            await wrapper.vm.login()

            expect(mockUserStore.login).toHaveBeenCalledWith('testuser', 'testpass')
            expect(mockRouter.push).not.toHaveBeenCalled()
            expect(consoleSpy).toHaveBeenCalledWith('Login error:', expect.any(Error))

            consoleSpy.mockRestore()
        })

        it('does not redirect on login failure', async () => {
            const wrapper = createWrapper()
            mockUserStore.login.mockResolvedValueOnce(false)

            await wrapper.vm.login()

            expect(mockRouter.push).not.toHaveBeenCalled()
        })
    })

    describe('Loading State Management', () => {
        it('reflects store loading state', async () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.loading).toBe(false)

            mockUserStore.loading = true
            await nextTick()

            expect(wrapper.vm.loading).toBe(true)
        })

        it('disables button during loading', async () => {
            const wrapper = createWrapper()

            mockUserStore.loading = true
            await nextTick()

            const button = wrapper.find('button')
            expect(button.attributes('disabled')).toBeDefined()
        })

        it('shows loading state on button', async () => {
            const wrapper = createWrapper()

            mockUserStore.loading = true
            await nextTick()

            const button = wrapper.findComponent({ name: 'QBtn' })
            expect(button.props('loading')).toBe(true)
        })
    })

    describe('Computed Properties', () => {
        it('loading computed property works correctly', async () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.loading).toBe(false)

            mockUserStore.loading = true
            await nextTick()

            expect(wrapper.vm.loading).toBe(true)

            mockUserStore.loading = false
            await nextTick()

            expect(wrapper.vm.loading).toBe(false)
        })
    })

    describe('User Experience', () => {
        it('maintains form state during submission', async () => {
            const wrapper = createWrapper()

            wrapper.vm.loginForm.username = 'testuser'
            wrapper.vm.loginForm.password = 'testpass'

            const loginPromise = wrapper.vm.login()

            // Form data should remain during submission
            expect(wrapper.vm.loginForm.username).toBe('testuser')
            expect(wrapper.vm.loginForm.password).toBe('testpass')

            await loginPromise
        })

        it('handles empty form submission', async () => {
            const wrapper = createWrapper()

            // Submit with empty form
            await wrapper.vm.login()

            expect(mockUserStore.login).toHaveBeenCalledWith('', '')
        })
    })

    describe('Integration Tests', () => {
        it('complete login workflow with form interaction', async () => {
            const wrapper = createWrapper()

            // User enters credentials
            const inputs = wrapper.findAllComponents({ name: 'QInput' })
            await inputs[0].vm.$emit('update:modelValue', 'john.doe')
            await inputs[1].vm.$emit('update:modelValue', 'secret123')
            await nextTick()

            // Verify form state
            expect(wrapper.vm.loginForm.username).toBe('john.doe')
            expect(wrapper.vm.loginForm.password).toBe('secret123')

            // User submits form by calling login directly
            await wrapper.vm.login()

            // Verify login attempt and redirect
            expect(mockUserStore.login).toHaveBeenCalledWith('john.doe', 'secret123')
            expect(mockRouter.push).toHaveBeenCalledWith('/')
        })

        it('handles complete error workflow', async () => {
            const wrapper = createWrapper()
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            mockUserStore.login.mockRejectedValueOnce(new Error('Authentication failed'))

            // Set credentials and submit
            wrapper.vm.loginForm.username = 'baduser'
            wrapper.vm.loginForm.password = 'badpass'

            await wrapper.vm.login()

            // Should attempt login but not redirect
            expect(mockUserStore.login).toHaveBeenCalledWith('baduser', 'badpass')
            expect(mockRouter.push).not.toHaveBeenCalled()
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe('Accessibility and Structure', () => {
        it('has proper form structure', () => {
            const wrapper = createWrapper()

            expect(wrapper.find('form').exists()).toBe(true)
            const button = wrapper.findComponent({ name: 'QBtn' })
            expect(button.exists()).toBe(true)
            expect(button.props('type')).toBe('submit')
        })

        it('has proper input types', () => {
            const wrapper = createWrapper()

            const inputs = wrapper.findAllComponents({ name: 'QInput' })
            expect(inputs[1].props('type')).toBe('password') // Password field
        })

        it('has proper button configuration', () => {
            const wrapper = createWrapper()

            const button = wrapper.findComponent({ name: 'QBtn' })
            expect(button.props('type')).toBe('submit')
            expect(button.props('color')).toBe('primary')
            expect(button.props('label')).toBe('Login')
        })
    })
})