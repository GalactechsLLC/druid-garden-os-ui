import type {FarmerActionResult, FarmerConfig, FarmerTestResult, MnemonicGenerationResult} from "@/types/farmer";
import { get, post } from '@/utils/api';

/**
 * Fetches the current farmer state from the unified API
 */
export async function farmerStateGet(): Promise<any> {
    return await get('farmer/state', {
        timeout: 30000,
        showErrorNotification: true,
        errorMessage: 'Failed to fetch farmer state'
    });
}

/**
 * Updates the farmer configuration
 */
export async function updateFarmerConfig(config: FarmerConfig): Promise<any> {
    return await post('farmer/config', config, {
        timeout: 60000,
        showSuccessNotification: false,
        showErrorNotification: false,
        silent: true
    });
}

/**
 * Tests if the farmer configuration is ready
 */
export async function testFarmerConfig(): Promise<boolean | FarmerTestResult> {
    return await get('farmer/config/ready', {
        timeout: 30000,
        showErrorNotification: true,
        errorMessage: 'Failed to test farmer configuration'
    });
}

/**
 * Gets the current farmer configuration
 */
export async function getFarmerConfig(): Promise<any> {
    return await get('farmer/config', {
        timeout: 30000,
        showErrorNotification: true,
        errorMessage: 'Failed to fetch farmer configuration'
    });
}

/**
 * Starts the farmer process
 */
export async function startFarmerPost(): Promise<FarmerActionResult> {
    await post('farmer/start', undefined, {
        timeout: 120000,
        showSuccessNotification: false, // Handle in store
        showErrorNotification: false   // Handle in store
    });

    return { success: true };
}

/**
 * Stops the farmer process
 */
export async function stopFarmerPost(): Promise<FarmerActionResult> {
    await post('farmer/stop', undefined, {
        timeout: 60000,
        showSuccessNotification: false, // Handle in store
        showErrorNotification: false   // Handle in store
    });

    return { success: true };
}

/**
 * Restarts the farmer process
 */
export async function restartFarmerPost(): Promise<any> {
    await post('farmer/restart', undefined, {
        timeout: 120000,
        showSuccessNotification: false,
        showErrorNotification: false
    });

    return { success: true };
}

/**
 * Gets farmer status
 */
export async function getFarmerStatus(): Promise<string> {
    return await get('farmer/status', {
        timeout: 15000,
        showErrorNotification: true,
        errorMessage: 'Failed to get farmer status'
    });
}

/**
 * Gets farmer metrics (Prometheus format)
 */
export async function getFarmerMetrics(): Promise<string> {
    return await get('farmer/metrics', {
        timeout: 30000,
        showErrorNotification: true,
        errorMessage: 'Failed to get farmer metrics'
    });
}

/**
 * Gets farmer stats (current activity data)
 */
export async function getFarmerStats(): Promise<any> {
    return await get('farmer/stats', {
        timeout: 30000,
        showErrorNotification: false, // Handle in chart store
        silent: true
    });
}

/**
 * Gets farmer stats for a specific time range
 */
export async function getFarmerStatsRange(startTimestamp: number, endTimestamp: number): Promise<any> {
    return await post('farmer/stats', {
        start: startTimestamp,
        end: endTimestamp
    }, {
        timeout: 30000,
        showErrorNotification: true,
        errorMessage: 'Failed to get farmer stats for range'
    });
}

/**
 * Validates a mnemonic phrase and generates config
 */
export async function generateConfigFromMnemonic(mnemonicPhrase: string): Promise<MnemonicGenerationResult> {
    return await post('farmer/config/mnemonic', {
        mnemonic: mnemonicPhrase
    }, {
        timeout: 300000, // 5 minutes for mnemonic processing
        showErrorNotification: true,
        errorMessage: 'Failed to generate configuration from mnemonic'
    });
}

/**
 * Scans mounted drives for legacy configuration files
 */
export async function scanForLegacyConfigs(): Promise<any> {
    return await post('farmer/config/scan', {}, {
        timeout: 300000, // 5 minutes for drive scanning
        showErrorNotification: true,
        errorMessage: 'Failed to scan drives for configuration files'
    });
}
