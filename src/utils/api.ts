import { ofetch } from 'ofetch';
import { useNotificationStore } from '@/stores/notificationStore';

// API base URL - can be made environment-specific
export const API_BASE_URL = '';

// Available HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

// Generic response interface
export interface ApiResponse<T = any> {
    data?: T;
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    status?: number;
}

// Retry configuration type
export interface RetryOptions {
    retries: number;
    methods?: HttpMethod[];
    statusCodes?: number[];
    delay?: number;
}

// Request configuration options
export interface RequestOptions {
    method?: HttpMethod;
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
    retry?: number | boolean | RetryOptions;
    query?: Record<string, string | number | boolean>;
    showErrorNotification?: boolean;
    showSuccessNotification?: boolean;
    errorMessage?: string;
    successMessage?: string;
    silent?: boolean;
}

/**
 * Default request options
 */
const defaultOptions: RequestOptions = {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    timeout: 30000,  // 30 seconds
    retry: {
        retries: 1,
        methods: ['GET', 'HEAD'],
        statusCodes: [408, 429, 500, 502, 503, 504]
    },
    showErrorNotification: true,
    showSuccessNotification: false
};

/**
 * Clean undefined or null values from an object
 */
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.entries(obj)
        .filter(([_, v]) => v !== null && v !== undefined)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
}

/**
 * Build complete URL with query parameters
 */
function buildUrl(endpoint: string, query?: Record<string, string | number | boolean>): string {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const baseUrl = `${API_BASE_URL}/${cleanEndpoint}`;

    // If there are no query parameters, just return the base URL
    if (!query) return baseUrl;

    // Clean and build query parameters
    const cleanQuery = cleanObject(query);
    const queryEntries = Object.entries(cleanQuery);

    if (queryEntries.length === 0) return baseUrl;

    const queryString = queryEntries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryString}`;
}

/**
 * Handle API errors and show notifications if needed
 */
function handleError(error: any, options: RequestOptions, endpoint: string): never {
    console.error(`API Error for ${endpoint}:`, error);

    // Get notification store
    const notificationStore = useNotificationStore();

    // Prepare enhanced error object
    const enhancedError = error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error');

    // Add request details to error
    (enhancedError as any).endpoint = endpoint;
    (enhancedError as any).method = options.method;

    // Show error notification if not silenced
    if (options.showErrorNotification && !options.silent) {
        // Extract error message
        let errorMessage = options.errorMessage ||
            (error.response?.data?.message) ||
            error.message ||
            'An error occurred while communicating with the server';

        // Improve error messages for specific error types
        if (errorMessage.includes('stream did not contain valid UTF-8')) {
            errorMessage = 'This file contains binary data and cannot be displayed as text';
        } else if (errorMessage.includes('IsADirectory') || errorMessage.includes('Cannot open Directory as File')) {
            errorMessage = 'This is a directory, not a file';
        } else if (errorMessage.includes('InvalidData')) {
            errorMessage = 'Cannot display file: invalid data format';
        }

        const details = `${options.method || 'GET'} ${endpoint}`;

        // Show the notification
        notificationStore.error(errorMessage, {
            details,
            timeout: 10000,
            closable: true
        });
    }

    throw enhancedError;
}

/**
 * Process and format API response
 */
function processResponse<T>(
    response: any,
    options: RequestOptions,
    endpoint: string
): T {
    const notificationStore = useNotificationStore();

    // Simple success case (directly return data)
    if (!(response instanceof Object) || Array.isArray(response)) {
        // Show success notification if enabled
        if (options.showSuccessNotification && options.successMessage && !options.silent) {
            notificationStore.success(options.successMessage);
        }
        return response as T;
    }

    // Handle API Response format with success flag
    const isApiResponse = 'success' in response;

    if (isApiResponse) {
        const apiResponse = response as ApiResponse<T>;

        // If success and has a message, show success notification
        if (apiResponse.success && options.showSuccessNotification && !options.silent) {
            const message = options.successMessage || apiResponse.message;
            if (message) {
                notificationStore.success(message);
            }
        }

        // If not success, treat as error
        if (!apiResponse.success) {
            const error = new Error(apiResponse.message || 'Request failed');
            (error as any).response = { data: apiResponse };
            (error as any).status = apiResponse.status;
            handleError(error, options, endpoint);
        }

        // Return the data field or whole response
        return (apiResponse.data !== undefined ? apiResponse.data : apiResponse) as T;
    }

    // If just a regular object, return it
    return response as T;
}

/**
 * Convert retry option to ofetch format
 */
function formatRetryOption(retry: RetryOptions | number | boolean | undefined): number | false | undefined {
    if (retry === undefined) return undefined;
    if (retry === false) return false;
    if (typeof retry === 'number') return retry;
    if (retry === true) return 1;

    // Handle RetryOptions object - convert to number for ofetch
    return retry.retries || 1;
}

/**
 * Main API request function
 */
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    // Merge with default options
    const mergedOptions = { ...defaultOptions, ...options };
    const { method, body, headers, timeout, retry, query } = mergedOptions;

    // Build complete URL
    const url = buildUrl(endpoint, query);

    // Format retry option for ofetch
    const formattedRetry = formatRetryOption(retry);

    try {
        const response = await ofetch<any>(url, {
            method,
            body,
            headers,
            timeout,
            retry: formattedRetry,
            responseType: 'json'
        });

        return processResponse<T>(response, mergedOptions, endpoint);
    } catch (error) {
        return handleError(error, mergedOptions, endpoint);
    }
}

/**
 * GET request helper
 */
export function get<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 */
export function post<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * PUT request helper
 */
export function put<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'PUT', body });
}

/**
 * DELETE request helper
 */
export function del<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * PATCH request helper
 */
export function patch<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body });
}

/**
 * Handle API operations with loading state
 */
export async function withApiLoading<T>(
    loadingRef: { value: boolean },
    apiCall: () => Promise<T>,
    options: {
        showErrorNotification?: boolean;
        showSuccessNotification?: boolean;
        errorMessage?: string;
        successMessage?: string;
    } = {}
): Promise<T | undefined> {
    const notificationStore = useNotificationStore();

    loadingRef.value = true;

    try {
        const result = await apiCall();

        if (options.showSuccessNotification && options.successMessage) {
            notificationStore.success(options.successMessage);
        }

        return result;
    } catch (error) {
        if (options.showErrorNotification) {
            const errorMessage = options.errorMessage ||
                (error instanceof Error ? error.message : 'An error occurred');

            notificationStore.error(errorMessage);
        }

        return undefined;
    } finally {
        loadingRef.value = false;
    }
}