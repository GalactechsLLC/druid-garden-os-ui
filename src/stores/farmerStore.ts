import {defineStore} from 'pinia';
import {computed, nextTick, ref} from 'vue';
import {DEFAULT_FARMER_CONFIG, type FarmerConfig, type FarmerState, type LogEntry,} from '@/types/farmer';
import {farmerStateGet, startFarmerPost, stopFarmerPost, testFarmerConfig, updateFarmerConfig} from '@/services/farmer';
import {useNotificationStore} from '@/stores/notificationStore';
import {get, post} from "@/utils/api.ts";
import {useFarmerChartStore} from '@/stores/farmerChartStore';

export const useFarmerStore = defineStore('farmer', () => {
    const notificationStore = useNotificationStore();

    const logs = ref<LogEntry[]>([]);

    const farmer = ref<FarmerState>({
        config: DEFAULT_FARMER_CONFIG,
        running: false,
        plot_counts: {
            og_plot_count: 0,
            nft_plot_count: 0,
            compressed_plot_count: 0,
            invalid_plot_count: 0,
            total_plot_space: 0
        },
        blockchain_state: {
            peak: null,
            genesis_challenge_initialized: false,
            sync: {
                sync_mode: false,
                synced: false,
                sync_tip_height: 0,
                sync_progress_height: 0
            },
            difficulty: 0,
            sub_slot_iters: 0,
            space: 0,
            mempool_size: 0,
            mempool_cost: 0,
            mempool_min_fees: {},
            mempool_max_total_cost: 0,
            block_max_cost: 0,
            node_id: ""
        }
    });


    // UI state
    const refreshInterval = ref<number | null>(null);
    const lastUpdated = ref<Date | null>(null);
    const autoRefresh = ref(true);
    const refreshRate = ref(5); // Seconds
    const loading = ref(true);
    const error = ref<string | null>(null);
    const configValid = ref(false);
    const processingAction = ref(false);

    // Computed properties
    const height = computed(() => farmer.value.blockchain_state.peak?.height || 0);
    const timestamp = computed(() => farmer.value.blockchain_state.peak?.timestamp || 0);
    const sync = computed(() => farmer.value.blockchain_state.sync.synced);
    const difficulty = computed(() => farmer.value.blockchain_state.difficulty);
    const space = computed(() => farmer.value.blockchain_state.space);
    const mempool_size = computed(() => farmer.value.blockchain_state.mempool_size);

    const configTestResult = ref(false);
    const isRunning = ref(false);
    const canStartFarmer = computed(() => {
        return configTestResult.value && !isRunning.value;
    });

    const canStopFarmer = computed(() => {
        return isRunning.value;
    });

    // Actions
    async function updateConfigTestResult() {
        try {
            const result = await testFarmerConfig();
            configTestResult.value = typeof result === 'boolean' ? result :
                (result && typeof result === 'object' && true && 'success' in result) ?
                    (result as any).success : false;
        } catch (err) {
            configTestResult.value = false;
            error.value = err instanceof Error ? err.message : 'Failed to test farmer config';
        }
    }
    function setRunningState(value: boolean) {
        isRunning.value = value;
    }

    async function checkFarmerStatus() {
        try {
            const status = await get('farmer/status');

            if (status === 'Running') {
                setRunningState(true);
                console.log('Farmer status: Running');
            } else if (status === 'Stopped' || status === 'Unknown') {
                setRunningState(false);
                console.log('Farmer status:', status);
            } else if (typeof status === 'object' && status.Exited !== undefined) {
                // Handle Exited(i32) case
                setRunningState(false);
                console.log('Farmer exited with code:', status.Exited);
            } else {
                console.log('Unexpected farmer status format:', status);
            }
        } catch (error) {
            console.error('Error checking farmer status:', error);
            setRunningState(false);
        }
    }

    async function getFarmerState() {
        try {
            loading.value = true;
            const state = await farmerStateGet();
            farmer.value = state;

            isRunning.value = state.running;

            await updateConfigTestResult();
            error.value = null;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch farmer state';
            notificationStore.error('Error fetching farmer state: ' + error.value);
        } finally {
            loading.value = false;
        }
    }

    async function updateConfig(newConfig: FarmerConfig) {
        try {
            loading.value = true;

            await updateFarmerConfig(newConfig);

            farmer.value.config = newConfig;

            configValid.value = true;
            return true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to update farmer configuration';
            notificationStore.error('Error updating farmer configuration: ' + error.value);
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function startFarmer() {
        try {
            processingAction.value = true;

            await updateConfigTestResult();

            try {
                await startFarmerPost();

                setRunningState(true);

                await nextTick();

                notificationStore.success('Farmer started successfully');
                try {
                    const chartStore = useFarmerChartStore();
                    chartStore.startChartCollection();
                    console.log('✅ Chart data collection started from farmer store');
                } catch (error) {
                    console.error('Failed to start chart collection:', error);
                }
                return { success: true };
            } catch (apiError) {
                console.error('API error:', apiError);
                notificationStore.error('Failed to start farmer');
                return { success: false };
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to start farmer';
            notificationStore.error('Error starting farmer: ' + error.value);
            return { success: false, message: error.value };
        } finally {
            processingAction.value = false;
        }
    }

    async function stopFarmer() {
        try {
            processingAction.value = true;

            try {
                await stopFarmerPost();

                setRunningState(false);

                await nextTick();

                notificationStore.success('Farmer stopped successfully')
                try {
                    const chartStore = useFarmerChartStore();
                    chartStore.stopChartCollection();
                    console.log('❌ Chart data collection stopped from farmer store');
                } catch (error) {
                    console.error('Failed to stop chart collection:', error);
                }
                return { success: true };
            } catch (apiError) {
                console.error('API error:', apiError);
                notificationStore.error('Failed to stop farmer');
                return { success: false };
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to stop farmer';
            notificationStore.error('Error stopping farmer: ' + error.value);
            return { success: false, message: error.value };
        } finally {
            processingAction.value = false;
        }
    }

    async function fetchAllData() {
        try {
            loading.value = true;

            await Promise.all([
                getFarmerState(),
            ]);

            lastUpdated.value = new Date();
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch data';
            notificationStore.error('Error fetching data: ' + error.value);
        } finally {
            loading.value = false;
        }
    }


    function toggleAutoRefresh() {
        autoRefresh.value = !autoRefresh.value;

        if (autoRefresh.value) {
            startAutoRefresh();
            notificationStore.info(`Auto-refresh enabled (${refreshRate.value}s)`);
        } else {
            stopAutoRefresh();
            notificationStore.info('Auto-refresh disabled');
        }
    }

    function startAutoRefresh() {
        if (refreshInterval.value !== null) {
            clearInterval(refreshInterval.value);
        }

        refreshInterval.value = window.setInterval(() => {
            fetchAllData();
        }, refreshRate.value * 1000);
    }

    function stopAutoRefresh() {
        if (refreshInterval.value !== null) {
            clearInterval(refreshInterval.value);
            refreshInterval.value = null;
        }
    }

    function setRefreshRate(rate: number) {
        refreshRate.value = rate;

        if (autoRefresh.value) {
            stopAutoRefresh();
            startAutoRefresh();
            notificationStore.info(`Refresh rate updated to ${rate}s`);
        }
    }

    function refreshData() {
        fetchAllData();
        // notificationStore.success('Data refreshed');
    }

    function resetConfig() {
        farmer.value.config = DEFAULT_FARMER_CONFIG;
        notificationStore.info('Farmer configuration reset to defaults');
    }

    // Initialize
    function initialize() {
        fetchAllData();
        if (autoRefresh.value) {
            startAutoRefresh();
        }
    }

    function cleanup() {
        stopAutoRefresh();
    }

    async function getPoolLoginUrl(launcherId?: string) {
        if (!canStartFarmer.value) {
            throw new Error('Cannot get pool login URL: Farmer configuration is not ready');
        }
        if (!launcherId) {
            throw new Error('Cannot get pool login URL: Farmer configuration needs launcherId');
        }
        try {
            return await get('/farmer/pool/login?'+ launcherId, {
                headers: {
                    'Content-Type': 'application/json'
                },
                errorMessage: 'Failed to get pool login URL',
                showErrorNotification: false
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get pool login URL';
            notificationStore.error(errorMessage);
            throw err;
        }
    }

    async function loadFarmerConfigFromSettings() {
        try {
            const configs = await get('/config', {
                errorMessage: 'Failed to load configuration',
                showErrorNotification: false
            });

            if (configs && Array.isArray(configs)) {
                const farmerConfigEntry = configs.find(c => c.key === 'farmer_config');
                if (farmerConfigEntry && farmerConfigEntry.value) {
                    try {
                        const parsedConfig = JSON.parse(farmerConfigEntry.value);
                        farmer.value.config = parsedConfig;
                        console.log('Farmer config loaded from settings:', parsedConfig);
                        return parsedConfig;
                    } catch (parseError) {
                        console.error('Failed to parse farmer config JSON:', parseError);
                    }
                }
            }
            return null;
        } catch (err) {
            console.error('Failed to load farmer config from settings:', err);
            return null;
        }
    }

    return {
        isRunning,
        farmer,
        logs,
        refreshInterval,
        lastUpdated,
        autoRefresh,
        refreshRate,
        loading,
        error,
        configValid,
        processingAction,

        height,
        timestamp,
        sync,
        difficulty,
        space,
        mempool_size,
        canStartFarmer,
        canStopFarmer,

        getFarmerState,
        checkFarmerStatus,
        updateConfigTestResult,
        testFarmerConfig,
        updateConfig,
        startFarmer,
        stopFarmer,
        fetchAllData,
        toggleAutoRefresh,
        startAutoRefresh,
        stopAutoRefresh,
        setRefreshRate,
        refreshData,
        resetConfig,
        initialize,
        cleanup,
        getPoolLoginUrl,
        loadFarmerConfigFromSettings
    };
});