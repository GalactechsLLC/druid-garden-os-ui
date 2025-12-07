import { config } from '@vue/test-utils'
import { vi } from 'vitest'

// Global test setup
beforeEach(() => {
    vi.clearAllMocks()
})

// Mock Quasar's $q object with all the properties Quasar components might need
config.global.mocks = {
    $q: {
        notify: vi.fn(),
        dialog: vi.fn(),
        loading: {
            show: vi.fn(),
            hide: vi.fn()
        },
        platform: {
            is: {
                ios: false,
                android: false,
                desktop: true,
                mobile: false,
                electron: false,
                chrome: true,
                firefox: false,
                edge: false,
                safari: false
            }
        },
        screen: {
            width: 1920,
            height: 1080,
            name: 'lg',
            sizes: {
                sm: 600,
                md: 1024,
                lg: 1440,
                xl: 1920
            },
            lt: {
                sm: false,
                md: false,
                lg: false,
                xl: false
            },
            gt: {
                xs: true,
                sm: true,
                md: true,
                lg: false
            }
        },
        dark: {
            isActive: false,
            mode: false
        },
        lang: {
            isoName: 'en-US',
            nativeName: 'English (US)'
        }
    }
}

// Provide global Quasar injection
config.global.provide = {
    $q: config.global.mocks.$q
}

// Mock window methods that might not exist in jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}