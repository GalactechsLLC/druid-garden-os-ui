import {defineStore} from 'pinia';
import {computed, nextTick, ref} from 'vue';
import {DEFAULT_FARMER_CONFIG, type FarmerConfig, type FarmerState, type LogEntry,} from '@/types/farmer';
import {farmerStateGet, startFarmerPost, stopFarmerPost, testFarmerConfig, updateFarmerConfig} from '@/services/farmer';
import {useNotificationStore} from '@/stores/notificationStore';
import {get, post} from "@/utils/api.ts";
import {useFarmerChartStore} from '@/stores/farmerChartStore';

/**
 * Farmer management store handling configuration, lifecycle, and monitoring
 * Integrates with chart collection and provides auto-refresh functionality
 */
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

    /**
     * Test farmer configuration and update validation state
     */
    async function updateConfigTestResult() {
        try {
            const result = await testFarmerConfig();
            configTestResult.value = typeof result === 'boolean' ? result :
                (result && typeof result === 'object' && true && 'success' in result) ?
                    (result as any).success : false;
        } catch (err) {
            configTestResult.value = false;
            notificationStore.error('Error testing farmer config: ' + err);
        }
    }

    function setRunningState(value: boolean) {
        isRunning.value = value;
    }

    /**
     * Check farmer process status with support for different status formats
     */
    async function checkFarmerStatus() {
        try {
            const status = await get('farmer/status');

            if (status === 'Running') {
                setRunningState(true);
            } else if (status === 'Stopped' || status === 'Unknown') {
                setRunningState(false);
            } else if (typeof status === 'object' && status.Exited !== undefined) {
                // Handle Exited(i32) case
                setRunningState(false);
            }
        } catch (error) {
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
        } catch (err) {
            notificationStore.error('Error fetching farmer state: ' + err);
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
            notificationStore.error('Error updating farmer configuration: ' + err);
            return false;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Start farmer process and initialize chart data collection
     */
    async function startFarmer() {
        try {
            processingAction.value = true;

            await updateConfigTestResult();

            try {
                await startFarmerPost();

                setRunningState(true);

                await nextTick();

                notificationStore.success('Farmer started successfully');

                // Start chart data collection
                try {
                    const chartStore = useFarmerChartStore();
                    chartStore.startChartCollection();
                } catch (error) {
                    // Chart collection failure shouldn't prevent farmer start
                }
                return { success: true };
            } catch (apiErr) {
                notificationStore.error('Error starting farmer: ' + apiErr);
                return { success: false, message: apiErr };
            }
        } catch (err) {
            notificationStore.error('Error starting farmer: ' + err);
            return { success: false, message: err };
        } finally {
            processingAction.value = false;
        }
    }

    /**
     * Stop farmer process and halt chart data collection
     */
    async function stopFarmer() {
        try {
            processingAction.value = true;

            try {
                await stopFarmerPost();

                setRunningState(false);

                await nextTick();

                notificationStore.success('Farmer stopped successfully')

                // Stop chart data collection
                try {
                    const chartStore = useFarmerChartStore();
                    chartStore.stopChartCollection();
                } catch (error) {
                    // Chart collection failure shouldn't prevent farmer stop
                }
                return { success: true };
            } catch (apiErr) {
                notificationStore.error('Error stopping farmer: ' + apiErr);
                return { success: false, message: apiErr };
            }
        } catch (err) {
            notificationStore.error('Error stopping farmer: ' + err);
            return { success: false, message: err };
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
            notificationStore.error('Error fetching data: ' + err);
        } finally {
            loading.value = false;
        }
    }

    /**
     * Toggle auto-refresh and manage interval lifecycle
     */
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

    /**
     * Update refresh rate and restart auto-refresh if active
     */
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
    }

    function resetConfig() {
        farmer.value.config = DEFAULT_FARMER_CONFIG;
        notificationStore.info('Farmer configuration reset to defaults');
    }

    /**
     * Initialize store with data fetch and auto-refresh setup
     */
    function initialize() {
        fetchAllData();
        if (autoRefresh.value) {
            startAutoRefresh();
        }
    }

    /**
     * Clean up intervals on store destruction
     */
    function cleanup() {
        stopAutoRefresh();
    }

    /**
     * Get pool login URL with validation checks
     */
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

    /**
     * Load farmer configuration from config store with JSON parsing
     */
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
                        return parsedConfig;
                    } catch (parseError) {
                        // Invalid JSON in config
                    }
                }
            }
            return null;
        } catch (err) {
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