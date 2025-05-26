import {type Ref} from 'vue';

import {useQuasar} from 'quasar';

const $q = useQuasar();

/**
 * Perform an async operation with automatic loading state and error handling
 */
export const withLoading = async <T>(
    loadingRef: Ref<boolean>,
    operation: () => Promise<T>,
    errorHandler?: (error: unknown) => void
): Promise<T | undefined> => {
    loadingRef.value = true;

    try {
        return await operation();
    } catch (error) {
        if (errorHandler) {
            errorHandler(error);
        } else {
            // Default error handling
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            $q.notify({
                color: 'negative',
                message: errorMessage,
                icon: 'error'
            });
        }
    } finally {
        loadingRef.value = false;
    }
};

/**
 * Retry an async operation with exponential backoff
 */
export const retryWithBackoff = async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 300
): Promise<T> => {
    let retries = 0;

    while (true) {
        try {
            return await operation();
        } catch (error) {
            if (retries >= maxRetries) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = initialDelay * Math.pow(2, retries);

            // Wait for the specified delay
            await new Promise(resolve => setTimeout(resolve, delay));

            // Increment retry counter
            retries++;
        }
    }
};

/**
 * Debounce a function to limit its execution frequency
 */
export const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return function(...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
};

/**
 * Create a polling function that periodically checks a condition
 */
export const createPoller = <T>(
    checkFn: () => Promise<T>,
    options: {
        interval?: number;
        maxAttempts?: number;
        stopCondition?: (result: T) => boolean;
        onSuccess?: (result: T) => void;
        onFailure?: (error: unknown) => void;
        onComplete?: () => void;
    } = {}
) => {
    const {
        interval = 2000,
        maxAttempts = 30,
        stopCondition = () => false,
        onSuccess,
        onFailure,
        onComplete
    } = options;

    let attempts = 0;
    let timerId: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
        if (timerId) {
            clearInterval(timerId);
            timerId = undefined;
        }

        if (onComplete) {
            onComplete();
        }
    };

    const start = () => {
        attempts = 0;

        timerId = setInterval(async () => {
            try {
                attempts++;

                const result = await checkFn();

                if (onSuccess) {
                    onSuccess(result);
                }

                if (stopCondition(result) || attempts >= maxAttempts) {
                    stop();
                }
            } catch (error) {
                if (onFailure) {
                    onFailure(error);
                }

                if (attempts >= maxAttempts) {
                    stop();
                }
            }
        }, interval);

        return { stop };
    };

    return { start };
};