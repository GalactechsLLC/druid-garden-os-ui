/**
 * Available HTTP methods for API requests
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

/**
 * Generic API response interface
 */
export interface ApiResponse<T = any> {
    data?: T;
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    status?: number;
}

/**
 * Retry configuration for API requests
 */
export interface RetryOptions {
    retries: number;
    methods?: HttpMethod[];
    statusCodes?: number[];
    delay?: number;
}

/**
 * Configuration options for API requests
 */
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
 * Options for API operations with loading state management
 */
export interface ApiLoadingOptions {
    showErrorNotification?: boolean;
    showSuccessNotification?: boolean;
    errorMessage?: string;
    successMessage?: string;
}