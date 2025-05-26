import type {SystemSetupStatus} from "@/types/setup.ts";
import type {NetworkConfig, NetworkInterface} from "@/types/network.ts";
import { get, post } from '@/utils/api.ts'

/**
 * Service for system setup operations
 */
export const systemSetupService = {
    /**
     * Check if system setup is required
     */
    async checkSetupRequired(): Promise<SystemSetupStatus> {
        const response = await get('/api/system/setup/status');
        return response.data;
    },

    /**
     * Get available network interfaces
     */
    async getNetworkInterfaces(): Promise<NetworkInterface[]> {
        const response = await get('/api/system/network/interfaces');
        return response.data.interfaces || [];
    },

    /**
     * Configure network settings
     */
    async configureNetwork(config: NetworkConfig): Promise<void> {
        await post('/api/system/network/configure', { config });
    },

    /**
     * Mark setup as completed
     */
    async completeSetup(): Promise<void> {
        await post('/api/system/setup/complete');
    },

    /**
     * Skip system setup
     */
    async skipSetup(): Promise<void> {
        await post('/api/system/setup/skip');
    },

    /**
     * Test network configuration before applying
     */
    async testNetworkConfig(config: NetworkConfig): Promise<{ success: boolean; message: string }> {
        const response = await post('/api/system/network/test', { config });
        return response.data;
    },

    /**
     * Get current network configuration
     */
    async getCurrentNetworkConfig(): Promise<NetworkConfig> {
        const response = await get('/api/system/network/config');
        return response.data;
    }
};
