import { vi } from 'vitest'
import { ref } from 'vue'

// Mock services - using ref to make them reactive like the real composables
export const mockLogService = {
    logs: ref([]),
    connectionStatus: ref('disconnected'),
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearLogs: vi.fn(),
    changeLogLevel: vi.fn()
}

export const mockFarmerChartStore = {
    farmerData: ref({}),
    updateData: vi.fn(),
    reset: vi.fn()
}

// Mock log levels (should match your actual logLevels)
export const mockLogLevels = [
    { value: 'ALL', label: 'All' },
    { value: 'TRACE', label: 'Trace' },
    { value: 'DEBUG', label: 'Debug' },
    { value: 'INFO', label: 'Info' },
    { value: 'WARN', label: 'Warning' },
    { value: 'ERROR', label: 'Error' }
]

// Reset all mocks
export const resetAllMocks = () => {
    vi.clearAllMocks()
    mockLogService.logs.value = []
    mockLogService.connectionStatus.value = 'disconnected'
}