import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import FarmerLogs from './FarmerLogs.vue'
import { mockLogData } from '../../../tests/helpers/testUtils.js'
import { mockLogService, mockFarmerChartStore, resetAllMocks } from '../../../tests/helpers/mockData.js'

// Mock the services
vi.mock('@/services/farmerLog', () => ({
    useLogService: () => mockLogService
}))

vi.mock('@/stores/farmerChartStore', () => ({
    useFarmerChartStore: () => mockFarmerChartStore
}))

// Mock the types/farmer import
vi.mock('@/types/farmer', () => ({
    logLevels: [
        { value: 'ALL', label: 'All' },
        { value: 'TRACE', label: 'Trace' },
        { value: 'DEBUG', label: 'Debug' },
        { value: 'INFO', label: 'Info' },
        { value: 'WARN', label: 'Warning' },
        { value: 'ERROR', label: 'Error' }
    ]
}))

// Simple component stubs to avoid Quasar complexity
const stubs = {
    QSelect: {
        template: '<div class="q-select-stub" data-testid="q-select"><slot /></div>',
        props: ['modelValue', 'options', 'label'],
        emits: ['update:modelValue']
    },
    QBtn: {
        template: '<button class="q-btn-stub" data-testid="q-btn" @click="$emit(\'click\')"><slot /></button>',
        props: ['loading', 'icon', 'flat', 'round', 'color', 'title'],
        emits: ['click']
    },
    QIcon: {
        template: '<i class="q-icon-stub" data-testid="q-icon"></i>',
        props: ['name', 'color', 'size']
    },
    QSpinner: {
        template: '<div class="q-spinner-stub" data-testid="q-spinner"></div>',
        props: ['color', 'size']
    },
    QChip: {
        template: '<div class="q-chip-stub" data-testid="q-chip"><slot /></div>',
        props: ['color', 'textColor', 'icon', 'size']
    }
}

const createWrapper = (component, options = {}) => {
    return mount(component, {
        global: {
            stubs,
            provide: {
                $q: {
                    platform: { is: { ios: false } },
                    screen: { width: 1920 }
                }
            }
        },
        ...options
    })
}

