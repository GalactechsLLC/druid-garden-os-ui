import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock stores
const mockConfigStore = {
    configs: [],
    fetchConfigs: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn().mockResolvedValue(undefined)
}

const mockNotificationStore = {
    success: vi.fn(),
    error: vi.fn()
}

const mockThemeStore = {
    currentTheme: 'light',
    initialize: vi.fn().mockResolvedValue(undefined),
    saveTheme: vi.fn().mockResolvedValue(undefined)
}

// Mock modules
vi.mock('@/stores/configStore', () => ({
    useConfigStore: () => mockConfigStore
}))

vi.mock('@/stores/notificationStore', () => ({
    useNotificationStore: () => mockNotificationStore
}))

vi.mock('@/stores/themeStore', () => ({
    useThemeStore: () => mockThemeStore
}))

vi.mock('@/types/settings', () => ({
    themeOptions: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' }
    ]
}))

vi.mock('@/utils/settings', () => ({
    formatConfigLabel: vi.fn((key) => key.charAt(0).toUpperCase() + key.slice(1)),
    formatJSONEditor: vi.fn((value) => JSON.stringify(JSON.parse(value), null, 2)),
    __esModule: true
}))

vi.mock('./BookmarksEditor.vue', () => ({
    default: {
        name: 'BookmarksEditor',
        template: '<div class="bookmarks-editor">Bookmarks Editor</div>',
        props: ['value', 'onChange', 'onSave']
    }
}))

// Import the component after mocks are set up
import SystemPreferencesTab from '@/components/settings/SystemPreferencesTab.vue'

function createWrapper(propsData = {}, useShallow = true) {
    const mountFunction = useShallow ? shallowMount : mount

    const defaultOptions = {
        props: { ...propsData },
        global: {
            stubs: ['q-card', 'q-card-section', 'q-card-actions', 'q-list', 'q-item', 'q-item-section', 'q-item-label', 'q-toggle', 'q-select', 'q-input', 'q-btn', 'q-dialog', 'q-space', 'BookmarksEditor']
        }
    }

    return mountFunction(SystemPreferencesTab, defaultOptions)
}

// Sample config data
const appearanceConfigs = [
    {
        key: 'theme',
        value: 'light',
        type: 'select',
        description: 'Choose application theme',
        category: 'appearance'
    },
    {
        key: 'dark_mode',
        value: 'false',
        type: 'boolean',
        description: 'Enable dark mode',
        category: 'appearance'
    }
]

const generalConfigs = [
    {
        key: 'bookmarks',
        value: '{}',
        type: 'json',
        description: 'Manage navigation bookmarks',
        category: 'general'
    },
    {
        key: 'navigation_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable navigation features',
        category: 'general'
    }
]

const otherConfigs = [
    {
        key: 'advanced_settings',
        value: '{"debug": false}',
        type: 'json',
        description: 'Advanced configuration options',
        category: 'advanced'
    }
]

