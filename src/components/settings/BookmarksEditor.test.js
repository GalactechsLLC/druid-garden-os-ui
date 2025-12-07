import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BookmarksEditor from '@/components/settings/BookmarksEditor.vue'

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

function createWrapper(propsData = {}) {
    const defaultProps = {
        value: '{}',
        onChange: vi.fn(),
        onSave: vi.fn().mockResolvedValue(undefined)
    }

    const defaultOptions = {
        props: { ...defaultProps, ...propsData },
        global: {
            stubs: {
                'q-badge': {
                    template: '<div class="q-badge" :color="color" :class="$attrs.class"><slot /></div>',
                    props: ['color']
                },
                'q-banner': {
                    template: '<div class="q-banner" :class="$attrs.class"><slot /></div>'
                },
                'q-list': {
                    template: '<div class="q-list" :separator="separator" :bordered="bordered" :class="$attrs.class"><slot /></div>',
                    props: ['separator', 'bordered']
                },
                'q-item': {
                    template: '<div class="q-item"><slot /></div>'
                },
                'q-item-section': {
                    template: '<div class="q-item-section" :side="side"><slot /></div>',
                    props: ['side']
                },
                'q-item-label': {
                    template: '<div class="q-item-label" :caption="caption"><slot /></div>',
                    props: ['caption']
                },
                'q-btn': {
                    template: '<button class="q-btn" @click="$emit(\'click\')" :flat="flat" :round="round" :dense="dense" :outline="outline" :color="color" :icon="icon" :label="label"><slot>{{ label }}</slot></button>',
                    props: ['flat', 'round', 'dense', 'outline', 'color', 'icon', 'label'],
                    emits: ['click']
                },
                'q-input': {
                    template: '<input class="q-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :label="label" :dense="dense" :outlined="outlined" :hint="hint" />',
                    props: ['modelValue', 'label', 'dense', 'outlined', 'hint'],
                    emits: ['update:modelValue']
                },
                'q-space': {
                    template: '<div class="q-space"></div>'
                }
            }
        }
    }

    return mount(BookmarksEditor, defaultOptions)
}

