import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Notification from '@/components/Notification.vue'

// Mock notification store
const mockNotificationStore = {
    activeNotifications: [],
    dismiss: vi.fn()
}

// Mock modules
vi.mock('@/stores/notificationStore', () => ({
    useNotificationStore: () => mockNotificationStore
}))

function createWrapper() {
    const defaultOptions = {
        global: {
            stubs: {
                'q-icon': {
                    template: '<i class="q-icon" :name="name" :size="size">{{ name }}</i>',
                    props: ['name', 'size']
                },
                'q-btn': {
                    template: '<button class="q-btn" @click="$emit(\'click\')" :color="color" :flat="flat" :dense="dense" :label="label"><slot>{{ label }}</slot></button>',
                    props: ['color', 'flat', 'dense', 'label'],
                    emits: ['click']
                }
            }
        }
    }

    return mount(Notification, defaultOptions)
}

// Sample notification data
const basicNotification = {
    id: 'test-1',
    message: 'Test notification',
    type: 'info',
    visible: true,
    closable: true
}

const notificationWithIcon = {
    id: 'test-2',
    message: 'Test with icon',
    type: 'positive',
    icon: 'check_circle',
    visible: true,
    closable: true
}

const notificationWithCaption = {
    id: 'test-3',
    message: 'Test with caption',
    caption: 'This is a caption',
    type: 'warning',
    visible: true,
    closable: true
}

const notificationWithDetails = {
    id: 'test-4',
    message: 'Test with details',
    details: 'These are additional details',
    type: 'negative',
    visible: true,
    closable: true
}

const notificationWithActions = {
    id: 'test-5',
    message: 'Test with actions',
    type: 'info',
    visible: true,
    closable: true,
    actions: [
        { label: 'OK', color: 'primary', handler: vi.fn() },
        { label: 'Cancel', color: 'negative', handler: vi.fn() }
    ]
}

const notificationWithTimeout = {
    id: 'test-6',
    message: 'Test with timeout',
    type: 'positive',
    timeout: 5000,
    visible: true,
    closable: true
}

const nonClosableNotification = {
    id: 'test-7',
    message: 'Non-closable notification',
    type: 'info',
    visible: true,
    closable: false
}

