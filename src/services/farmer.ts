import type { FarmerConfig } from "@/types/farmer";
import { get, post } from '@/utils/api';
import { ofetch } from "ofetch";

/**
 * Helper function for API calls with extended timeouts
 * @param apiCall The API call function to execute
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Promise with the API response
 */
async function apiCallWithExtendedTimeout<T>(
    apiCall: () => Promise<T>,
    timeoutMs: number = 300000
): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const result = await apiCall();
        clearTimeout(timeoutId);
        return result;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Operation timed out. Please try again or check your system.');
        }
        throw error;
    }
}

/**
 * Fetches the current farmer state
 * @returns Promise with farmer state
 */
export async function farmerStateGet(): Promise<any> {
    try {
        const baseUrl = `${window.location.protocol}//${window.location.hostname}:9090`;
        const response = await ofetch(`${baseUrl}/state`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            responseType: 'json'
        });

        return response;
    } catch (err) {
        console.error('Error fetching farmer state:', err);
        throw err;
    }
}

/**
 * Updates the farmer configuration
 * @param config New farmer configuration
 * @returns Promise with updated configuration
 */
export async function updateFarmerConfig(config: FarmerConfig): Promise<any> {
    try {
        return await post('farmer/config', config);
    } catch (err) {
        console.error('Error updating farmer config:', err);
        throw err;
    }
}

/**
 * Starts the farmer process
 * @returns Promise indicating success
 */
export async function startFarmerPost(): Promise<any> {
    try {
        const response = await post('farmer/start');

        return {
            success: true,
            data: response
        };
    } catch (err) {
        console.error('Error starting farmer:', err);
        throw err;
    }
}

/**
 * Stops the farmer process
 * @returns Promise indicating success
 */
export async function stopFarmerPost(): Promise<any> {
    try {
        const response = await post('farmer/stop');

        return {
            success: true,
            data: response
        };
    } catch (err) {
        console.error('Error stopping farmer:', err);
        throw err;
    }
}

/**
 * Tests if the farmer configuration is ready
 * @returns Promise indicating success
 */
export async function testFarmerConfig(): Promise<any> {
    try {
        return await get('farmer/config/ready');
    } catch (err) {
        console.error('Error testing farmer config:', err);
        throw err;
    }
}

/**
 * Fetches the recent logs
 * @param limit Number of log entries to fetch
 * @returns Promise with log entries
 */
export async function getLogs(limit: number = 50): Promise<any> {
    try {
        return await get('farmer/logs', {
            query: { limit: limit.toString() }
        });
    } catch (err) {
        console.error('Error fetching logs:', err);
        throw err;
    }
}

/**
 * Validates a mnemonic phrase with extended timeout
 * @param mnemonicPhrase The mnemonic phrase to validate
 * @returns Promise with validation result
 */
export async function validateMnemonic(mnemonicPhrase: string): Promise<any> {
    try {
        return await apiCallWithExtendedTimeout(
            () => post('farmer/config/mnemonic', {
                mnemonic: mnemonicPhrase
            }),
            3600000
        );
    } catch (err) {
        console.error('Error validating mnemonic:', err);
        throw err;
    }
}

/**
 * Validates a pasted configuration
 * @param configText The configuration text to validate
 * @returns Promise with validation result
 */
export async function validateConfig(configText: string): Promise<any> {
    try {
        return await post('farmer/config/validate', {
            config: configText
        });
    } catch (err) {
        console.error('Error validating configuration:', err);
        throw err;
    }
}

/**
 * Scans drives for existing configuration with extended timeout
 * @returns Promise with scan result
 */
export async function scanDrivesForConfig(): Promise<any> {
    try {
        return await apiCallWithExtendedTimeout(
            () => post('farmer/config/scan', {}),
            3600000
        );
    } catch (err) {
        console.error('Error scanning drives:', err);
        throw err;
    }
}

/**
 * Sets up the farmer with mnemonic with extended timeout
 * @param mnemonicPhrase The mnemonic phrase
 * @returns Promise with setup result
 */
export async function setupWithMnemonic(mnemonicPhrase: string): Promise<any> {
    try {
        const config = await apiCallWithExtendedTimeout(
            () => post('farmer/setup/mnemonic', {
                mnemonic: mnemonicPhrase
            }),
            3600000
        );

        await updateFarmerConfig(config);

        return { success: true, config };
    } catch (err) {
        console.error('Error setting up with mnemonic:', err);
        return { success: false, message: err instanceof Error ? err.message : 'Failed to setup with mnemonic' };
    }
}

/**
 * Sets up the farmer with scanned configuration
 * @param configPath Path to the found configuration
 * @returns Promise with setup result
 */
export async function setupWithScannedConfig(configPath: string): Promise<any> {
    try {
        const config = await post('farmer/setup/scan', {
            configPath
        });

        await updateFarmerConfig(config);

        return { success: true, config };
    } catch (err) {
        console.error('Error setting up with scanned config:', err);
        return { success: false, message: err instanceof Error ? err.message : 'Failed to setup with scanned config' };
    }
}

/**
 * Sets up the farmer with pasted configuration
 * @param configText The configuration text
 * @returns Promise with setup result
 */
export async function setupWithPastedConfig(configText: string): Promise<any> {
    try {
        const config = await post('farmer/setup/config', {
            config: configText
        });

        // Update the farmer configuration
        await updateFarmerConfig(config);

        return { success: true, config };
    } catch (err) {
        console.error('Error setting up with pasted config:', err);
        return { success: false, message: err instanceof Error ? err.message : 'Failed to setup with pasted config' };
    }
}