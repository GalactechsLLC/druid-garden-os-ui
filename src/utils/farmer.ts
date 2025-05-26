// utils/farmer.ts
import type { FarmerConfig } from '@/types/farmer.ts';

/**
 * Validates that the essential farmer configuration is set
 * @param config The farmer configuration to validate
 * @returns An object with validation result and error message
 */
export function validateFarmerConfig(config: FarmerConfig): { valid: boolean; message?: string } {
    if (!config.payout_address || config.payout_address.trim() === '') {
        return { valid: false, message: 'Payout address is required' };
    }

    if (!config.fullnode_ws_host || config.fullnode_ws_host.trim() === '') {
        return { valid: false, message: 'Fullnode WebSocket host is required' };
    }

    if (!config.fullnode_rpc_host || config.fullnode_rpc_host.trim() === '') {
        return { valid: false, message: 'Fullnode RPC host is required' };
    }

    if (config.harvester_configs.custom_config.plot_directories.length === 0) {
        return { valid: false, message: 'At least one plot directory is required' };
    }

    // Validate that plot directories are not empty
    for (const dir of config.harvester_configs.custom_config.plot_directories) {
        if (!dir || dir.trim() === '') {
            return { valid: false, message: 'Plot directories cannot be empty' };
        }
    }

    return { valid: true };
}
