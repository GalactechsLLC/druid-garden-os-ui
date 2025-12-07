import { mount, shallowMount } from '@vue/test-utils'
import { quasarComponents } from './mockQuasar.js'

export const createWrapper = (component, options = {}) => {
    const defaultOptions = {
        global: {
            components: quasarComponents,
            stubs: {
                'router-link': true,
                'router-view': true
            }
        }
    }

    return mount(component, {
        ...defaultOptions,
        ...options,
        global: {
            ...defaultOptions.global,
            ...options.global
        }
    })
}

export const createShallowWrapper = (component, options = {}) => {
    const defaultOptions = {
        global: {
            components: quasarComponents
        }
    }

    return shallowMount(component, {
        ...defaultOptions,
        ...options,
        global: {
            ...defaultOptions.global,
            ...options.global
        }
    })
}

// Wait for all pending promises and Vue reactivity
export const waitForUpdates = async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
}

// Common test data
export const mockLogData = [
    {
        uuid: '1',
        timestamp: new Date('2024-01-01T10:00:00'),
        level: 'INFO',
        message: 'Test info message',
        target: 'farmer'
    },
    {
        uuid: '2',
        timestamp: new Date('2024-01-01T10:01:00'),
        level: 'ERROR',
        message: 'Test error message',
        target: 'farmer'
    },
    {
        uuid: '3',
        timestamp: new Date('2024-01-01T10:02:00'),
        level: 'DEBUG',
        message: 'Test debug message',
        target: 'farmer'
    }
]

// Mock user interactions
export const triggerClick = async (wrapper, selector) => {
    const element = wrapper.find(selector)
    await element.trigger('click')
    await waitForUpdates()
}

export const setInputValue = async (wrapper, selector, value) => {
    const input = wrapper.find(selector)
    await input.setValue(value)
    await waitForUpdates()
}

// Mock async operations
export const mockAsyncOperation = (result, delay = 0) => {
    return new Promise(resolve => setTimeout(() => resolve(result), delay))
}