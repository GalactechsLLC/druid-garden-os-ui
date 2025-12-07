import { ofetch } from 'ofetch';
import { useNotificationStore } from '@/stores/notificationStore';
import type {
    HttpMethod,
    ApiResponse,
    RetryOptions,
    RequestOptions,
    ApiLoadingOptions
} from '@/types/api';

/**
 * API base URL - can be made environment-specific
 */
export const API_BASE_URL = '';

/**
 * Default request options for API calls
 */
const defaultOptions: RequestOptions = {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    timeout: 30000,
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
 * @param obj - Object to clean
 * @returns Object with null/undefined values removed
 */
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.entries(obj)
        .filter(([_, v]) => v !== null && v !== undefined)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
}

/**
 * Build complete URL with query parameters
 * @param endpoint - API endpoint path
 * @param query - Query parameters to append
 * @returns Complete URL with query string
 */
function buildUrl(endpoint: string, query?: Record<string, string | number | boolean>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const baseUrl = `${API_BASE_URL}/${cleanEndpoint}`;

    if (!query) return baseUrl;

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
 * @param error - The error object
 * @param options - Request options
 * @param endpoint - API endpoint that failed
 */
function handleError(error: any, options: RequestOptions, endpoint: string): never {
    const notificationStore = useNotificationStore();

    const enhancedError = error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown error');

    (enhancedError as any).endpoint = endpoint;
    (enhancedError as any).method = options.method;

    if (options.showErrorNotification && !options.silent) {
        let errorMessage = options.errorMessage ||
            (error.response?.data?.message) ||
            error.message ||
            'An error occurred while communicating with the server';

        if (errorMessage.includes('stream did not contain valid UTF-8')) {
            errorMessage = 'This file contains binary data and cannot be displayed as text';
        } else if (errorMessage.includes('IsADirectory') || errorMessage.includes('Cannot open Directory as File')) {
            errorMessage = 'This is a directory, not a file';
        } else if (errorMessage.includes('InvalidData')) {
            errorMessage = 'Cannot display file: invalid data format';
        }

        const details = `${options.method || 'GET'} ${endpoint}`;

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
 * @param response - Raw API response
 * @param options - Request options
 * @param endpoint - API endpoint
 * @returns Processed response data
 */
function processResponse<T>(
    response: any,
    options: RequestOptions,
    endpoint: string
): T {
    const notificationStore = useNotificationStore();

    if (!(response instanceof Object) || Array.isArray(response)) {
        if (options.showSuccessNotification && options.successMessage && !options.silent) {
            notificationStore.success(options.successMessage);
        }
        return response as T;
    }

    const isApiResponse = 'success' in response;

    if (isApiResponse) {
        const apiResponse = response as ApiResponse<T>;

        if (apiResponse.success && options.showSuccessNotification && !options.silent) {
            const message = options.successMessage || apiResponse.message;
            if (message) {
                notificationStore.success(message);
            }
        }

        if (!apiResponse.success) {
            const error = new Error(apiResponse.message || 'Request failed');
            (error as any).response = { data: apiResponse };
            (error as any).status = apiResponse.status;
            handleError(error, options, endpoint);
        }

        return (apiResponse.data !== undefined ? apiResponse.data : apiResponse) as T;
    }

    return response as T;
}

/**
 * Convert retry option to ofetch format
 * @param retry - Retry configuration
 * @returns Formatted retry option for ofetch
 */
function formatRetryOption(retry: RetryOptions | number | boolean | undefined): number | false | undefined {
    if (retry === undefined) return undefined;
    if (retry === false) return false;
    if (typeof retry === 'number') return retry;
    if (retry === true) return 1;

    return retry.retries || 1;
}

/**
 * Main API request function
 * @param endpoint - API endpoint to call
 * @param options - Request configuration options
 * @returns Promise resolving to the API response data
 */
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const mergedOptions = { ...defaultOptions, ...options };
    const { method, body, headers, timeout, retry, query } = mergedOptions;

    const url = buildUrl(endpoint, query);
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
 * @param endpoint - API endpoint to call
 * @param options - Request options (excluding method and body)
 * @returns Promise resolving to the API response data
 */
export function get<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 * @param endpoint - API endpoint to call
 * @param body - Request body data
 * @param options - Request options (excluding method)
 * @returns Promise resolving to the API response data
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
 * @param endpoint - API endpoint to call
 * @param body - Request body data
 * @param options - Request options (excluding method)
 * @returns Promise resolving to the API response data
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
 * @param endpoint - API endpoint to call
 * @param options - Request options (excluding method)
 * @returns Promise resolving to the API response data
 */
export function del<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * PATCH request helper
 * @param endpoint - API endpoint to call
 * @param body - Request body data
 * @param options - Request options (excluding method)
 * @returns Promise resolving to the API response data
 */
export function patch<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body });
}

/**
 * Handle API operations with loading state management
 * @param loadingRef - Reactive reference for loading state
 * @param apiCall - Function that returns the API promise
 * @param options - Options for notifications and error handling
 * @returns Promise resolving to the API result or undefined on error
 */
export async function withApiLoading<T>(
    loadingRef: { value: boolean },
    apiCall: () => Promise<T>,
    options: ApiLoadingOptions = {}
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