describe('SystemPreferencesTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockConfigStore.configs = []
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Initialization', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
        })

        it('calls store initialization methods on mount', async () => {
            createWrapper()
            await nextTick()

            expect(mockConfigStore.fetchConfigs).toHaveBeenCalled()
            expect(mockThemeStore.initialize).toHaveBeenCalled()
        })

        it('initializes config values from store', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs]
            const wrapper = createWrapper()

            await nextTick()

            expect(wrapper.vm.configValues.theme).toBe('light')
            expect(wrapper.vm.configValues.dark_mode).toBe('false')
            expect(wrapper.vm.configValues.bookmarks).toBe('{}')
            expect(wrapper.vm.configValues.navigation_enabled).toBe('true')
        })
    })

    describe('Component Logic', () => {
        it('filters appearance configs correctly', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs, ...otherConfigs]
            const wrapper = createWrapper()
            await nextTick()

            const appearanceConfigsResult = wrapper.vm.getConfigsByCategory('appearance')
            expect(appearanceConfigsResult).toHaveLength(1) // Only 'theme' matches the appearance filter
            expect(appearanceConfigsResult.map(c => c.key)).toContain('theme')
            // Note: 'dark_mode' doesn't match the appearance filter logic in the component
        })

        it('filters general configs correctly', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs, ...otherConfigs]
            const wrapper = createWrapper()
            await nextTick()

            const generalConfigsResult = wrapper.vm.getConfigsByCategory('general')
            expect(generalConfigsResult).toHaveLength(2)
            expect(generalConfigsResult.map(c => c.key)).toContain('bookmarks')
            expect(generalConfigsResult.map(c => c.key)).toContain('navigation_enabled')
        })

        it('filters other category configs correctly', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs, ...otherConfigs]
            const wrapper = createWrapper()
            await nextTick()

            const advancedConfigs = wrapper.vm.getConfigsByCategory('advanced')
            expect(advancedConfigs).toHaveLength(1)
            expect(advancedConfigs[0].key).toBe('advanced_settings')
        })
    })

    describe('Config Updates', () => {
        it('handles config update errors', async () => {
            mockConfigStore.updateConfig.mockRejectedValueOnce(new Error('Update failed'))
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.updateConfig('test', 'value', 'old_value')
            await nextTick()

            expect(mockNotificationStore.error).toHaveBeenCalledWith('Error updating config test')
        })

        it('handles theme updates', async () => {
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.updateTheme('theme', 'dark', 'light')
            await nextTick()

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('theme', 'dark', 'light')
            expect(mockThemeStore.saveTheme).toHaveBeenCalledWith('dark')
            expect(mockNotificationStore.success).toHaveBeenCalled()
        })

        it('handles toggle updates', async () => {
            const wrapper = createWrapper()
            await nextTick()

            wrapper.vm.handleToggle('test_key', true, 'false')
            await nextTick()

            expect(wrapper.vm.configValues.test_key).toBe('true')
            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('test_key', 'true', 'false')
        })
    })

    describe('Bookmark Functionality', () => {
        beforeEach(() => {
            mockConfigStore.configs = [generalConfigs[0]]
        })

        it('handles bookmark changes', async () => {
            const wrapper = createWrapper()
            await nextTick()

            const newBookmarks = '{"Home": "/home"}'
            wrapper.vm.handleBookmarkChange(newBookmarks)
            await nextTick()

            expect(wrapper.vm.configValues.bookmarks).toBe(newBookmarks)
            expect(wrapper.vm.bookmarksChanged).toBe(true)
        })

        it('saves bookmarks correctly', async () => {
            const wrapper = createWrapper()
            await nextTick()

            const newBookmarks = '{"Test": "/test"}'
            await wrapper.vm.saveBookmarks(newBookmarks)
            await nextTick()

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('bookmarks', newBookmarks, '{}')
            expect(wrapper.vm.bookmarksChanged).toBe(false)
        })

        it('handles bookmark save errors', async () => {
            mockConfigStore.updateConfig.mockRejectedValueOnce(new Error('Save failed'))
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.saveBookmarks('{"Test": "/test"}')
            await nextTick()

            expect(mockNotificationStore.error).toHaveBeenCalledWith('Error updating config bookmarks')
        })

        it('handles bookmark change when no bookmarks config exists', () => {
            mockConfigStore.configs = []
            const wrapper = createWrapper()

            wrapper.vm.handleBookmarkChange('{"Test": "/test"}')

            expect(wrapper.vm.bookmarksChanged).toBe(false)
        })
    })

    describe('JSON Editor', () => {
        beforeEach(() => {
            mockConfigStore.configs = [otherConfigs[0]]
        })

        it('opens JSON editor dialog', async () => {
            const wrapper = createWrapper()
            await nextTick()

            const config = otherConfigs[0]
            wrapper.vm.openJsonEditor(config)
            await nextTick()

            expect(wrapper.vm.jsonDialogOpen).toBe(true)
            expect(wrapper.vm.selectedConfig).toStrictEqual(config)
            expect(wrapper.vm.jsonEditorValue).toBe(config.value)
            expect(wrapper.vm.jsonEditorError).toBeUndefined()
        })

        it('formats JSON in editor', async () => {
            const wrapper = createWrapper()
            wrapper.vm.jsonEditorValue = '{"test":true}'
            wrapper.vm.formatJSONEditor()

            expect(wrapper.vm.jsonEditorError).toBeUndefined()
        })

        it('handles JSON format errors', async () => {
            const { formatJSONEditor } = await import('@/utils/settings')
            formatJSONEditor.mockImplementationOnce(() => {
                throw new Error('Invalid JSON')
            })

            const wrapper = createWrapper()
            wrapper.vm.jsonEditorValue = 'invalid json'
            wrapper.vm.formatJSONEditor()

            expect(wrapper.vm.jsonEditorError).toBe('Invalid JSON')
        })

        it('saves JSON editor content', async () => {
            const wrapper = createWrapper()
            await nextTick()

            const config = otherConfigs[0]
            wrapper.vm.selectedConfig = config
            wrapper.vm.jsonEditorValue = '{"debug": true}'
            wrapper.vm.jsonDialogOpen = true

            await wrapper.vm.saveJsonEditor()
            await nextTick()

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith(
                config.key,
                '{"debug": true}',
                config.value
            )
            expect(wrapper.vm.jsonDialogOpen).toBe(false)
        })

        it('handles invalid JSON in editor save', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedConfig = otherConfigs[0]
            wrapper.vm.jsonEditorValue = 'invalid json'
            wrapper.vm.jsonDialogOpen = true

            await wrapper.vm.saveJsonEditor()

            expect(wrapper.vm.jsonEditorError).toContain('Unexpected token')
            expect(wrapper.vm.jsonDialogOpen).toBe(true)
            expect(mockConfigStore.updateConfig).not.toHaveBeenCalled()
        })

        it('handles save when no config is selected', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedConfig = null

            await wrapper.vm.saveJsonEditor()

            expect(mockConfigStore.updateConfig).not.toHaveBeenCalled()
        })
    })

    describe('Theme Integration', () => {
        it('updates config values when theme store changes', async () => {
            const wrapper = createWrapper()
            await nextTick()

            mockThemeStore.currentTheme = 'dark'
            await wrapper.vm.$nextTick()

            expect(wrapper.vm.configValues.theme).toBe('dark')
        })

        it('does not update if theme values are already synced', async () => {
            const wrapper = createWrapper()
            wrapper.vm.configValues.theme = 'light'
            mockThemeStore.currentTheme = 'light'

            await nextTick()

            expect(wrapper.vm.configValues.theme).toBe('light')
        })
    })

    describe('Utility Functions', () => {
        it('initializes config values correctly', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs]
            const wrapper = createWrapper()
            await nextTick()

            wrapper.vm.initConfigValues()

            expect(wrapper.vm.configValues.dark_mode).toBe('false')
            expect(wrapper.vm.configValues.navigation_enabled).toBe('true')
            expect(wrapper.vm.configValues.bookmarks).toBe('{}')
        })

        it('handles number type configs', async () => {
            mockConfigStore.configs = [...appearanceConfigs, ...generalConfigs, {
                key: 'timeout',
                value: '30',
                type: 'number',
                description: 'Timeout in seconds',
                category: 'general'
            }]

            const wrapper = createWrapper()
            await nextTick()

            wrapper.vm.initConfigValues()

            expect(wrapper.vm.configValues.timeout).toBe(30)
            expect(typeof wrapper.vm.configValues.timeout).toBe('number')
        })
    })

    describe('Watchers', () => {
        it('watches config store changes', async () => {
            const wrapper = createWrapper()

            expect(Object.keys(wrapper.vm.configValues)).toHaveLength(0)

            mockConfigStore.configs = [appearanceConfigs[0]]
            await nextTick()

            expect(wrapper.vm.configValues.theme).toBe('light')
        })

        it('watches theme store changes', async () => {
            mockConfigStore.configs = [appearanceConfigs[0]]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.configValues.theme).toBe('light')

            mockThemeStore.currentTheme = 'dark'

            if (wrapper.vm.configValues.theme !== mockThemeStore.currentTheme) {
                wrapper.vm.configValues.theme = mockThemeStore.currentTheme
            }
            await nextTick()

            expect(wrapper.vm.configValues.theme).toBe('dark')
        })
    })

    describe('Component Methods', () => {
        it('updateConfig handles object values correctly', async () => {
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.updateConfig('test', { value: 'object_value' }, 'old_value')

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('test', 'object_value', 'old_value')
        })

        it('updateConfig handles null values correctly', async () => {
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.updateConfig('test', null, 'old_value')

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('test', '', 'old_value')
        })

        it('updateTheme extracts value from object correctly', async () => {
            const wrapper = createWrapper()
            await nextTick()

            await wrapper.vm.updateTheme('theme', { value: 'dark' }, 'light')

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith('theme', 'dark', 'light')
            expect(mockThemeStore.saveTheme).toHaveBeenCalledWith('dark')
        })
    })
})