describe('FarmerLogs', () => {
    let wrapper

    beforeEach(() => {
        resetAllMocks()

        // Mock global functions
        global.addEventListener = vi.fn()
        global.removeEventListener = vi.fn()
    })

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount()
        }
    })

    describe('Component Initialization', () => {
        it('initializes with correct default values', () => {
            wrapper = createWrapper(FarmerLogs)

            expect(wrapper.vm.autoScroll).toBe(true)
            expect(wrapper.vm.reconnecting).toBe(false)
            expect(wrapper.vm.showTarget).toBe(false)
            expect(wrapper.vm.isScrolledToBottom).toBe(true)
        })

        it('calls useLogService connect on mount', () => {
            wrapper = createWrapper(FarmerLogs)
            expect(mockLogService.connect).toHaveBeenCalled()
        })

        it('sets up event listeners on mount', () => {
            wrapper = createWrapper(FarmerLogs)
            expect(global.addEventListener).toHaveBeenCalledWith(
                'farmer-started',
                expect.any(Function)
            )
        })
    })

    describe('Log Filtering Logic', () => {
        beforeEach(() => {
            mockLogService.connectionStatus.value = 'connected'
            mockLogService.logs.value = mockLogData
        })

        it('filters logs by ERROR level only', async () => {
            wrapper = createWrapper(FarmerLogs)

            wrapper.vm.selectedLogLevel = { value: 'ERROR', label: 'Error' }
            await nextTick()

            const filteredLogs = wrapper.vm.filteredLogs
            expect(filteredLogs).toHaveLength(1)
            expect(filteredLogs[0].level).toBe('ERROR')
        })

        it('shows all logs when level is ALL', async () => {
            wrapper = createWrapper(FarmerLogs)

            wrapper.vm.selectedLogLevel = { value: 'ALL', label: 'All' }
            await nextTick()

            expect(wrapper.vm.filteredLogs).toHaveLength(3)
        })

        it('filters logs by INFO level and higher priority', async () => {
            wrapper = createWrapper(FarmerLogs)

            wrapper.vm.selectedLogLevel = { value: 'INFO', label: 'Info' }
            await nextTick()

            const filteredLogs = wrapper.vm.filteredLogs
            expect(filteredLogs).toHaveLength(2)
            expect(filteredLogs.some(log => log.level === 'INFO')).toBe(true)
            expect(filteredLogs.some(log => log.level === 'ERROR')).toBe(true)
            expect(filteredLogs.some(log => log.level === 'DEBUG')).toBe(false)
        })

        it('handles undefined logs gracefully', () => {
            mockLogService.logs.value = undefined
            wrapper = createWrapper(FarmerLogs)

            expect(wrapper.vm.filteredLogs).toEqual([])
        })
    })

    describe('Component Methods', () => {
        beforeEach(() => {
            wrapper = createWrapper(FarmerLogs)
        })

        it('clearLogs calls service clearLogs method', () => {
            wrapper.vm.clearLogs()
            expect(mockLogService.clearLogs).toHaveBeenCalled()
        })

        it('toggleAutoScroll changes autoScroll state', () => {
            const initialState = wrapper.vm.autoScroll
            wrapper.vm.toggleAutoScroll()
            expect(wrapper.vm.autoScroll).toBe(!initialState)
        })

        it('handleLogLevelChange calls service changeLogLevel', () => {
            wrapper.vm.selectedLogLevel = { value: 'DEBUG', label: 'Debug' }
            wrapper.vm.handleLogLevelChange()
            expect(mockLogService.changeLogLevel).toHaveBeenCalledWith('DEBUG')
        })

        it('reconnectWebSocket calls disconnect then connect', async () => {
            await wrapper.vm.reconnectWebSocket()
            expect(mockLogService.disconnect).toHaveBeenCalled()
            expect(mockLogService.connect).toHaveBeenCalledTimes(2) // Once on mount, once on reconnect
        })
    })

    describe('Timestamp Formatting', () => {
        beforeEach(() => {
            wrapper = createWrapper(FarmerLogs)
        })

        it('formats Date objects correctly', () => {
            const testDate = new Date('2024-01-01T15:30:45')
            const formatted = wrapper.vm.formatTimestamp(testDate)
            expect(formatted).toMatch(/15:30:45/)
        })

        it('formats array timestamps correctly', () => {
            const arrayTimestamp = [2024, 1, 15, 30, 45, 0, 0, 0, 0]
            const formatted = wrapper.vm.formatTimestamp(arrayTimestamp)
            expect(formatted).toMatch(/15:30:45/)
        })

        it('handles invalid timestamps gracefully', () => {
            const invalidTimestamp = 'invalid'
            expect(() => wrapper.vm.formatTimestamp(invalidTimestamp)).not.toThrow()
        })
    })

    describe('Log Level CSS Classes', () => {
        beforeEach(() => {
            wrapper = createWrapper(FarmerLogs)
        })

        it('returns correct CSS classes for different log levels', () => {
            expect(wrapper.vm.getLogLevelClass('ERROR')).toBe('log-level-error')
            expect(wrapper.vm.getLogLevelClass('WARN')).toBe('log-level-warn')
            expect(wrapper.vm.getLogLevelClass('INFO')).toBe('log-level-info')
            expect(wrapper.vm.getLogLevelClass('DEBUG')).toBe('log-level-debug')
            expect(wrapper.vm.getLogLevelClass('TRACE')).toBe('log-level-trace')
        })

        it('handles case-insensitive log levels', () => {
            expect(wrapper.vm.getLogLevelClass('error')).toBe('log-level-error')
            expect(wrapper.vm.getLogLevelClass('Error')).toBe('log-level-error')
            expect(wrapper.vm.getLogLevelClass('ERROR')).toBe('log-level-error')
        })

        it('returns empty string for unknown log levels', () => {
            expect(wrapper.vm.getLogLevelClass('UNKNOWN')).toBe('')
            expect(wrapper.vm.getLogLevelClass('')).toBe('')
        })
    })

    describe('Connection Status', () => {
        beforeEach(() => {
            wrapper = createWrapper(FarmerLogs)
        })

        it('returns correct icons for connection states', () => {
            mockLogService.connectionStatus.value = 'connected'
            expect(wrapper.vm.getConnectionIcon()).toBe('wifi')

            mockLogService.connectionStatus.value = 'connecting'
            expect(wrapper.vm.getConnectionIcon()).toBe('wifi_find')

            mockLogService.connectionStatus.value = 'error'
            expect(wrapper.vm.getConnectionIcon()).toBe('wifi_off')

            mockLogService.connectionStatus.value = 'disconnected'
            expect(wrapper.vm.getConnectionIcon()).toBe('wifi_off')
        })

        it('generates appropriate status messages', () => {
            mockLogService.connectionStatus.value = 'connecting'
            expect(wrapper.vm.connectionStatusMessage).toContain('Connecting to log stream')

            mockLogService.connectionStatus.value = 'disconnected'
            expect(wrapper.vm.connectionStatusMessage).toContain('Disconnected from log stream')

            mockLogService.connectionStatus.value = 'error'
            expect(wrapper.vm.connectionStatusMessage).toContain('Error connecting to log stream')
        })
    })

    describe('Computed Properties', () => {
        it('displayLogs returns filtered logs in reverse order', async () => {
            mockLogService.connectionStatus.value = 'connected'
            mockLogService.logs.value = mockLogData
            wrapper = createWrapper(FarmerLogs)

            // Set to ALL to see all logs in reverse order
            wrapper.vm.selectedLogLevel = { value: 'ALL', label: 'All' }
            await nextTick()

            const allLogs = wrapper.vm.displayLogs
            // Should show all 3 logs in reverse order
            expect(allLogs).toHaveLength(3)
            expect(allLogs[0].uuid).toBe('3') // DEBUG (most recent)
            expect(allLogs[1].uuid).toBe('2') // ERROR
            expect(allLogs[2].uuid).toBe('1') // INFO (oldest)
        })
    })

    describe('Error Handling', () => {
        it('handles logs with missing properties gracefully', () => {
            const incompleteLog = { uuid: '1', message: 'Test message' }
            mockLogService.logs.value = [incompleteLog]
            wrapper = createWrapper(FarmerLogs)

            expect(() => wrapper.vm.filteredLogs).not.toThrow()
            expect(wrapper.vm.filteredLogs).toHaveLength(1)
        })

        it('handles empty log arrays', () => {
            mockLogService.logs.value = []
            wrapper = createWrapper(FarmerLogs)

            expect(wrapper.vm.filteredLogs).toEqual([])
            expect(wrapper.vm.displayLogs).toEqual([])
        })
    })

    describe('Lifecycle Management', () => {
        it('calls disconnect on component unmount', () => {
            wrapper = createWrapper(FarmerLogs)
            wrapper.unmount()
            expect(mockLogService.disconnect).toHaveBeenCalled()
        })

        it('removes event listeners on unmount', () => {
            wrapper = createWrapper(FarmerLogs)
            wrapper.unmount()
            expect(global.removeEventListener).toHaveBeenCalledWith(
                'farmer-started',
                expect.any(Function)
            )
        })
    })
})