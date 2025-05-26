import { defineStore } from 'pinia';
import { ref } from 'vue';
import { get, post } from '@/utils/api';
import type {
    NetworkDevice,
    HotspotSettings,
    NetworkInfo,
} from "@/types/network";
import { useConfigStore } from '@/stores/configStore';

export const useNetworkStore = defineStore('network', () => {
    const loading = ref(false);
    const scanning = ref(false);
    const hotspotLoading = ref(false);
    const connecting = ref(false);
    const error = ref<string | null>(null);
    const hotspotEnabled = ref(false);
    const availableNetworks = ref<NetworkDevice[]>([]);
    const networkInterfaces = ref<NetworkInfo[]>([]);
    const networkInfoData = ref<NetworkInfo[]>([]);
    const hotspotSettings = ref<HotspotSettings>({
        ssid: 'MyHotspot',
        password: ''
    });

    const configStore = useConfigStore();

    async function checkInternetConnection(): Promise<boolean> {
        try {
            loading.value = true;
            error.value = null;

            const online = await post('system/is_online', {}, {
                showErrorNotification: false,
                showSuccessNotification: false
            });

            return !!online;
        } catch (err) {
            console.error('Failed to check internet connection:', err);
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function fetchNetworkStatus(): Promise<void> {
        try {
            loading.value = true;
            error.value = null;

            const isHotspotActive = await post('system/hotspot/active', {}, {
                showErrorNotification: false,
                showSuccessNotification: false
            });

            hotspotEnabled.value = !!isHotspotActive;

            const ssidConfig = configStore.configs.find(c => c.key === 'hotspot_ssid');
            const passwordConfig = configStore.configs.find(c => c.key === 'hotspot_password');

            if (ssidConfig) {
                hotspotSettings.value.ssid = ssidConfig.value;
            }

            if (passwordConfig) {
                hotspotSettings.value.password = passwordConfig.value;
            }

            loading.value = false;
        } catch (err) {
            console.error('Failed to fetch network status:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            loading.value = false;
        }
    }

    async function scanNetworks(): Promise<NetworkDevice[]> {
        try {
            scanning.value = true;
            error.value = null;

            const response = await post('system/wifi/scan', {}, {
                showErrorNotification: true,
                errorMessage: 'Failed to scan for networks'
            });

            if (response && Array.isArray(response)) {
                availableNetworks.value = response.map((network: any) => ({
                    ssid: network.ssid,
                    bssid: '',
                    signal: network.strength || 0,
                    frequency: 0,
                    secure: true,
                    connected: false
                }));

                availableNetworks.value.sort((a, b) => b.signal - a.signal);

                await updateConnectedNetworks();
            }

            scanning.value = false;
            return availableNetworks.value;
        } catch (err) {
            console.error('Failed to scan networks:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            scanning.value = false;
            return [];
        }
    }

    async function updateConnectedNetworks(): Promise<void> {
        const currentNetworks = await fetchNetworkInfo();

        availableNetworks.value.forEach(network => {
            network.connected = currentNetworks.some(info =>
                info.name?.includes('wl') &&
                info.ip_addresses && info.ip_addresses.length > 0
            );
        });
    }

    async function connectToNetwork(ssid: string, password: string | null): Promise<boolean> {
        try {
            connecting.value = true;
            error.value = null;

            const payload: any = { ssid };
            if (password && password.trim() !== '') {
                payload.password = password;
            }

            await post('system/wifi/connect', payload, {
                showErrorNotification: true,
                errorMessage: 'Failed to connect to network'
            });

            availableNetworks.value = availableNetworks.value.map(n => ({
                ...n,
                connected: n.ssid === ssid
            }));

            connecting.value = false;
            return true;
        } catch (err) {
            console.error('Failed to connect to network:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            connecting.value = false;
            return false;
        }
    }

    async function setHotspotEnabled(enabled: boolean, settings?: HotspotSettings): Promise<boolean> {
        try {
            hotspotLoading.value = true;
            error.value = null;

            if (enabled) {
                if (settings) {
                    await configStore.updateConfig('hotspot_ssid', settings.ssid);
                    await configStore.updateConfig('hotspot_password', settings.password);

                    const payload = {
                        ssid: settings.ssid,
                        password: settings.password && settings.password.length > 0 ? settings.password : undefined
                    };

                    await post('system/hotspot/start', payload, {
                        showErrorNotification: true,
                        errorMessage: 'Failed to start hotspot'
                    });
                } else {
                    const payload = {
                        ssid: hotspotSettings.value.ssid,
                        password: hotspotSettings.value.password && hotspotSettings.value.password.length > 0
                            ? hotspotSettings.value.password
                            : undefined
                    };

                    await post('system/hotspot/start', payload, {
                        showErrorNotification: true,
                        errorMessage: 'Failed to start hotspot'
                    });
                }
            } else {
                await post('system/hotspot/stop', {}, {
                    showErrorNotification: true,
                    errorMessage: 'Failed to stop hotspot'
                });
            }

            hotspotEnabled.value = enabled;
            hotspotLoading.value = false;
            return true;
        } catch (err) {
            console.error('Failed to set hotspot state:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            hotspotLoading.value = false;
            return false;
        }
    }

    async function restartHotspot(): Promise<boolean> {
        try {
            hotspotLoading.value = true;
            error.value = null;

            await post('system/hotspot/restart', {}, {
                showErrorNotification: true,
                errorMessage: 'Failed to restart hotspot'
            });

            hotspotLoading.value = false;
            return true;
        } catch (err) {
            console.error('Failed to restart hotspot:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            hotspotLoading.value = false;
            return false;
        }
    }

    async function updateHotspotSettings(settings: HotspotSettings): Promise<boolean> {
        try {
            loading.value = true;
            error.value = null;

            await configStore.updateConfig('hotspot_ssid', settings.ssid);
            await configStore.updateConfig('hotspot_password', settings.password);

            hotspotSettings.value = { ...settings };

            if (hotspotEnabled.value) {
                await restartHotspot();
            }

            loading.value = false;
            return true;
        } catch (err) {
            console.error('Failed to update hotspot settings:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            loading.value = false;
            return false;
        }
    }

    async function fetchNetworkInterfaces(): Promise<NetworkInfo[]> {
        return await fetchNetworkInfo();
    }

    async function fetchNetworkInfo(): Promise<NetworkInfo[]> {
        try {
            loading.value = true;
            error.value = null;

            const response = await get('api/system/networks', {
                showErrorNotification: false
            });

            if (response && Array.isArray(response)) {
                networkInfoData.value = response;
                loading.value = false;
                return response;
            }

            loading.value = false;
            return [];
        } catch (err) {
            console.error('Failed to fetch network info:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            loading.value = false;
            return [];
        }
    }

    function getWifiSignalIcon(strength: number): string {
        if (strength >= 75) return 'wifi';
        if (strength >= 50) return 'wifi_2_bar';
        if (strength >= 25) return 'wifi_1_bar';
        return 'wifi_off';
    }

    return {
        loading,
        scanning,
        hotspotLoading,
        connecting,
        error,
        hotspotEnabled,
        availableNetworks,
        networkInterfaces,
        networkInfoData,
        hotspotSettings,
        fetchNetworkStatus,
        scanNetworks,
        setHotspotEnabled,
        updateHotspotSettings,
        fetchNetworkInterfaces,
        fetchNetworkInfo,
        connectToNetwork,
        restartHotspot,
        checkInternetConnection,
        getWifiSignalIcon,
        updateConnectedNetworks
    };
});