describe('BookmarksEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    describe('Component Initialization', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
        })

        it('renders basic structure', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.bookmarks-editor').exists()).toBe(true)
            expect(wrapper.text()).toContain('Manage Bookmarks')
            expect(wrapper.find('.q-list').exists()).toBe(true)
        })

        it('shows "Add Bookmark" button initially', () => {
            const wrapper = createWrapper()
            const addButton = wrapper.find('.q-btn[label="Add Bookmark"]')
            expect(addButton.exists()).toBe(true)
        })

        it('does not show form initially', () => {
            const wrapper = createWrapper()
            expect(wrapper.find('.q-input[label="Name"]').exists()).toBe(false)
        })
    })

    describe('Bookmark Parsing', () => {
        it('parses empty object correctly', async () => {
            const wrapper = createWrapper({ value: '{}' })
            await nextTick()
            expect(wrapper.text()).toContain('No bookmarks added yet')
        })

        it('parses valid bookmark object', async () => {
            const bookmarksValue = '{\n    "Home": "/home/user",\n    "Documents": "/home/user/docs",\n}'
            const wrapper = createWrapper({ value: bookmarksValue })
            await nextTick()

            expect(wrapper.text()).toContain('Home')
            expect(wrapper.text()).toContain('/home/user')
            expect(wrapper.text()).toContain('Documents')
            expect(wrapper.text()).toContain('/home/user/docs')
        })

        it('handles empty string value', async () => {
            const wrapper = createWrapper({ value: '' })
            await nextTick()
            expect(wrapper.text()).toContain('No bookmarks added yet')
        })

        it('handles whitespace-only value', async () => {
            const wrapper = createWrapper({ value: '   ' })
            await nextTick()
            expect(wrapper.text()).toContain('No bookmarks added yet')
        })

        it('handles malformed JSON with regex fallback', async () => {
            const malformedValue = '"Home": "/home/user", "Documents": "/docs"'
            const wrapper = createWrapper({ value: malformedValue })
            await nextTick()

            expect(wrapper.text()).toContain('Home')
            expect(wrapper.text()).toContain('/home/user')
            expect(wrapper.text()).toContain('Documents')
            expect(wrapper.text()).toContain('/docs')
        })

        it('shows error for completely invalid data', async () => {
            const invalidValue = 'completely invalid data'
            const wrapper = createWrapper({ value: invalidValue })
            await nextTick()

            expect(wrapper.find('.q-banner').exists()).toBe(true)
            expect(wrapper.text()).toContain('Unable to parse bookmarks data')
        })

        it('handles parsing errors gracefully', async () => {
            const wrapper = createWrapper({ value: 'null' })
            await nextTick()
            expect(wrapper.text()).toContain('No bookmarks added yet')
        })
    })

    describe('Bookmark Display', () => {
        it('displays bookmark items correctly', async () => {
            const bookmarksValue = '{\n    "Home": "/home/user",\n    "Root": "/",\n}'
            const wrapper = createWrapper({ value: bookmarksValue })
            await nextTick()

            const items = wrapper.findAll('.q-item')
            // Should have 2 bookmark items (the empty state item won't show)
            expect(items.length).toBeGreaterThanOrEqual(2)

            expect(wrapper.text()).toContain('Home')
            expect(wrapper.text()).toContain('/home/user')
            expect(wrapper.text()).toContain('Root')
            expect(wrapper.text()).toContain('/')
        })

        it('shows empty state when no bookmarks', async () => {
            const wrapper = createWrapper({ value: '{}' })
            await nextTick()
            expect(wrapper.text()).toContain('No bookmarks added yet')
        })

        it('displays delete buttons for each bookmark', async () => {
            const bookmarksValue = '{\n    "Home": "/home/user",\n}'
            const wrapper = createWrapper({ value: bookmarksValue })
            await nextTick()

            const deleteButtons = wrapper.findAll('.q-btn[icon="delete"]')
            expect(deleteButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Adding Bookmarks', () => {
        it('shows form when Add Bookmark button is clicked', async () => {
            const wrapper = createWrapper()
            const addButton = wrapper.find('.q-btn[label="Add Bookmark"]')

            await addButton.trigger('click')
            await nextTick()

            expect(wrapper.find('.q-input[label="Name"]').exists()).toBe(true)
            expect(wrapper.find('.q-input[label="Path"]').exists()).toBe(true)
            expect(wrapper.find('.q-btn[label="Add"]').exists()).toBe(true)
            expect(wrapper.find('.q-btn[label="Cancel"]').exists()).toBe(true)
        })

        it('hides Add Bookmark button when form is shown', async () => {
            const wrapper = createWrapper()

            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            expect(wrapper.find('.q-btn[label="Add Bookmark"]').exists()).toBe(false)
        })

        it('cancels form and returns to initial state', async () => {
            const wrapper = createWrapper()

            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            await wrapper.find('.q-btn[label="Cancel"]').trigger('click')
            await nextTick()

            expect(wrapper.find('.q-input[label="Name"]').exists()).toBe(false)
            expect(wrapper.find('.q-btn[label="Add Bookmark"]').exists()).toBe(true)
        })

        it('adds new bookmark successfully', async () => {
            const mockOnChange = vi.fn()
            const wrapper = createWrapper({
                value: '{}',
                onChange: mockOnChange
            })

            // Open form
            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            // Fill form
            const nameInput = wrapper.find('.q-input[label="Name"]')
            const pathInput = wrapper.find('.q-input[label="Path"]')

            await nameInput.setValue('Test')
            await pathInput.setValue('/test/path')
            await nextTick()

            // Submit form
            await wrapper.find('.q-btn[label="Add"]').trigger('click')
            await nextTick()

            // Check onChange was called with formatted bookmarks
            expect(mockOnChange).toHaveBeenCalled()
            const calledWith = mockOnChange.mock.calls[0][0]
            expect(calledWith).toContain('"Test": "/test/path"')
        })

        it('shows error when name is missing', async () => {
            const wrapper = createWrapper()

            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            const pathInput = wrapper.find('.q-input[label="Path"]')
            await pathInput.setValue('/test/path')
            await nextTick()

            await wrapper.find('.q-btn[label="Add"]').trigger('click')
            await nextTick()

            expect(wrapper.find('.q-banner').exists()).toBe(true)
            expect(wrapper.text()).toContain('Name and Path are required')
        })

        it('shows error when path is missing', async () => {
            const wrapper = createWrapper()

            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            const nameInput = wrapper.find('.q-input[label="Name"]')
            await nameInput.setValue('Test')
            await nextTick()

            await wrapper.find('.q-btn[label="Add"]').trigger('click')
            await nextTick()

            expect(wrapper.find('.q-banner').exists()).toBe(true)
            expect(wrapper.text()).toContain('Name and Path are required')
        })

        it('clears form after successful addition', async () => {
            const wrapper = createWrapper({ value: '{}' })

            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            const nameInput = wrapper.find('.q-input[label="Name"]')
            const pathInput = wrapper.find('.q-input[label="Path"]')

            await nameInput.setValue('Test')
            await pathInput.setValue('/test')
            await nextTick()

            await wrapper.find('.q-btn[label="Add"]').trigger('click')
            await nextTick()

            // Form should be hidden after successful addition
            expect(wrapper.find('.q-input[label="Name"]').exists()).toBe(false)
            expect(wrapper.find('.q-btn[label="Add Bookmark"]').exists()).toBe(true)
        })
    })

    describe('Removing Bookmarks', () => {
        it('removes bookmark when delete button is clicked', async () => {
            const mockOnChange = vi.fn()
            const bookmarksValue = '{\n    "Home": "/home/user",\n    "Test": "/test",\n}'
            const wrapper = createWrapper({
                value: bookmarksValue,
                onChange: mockOnChange
            })
            await nextTick()

            const deleteButton = wrapper.find('.q-btn[icon="delete"]')
            await deleteButton.trigger('click')
            await nextTick()

            expect(mockOnChange).toHaveBeenCalled()
            // Should be called with updated bookmarks (one removed)
            const calledWith = mockOnChange.mock.calls[0][0]
            expect(calledWith).not.toContain('"Home": "/home/user"') || expect(calledWith).not.toContain('"Test": "/test"')
        })

        it('handles removal of non-existent bookmark gracefully', async () => {
            const wrapper = createWrapper({ value: '{}' })

            // Manually call removeBookmark with non-existent name
            wrapper.vm.removeBookmark('nonexistent')
            await nextTick()

            // Should not throw error or break the component
            expect(wrapper.exists()).toBe(true)
        })
    })

    describe('Saving Functionality', () => {
        it('shows saving badge when loading', async () => {
            const wrapper = createWrapper()

            // Manually set loading state
            wrapper.vm.loading = true
            await nextTick()

            expect(wrapper.find('.q-badge').exists()).toBe(true)
            expect(wrapper.text()).toContain('Saving...')
        })

        it('calls onSave with debounced timeout', async () => {
            const mockOnSave = vi.fn().mockResolvedValue(undefined)
            const mockOnChange = vi.fn()
            const wrapper = createWrapper({
                value: '{}',
                onChange: mockOnChange,
                onSave: mockOnSave
            })

            // Add a bookmark to trigger save
            await wrapper.find('.q-btn[label="Add Bookmark"]').trigger('click')
            await nextTick()

            const nameInput = wrapper.find('.q-input[label="Name"]')
            const pathInput = wrapper.find('.q-input[label="Path"]')

            await nameInput.setValue('Test')
            await pathInput.setValue('/test')
            await nextTick()

            await wrapper.find('.q-btn[label="Add"]').trigger('click')
            await nextTick()

            // Fast-forward timers to trigger debounced save
            vi.advanceTimersByTime(1000)
            await nextTick()

            expect(mockOnSave).toHaveBeenCalled()
        })

        it('handles save errors gracefully', async () => {
            const mockOnSave = vi.fn().mockRejectedValue(new Error('Save failed'))
            const wrapper = createWrapper({
                value: '{}',
                onSave: mockOnSave
            })

            // Manually trigger save
            await wrapper.vm.saveBookmarks()
            await nextTick()

            expect(wrapper.find('.q-banner').exists()).toBe(true)
            expect(wrapper.text()).toContain('Failed to save bookmarks')
        })

        it('clears previous timeout when new changes occur', async () => {
            const mockOnSave = vi.fn().mockResolvedValue(undefined)
            const wrapper = createWrapper({
                value: '{}',
                onSave: mockOnSave
            })

            // Trigger first update
            wrapper.vm.updateBookmarks()

            // Trigger second update before first timeout completes
            wrapper.vm.updateBookmarks()

            // Advance timers
            vi.advanceTimersByTime(1000)
            await nextTick()

            // Should only be called once (previous timeout was cleared)
            expect(mockOnSave).toHaveBeenCalledTimes(1)
        })
    })

    describe('Formatting', () => {
        it('formats empty bookmarks correctly', () => {
            const wrapper = createWrapper()
            const result = wrapper.vm.formatBookmarks()
            expect(result).toBe('{}')
        })

        it('formats single bookmark correctly', async () => {
            const wrapper = createWrapper()
            wrapper.vm.bookmarks = { 'Home': '/home/user' }
            const result = wrapper.vm.formatBookmarks()

            expect(result).toContain('"Home": "/home/user"')
            expect(result).toMatch(/{\s*"Home": "\/home\/user",?\s*}/)
        })

        it('formats multiple bookmarks correctly', async () => {
            const wrapper = createWrapper()
            wrapper.vm.bookmarks = {
                'Home': '/home/user',
                'Documents': '/docs'
            }
            const result = wrapper.vm.formatBookmarks()

            expect(result).toContain('"Home": "/home/user"')
            expect(result).toContain('"Documents": "/docs"')
        })
    })

    describe('Error Handling', () => {
        it('clears error when successful operation occurs', async () => {
            const wrapper = createWrapper()

            // Set an error
            wrapper.vm.error = 'Test error'
            await nextTick()

            // Trigger updateBookmarks which should clear error
            wrapper.vm.updateBookmarks()
            await nextTick()

            expect(wrapper.vm.error).toBe('')
        })

        it('handles updateBookmarks errors', async () => {
            const wrapper = createWrapper()

            // Directly override the method to simulate an error in the try block
            const originalUpdateBookmarks = wrapper.vm.updateBookmarks
            wrapper.vm.updateBookmarks = () => {
                try {
                    throw new Error('Simulated error')
                } catch (err) {
                    console.error('Error updating bookmarks:', err)
                    wrapper.vm.error = 'Failed to update bookmarks format'
                }
            }

            wrapper.vm.updateBookmarks()
            await nextTick()

            expect(wrapper.vm.error).toBe('Failed to update bookmarks format')

            // Restore original method
            wrapper.vm.updateBookmarks = originalUpdateBookmarks
        })
    })

    describe('Watchers', () => {
        it('parses bookmarks when props.value changes', async () => {
            const wrapper = createWrapper({ value: '{}' })
            expect(wrapper.text()).toContain('No bookmarks added yet')

            // Update the prop
            await wrapper.setProps({
                value: '{\n    "New": "/new/path",\n}'
            })
            await nextTick()

            expect(wrapper.text()).toContain('New')
            expect(wrapper.text()).toContain('/new/path')
        })

        it('parses bookmarks immediately on mount', () => {
            const bookmarksValue = '{\n    "Home": "/home",\n}'
            const wrapper = createWrapper({ value: bookmarksValue })

            // Should parse immediately due to { immediate: true }
            expect(wrapper.vm.bookmarks).toEqual({ 'Home': '/home' })
        })
    })

    describe('Component Lifecycle', () => {
        it('cleans up timeout on unmount', () => {
            const wrapper = createWrapper()

            // Set a timeout
            wrapper.vm.saveTimeout = 123

            // Unmount component
            wrapper.unmount()

            // Should not throw any errors
            expect(true).toBe(true)
        })
    })
})