describe('Notification', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockNotificationStore.activeNotifications = []
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
        })

        it('renders notification container', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.notification-container').exists()).toBe(true)
            expect(wrapper.find('.notifications').exists()).toBe(true)
        })

        it('renders no notifications when store is empty', () => {
            const wrapper = createWrapper()
            expect(wrapper.findAll('.notification')).toHaveLength(0)
        })

        it('renders single notification', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.findAll('.notification')).toHaveLength(1)
            expect(wrapper.text()).toContain('Test notification')
        })

        it('renders multiple notifications', async () => {
            mockNotificationStore.activeNotifications = [basicNotification, notificationWithIcon]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.findAll('.notification')).toHaveLength(2)
            expect(wrapper.text()).toContain('Test notification')
            expect(wrapper.text()).toContain('Test with icon')
        })
    })

    describe('Notification Types and Styling', () => {
        it('applies correct type class for positive notification', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, type: 'positive' }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).toContain('notification--positive')
        })

        it('applies correct type class for negative notification', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, type: 'negative' }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).toContain('notification--negative')
        })

        it('applies correct type class for warning notification', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, type: 'warning' }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).toContain('notification--warning')
        })

        it('applies correct type class for info notification', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, type: 'info' }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).toContain('notification--info')
        })

        it('applies visible class when notification is visible', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, visible: true }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).toContain('notification--visible')
        })

        it('does not apply visible class when notification is not visible', async () => {
            mockNotificationStore.activeNotifications = [{ ...basicNotification, visible: false }]
            const wrapper = createWrapper()
            await nextTick()

            const notification = wrapper.find('.notification')
            expect(notification.classes()).not.toContain('notification--visible')
        })
    })

    describe('Notification Content', () => {
        it('displays notification message', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__message').text()).toBe('Test notification')
        })

        it('displays icon when provided', async () => {
            mockNotificationStore.activeNotifications = [notificationWithIcon]
            const wrapper = createWrapper()
            await nextTick()

            const icon = wrapper.find('.notification__icon .q-icon')
            expect(icon.exists()).toBe(true)
            expect(icon.text()).toBe('check_circle')
        })

        it('does not display icon section when icon is not provided', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__icon').exists()).toBe(false)
        })

        it('displays caption when provided', async () => {
            mockNotificationStore.activeNotifications = [notificationWithCaption]
            const wrapper = createWrapper()
            await nextTick()

            const caption = wrapper.find('.notification__caption')
            expect(caption.exists()).toBe(true)
            expect(caption.text()).toBe('This is a caption')
        })

        it('does not display caption when not provided', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__caption').exists()).toBe(false)
        })

        it('displays details when provided', async () => {
            mockNotificationStore.activeNotifications = [notificationWithDetails]
            const wrapper = createWrapper()
            await nextTick()

            const details = wrapper.find('.notification__details')
            expect(details.exists()).toBe(true)
            expect(details.text()).toBe('These are additional details')
        })

        it('does not display details when not provided', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__details').exists()).toBe(false)
        })
    })

    describe('Notification Actions', () => {
        it('displays action buttons when actions are provided', async () => {
            mockNotificationStore.activeNotifications = [notificationWithActions]
            const wrapper = createWrapper()
            await nextTick()

            const actionsContainer = wrapper.find('.notification__actions')
            expect(actionsContainer.exists()).toBe(true)

            const buttons = wrapper.findAll('.notification__actions .q-btn')
            expect(buttons).toHaveLength(2)
            expect(buttons[0].text()).toBe('OK')
            expect(buttons[1].text()).toBe('Cancel')
        })

        it('does not display actions when not provided', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__actions').exists()).toBe(false)
        })

        it('does not display actions when actions array is empty', async () => {
            mockNotificationStore.activeNotifications = [{
                ...basicNotification,
                actions: []
            }]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__actions').exists()).toBe(false)
        })

        it('calls action handler when action button is clicked', async () => {
            const actionHandler = vi.fn()
            const notificationWithAction = {
                ...basicNotification,
                actions: [{ label: 'Test Action', handler: actionHandler }]
            }
            mockNotificationStore.activeNotifications = [notificationWithAction]
            const wrapper = createWrapper()
            await nextTick()

            const button = wrapper.find('.notification__actions .q-btn')
            await button.trigger('click')

            expect(actionHandler).toHaveBeenCalledTimes(1)
        })
    })

    describe('Close Functionality', () => {
        it('displays close button when notification is closable', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            const closeButton = wrapper.find('.notification__close')
            expect(closeButton.exists()).toBe(true)
            expect(closeButton.find('.q-icon').text()).toBe('close')
        })

        it('does not display close button when notification is not closable', async () => {
            mockNotificationStore.activeNotifications = [nonClosableNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__close').exists()).toBe(false)
        })

        it('calls dismiss function when close button is clicked', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            const closeButton = wrapper.find('.notification__close')
            await closeButton.trigger('click')

            expect(mockNotificationStore.dismiss).toHaveBeenCalledTimes(1)
            expect(mockNotificationStore.dismiss).toHaveBeenCalledWith('test-1')
        })
    })

    describe('Progress Bar', () => {
        it('displays progress bar when timeout is provided and greater than 0', async () => {
            mockNotificationStore.activeNotifications = [notificationWithTimeout]
            const wrapper = createWrapper()
            await nextTick()

            const progress = wrapper.find('.notification__progress')
            expect(progress.exists()).toBe(true)

            const progressBar = wrapper.find('.notification__progress-bar')
            expect(progressBar.exists()).toBe(true)
        })

        it('does not display progress bar when timeout is not provided', async () => {
            mockNotificationStore.activeNotifications = [basicNotification]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__progress').exists()).toBe(false)
        })

        it('does not display progress bar when timeout is 0', async () => {
            mockNotificationStore.activeNotifications = [{
                ...basicNotification,
                timeout: 0
            }]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.find('.notification__progress').exists()).toBe(false)
        })

        it('sets correct animation duration on progress bar', async () => {
            mockNotificationStore.activeNotifications = [notificationWithTimeout]
            const wrapper = createWrapper()
            await nextTick()

            const progressBar = wrapper.find('.notification__progress-bar')
            const style = progressBar.attributes('style')
            expect(style).toContain('animation-duration: 5000ms')
        })
    })

    describe('Progress Color Function', () => {
        it('returns correct color for positive type', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('positive')).toBe('var(--q-positive)')
        })

        it('returns correct color for negative type', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('negative')).toBe('var(--q-negative)')
        })

        it('returns correct color for warning type', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('warning')).toBe('var(--q-warning)')
        })

        it('returns correct color for info type', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('info')).toBe('var(--q-info)')
        })

        it('returns primary color for unknown type', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('unknown')).toBe('var(--q-primary)')
        })

        it('returns primary color for default case', async () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.getProgressColor('')).toBe('var(--q-primary)')
        })
    })

    describe('Dismiss Notification Function', () => {
        it('calls store dismiss method with correct ID', async () => {
            const wrapper = createWrapper()
            wrapper.vm.dismissNotification('test-id')

            expect(mockNotificationStore.dismiss).toHaveBeenCalledTimes(1)
            expect(mockNotificationStore.dismiss).toHaveBeenCalledWith('test-id')
        })
    })

    describe('Complex Notification Scenarios', () => {
        it('renders notification with all features', async () => {
            const complexNotification = {
                id: 'complex-1',
                message: 'Complex notification',
                caption: 'With caption',
                details: 'And details',
                type: 'positive',
                icon: 'check',
                visible: true,
                closable: true,
                timeout: 3000,
                actions: [
                    { label: 'Action 1', handler: vi.fn() },
                    { label: 'Action 2', handler: vi.fn() }
                ]
            }

            mockNotificationStore.activeNotifications = [complexNotification]
            const wrapper = createWrapper()
            await nextTick()

            // Check all elements are present
            expect(wrapper.find('.notification__icon').exists()).toBe(true)
            expect(wrapper.find('.notification__message').text()).toBe('Complex notification')
            expect(wrapper.find('.notification__caption').text()).toBe('With caption')
            expect(wrapper.find('.notification__details').text()).toBe('And details')
            expect(wrapper.find('.notification__close').exists()).toBe(true)
            expect(wrapper.find('.notification__progress').exists()).toBe(true)
            expect(wrapper.findAll('.notification__actions .q-btn')).toHaveLength(2)
            expect(wrapper.find('.notification').classes()).toContain('notification--positive')
            expect(wrapper.find('.notification').classes()).toContain('notification--visible')
        })

        it('handles multiple notifications with different types', async () => {
            const notifications = [
                { ...basicNotification, id: 'multi-1', type: 'positive' },
                { ...basicNotification, id: 'multi-2', type: 'negative' },
                { ...basicNotification, id: 'multi-3', type: 'warning' }
            ]

            mockNotificationStore.activeNotifications = notifications
            const wrapper = createWrapper()
            await nextTick()

            const notificationElements = wrapper.findAll('.notification')
            expect(notificationElements).toHaveLength(3)
            expect(notificationElements[0].classes()).toContain('notification--positive')
            expect(notificationElements[1].classes()).toContain('notification--negative')
            expect(notificationElements[2].classes()).toContain('notification--warning')
        })
    })
})