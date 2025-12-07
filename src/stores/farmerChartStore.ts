import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {type FarmerActivity, type FarmerActivityRecord, MAX_HISTORY_POINTS} from "@/types/farmer";
import {getFarmerStats} from '@/services/farmer';
import {deepCopy} from "deep-copy-ts";
import {useFarmerStore} from "@/stores/farmerStore.ts";

/**
 * API response format for farmer statistics
 */
interface FarmerStatsResponseItem {
    challenge_hash: string;
    sp_hash: string;
    running: boolean;
    og_passed_filter: number;
    og_plot_count: number;
    nft_passed_filter: number;
    nft_plot_count: number;
    compressed_passed_filter: number;
    compressed_plot_count: number;
    invalid_plot_count: number;
    proofs_found: number;
    total_plot_space: number;
    full_node_height: number;
    full_node_difficulty: number;
    full_node_synced: boolean;
    gathered: string;
}

type FarmerStatsResponse = FarmerStatsResponseItem[];

/**
 * Farmer chart data store managing real-time activity tracking and historical data
 * Provides adaptive polling, duplicate detection, and chart data optimization
 */
export const useFarmerChartStore = defineStore('farmerChart', () => {
    // Current activity state (most recent data point)
    const currentActivity = ref<FarmerActivity>({
        passedFilter: {
            og: { processed: 0, total: 0 },
            nft: { processed: 0, total: 0 },
            compressed: { processed: 0, total: 0 }
        },
        proofsFound: 0,
        partialsFound: {
            nft: 0,
            compressed: 0
        }
    });

    // Historical data points (each unique entry)
    const historyData = ref({
        farmer_records: [] as FarmerActivityRecord[]
    });

    // Loading and error states
    const isLoading = ref(false);
    const lastError = ref<string | null>(null);
    const lastFetchTime = ref<Date | null>(null);

    // Chart update optimization
    const chartUpdateId = ref(0);

    const activity = computed(() => currentActivity.value);

    // Polling management with adaptive intervals
    let pollInterval: number | null = null;

    const POLLING_INTERVALS = {
        NORMAL: 5000,        // 5 seconds for normal monitoring
        SLOW: 10000,         // 10 seconds when idle
        STOPPED: 30000       // 30 seconds when farmer is stopped
    };

    const currentPollInterval = ref(POLLING_INTERVALS.NORMAL);
    const lastActivityTime = ref<Date | null>(null);
    const consecutiveEmptyPolls = ref(0);

    // Request management to prevent duplicate calls
    const isFetching = ref(false);
    const pendingFetchPromise = ref<Promise<void> | null>(null);
    const fetchQueue = ref<number>(0);
    const lastSuccessfulFetch = ref<Date | null>(null);

    const REQUEST_TIMEOUT = 10000; // 10 seconds
    const MAX_RETRIES = 3;
    let currentRetryCount = 0;

    /**
     * Convert API timestamp string to Date object with error handling
     */
    function convertApiTimestamp(gathered: string): Date {
        try {
            const cleanTimestamp = gathered.replace(' +00:00:00', 'Z');
            const date = new Date(cleanTimestamp);

            if (isNaN(date.getTime())) {
                return new Date();
            }

            return date;
        } catch (error) {
            return new Date();
        }
    }

    /**
     * Transform API response to internal activity format
     */
    function convertApiResponseToActivity(apiData: FarmerStatsResponseItem): FarmerActivity {
        return {
            passedFilter: {
                og: {
                    processed: apiData.og_passed_filter || 0,
                    total: apiData.og_plot_count || 0
                },
                nft: {
                    processed: apiData.nft_passed_filter || 0,
                    total: apiData.nft_plot_count || 0
                },
                compressed: {
                    processed: apiData.compressed_passed_filter || 0,
                    total: apiData.compressed_plot_count || 0
                }
            },
            proofsFound: apiData.proofs_found || 0,
            partialsFound: {
                nft: 0, // Not available in current API
                compressed: 0
            }
        };
    }

    /**
     * Check for duplicate entries using challenge and signage point hashes
     */
    function isDuplicateEntry(newChallengeHash: string, newSpHash: string): boolean {
        return historyData.value.farmer_records.some(record => {
            return record.metadata &&
                record.metadata.challenge_hash === newChallengeHash &&
                record.metadata.sp_hash === newSpHash;
        });
    }

    /**
     * Main fetch function with request deduplication and queuing
     */
    async function fetchFarmerStats(): Promise<void> {
        // Prevent multiple concurrent requests
        if (isFetching.value) {
            fetchQueue.value++;

            if (pendingFetchPromise.value) {
                try {
                    await pendingFetchPromise.value;
                } catch (error) {
                    // Ignore errors from pending promise
                }
            }
            return;
        }

        isFetching.value = true;
        fetchQueue.value = 0;

        const fetchPromise = performFetch();
        pendingFetchPromise.value = fetchPromise;

        try {
            await fetchPromise;
        } finally {
            isFetching.value = false;
            pendingFetchPromise.value = null;

            // Process queued requests with delay to prevent spam
            if (fetchQueue.value > 0) {
                setTimeout(() => {
                    if (!isFetching.value) {
                        fetchFarmerStats();
                    }
                }, 100);
            }
        }
    }

    /**
     * Core fetch logic with retry mechanism and timeout handling
     */
    async function performFetch(): Promise<void> {
        try {
            isLoading.value = true;
            lastError.value = null;

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, REQUEST_TIMEOUT);

            let data: FarmerStatsResponse;

            try {
                data = await getFarmerStats();
                clearTimeout(timeoutId);
                currentRetryCount = 0;
            } catch (fetchError) {
                clearTimeout(timeoutId);

                // Retry logic with exponential backoff
                if (currentRetryCount < MAX_RETRIES) {
                    currentRetryCount++;
                    const delay = Math.min(1000 * Math.pow(2, currentRetryCount - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return performFetch();
                }

                throw fetchError;
            }

            if (!data || !Array.isArray(data) || data.length === 0) {
                consecutiveEmptyPolls.value++;

                // Slow down polling if consistently getting empty results
                if (consecutiveEmptyPolls.value > 3 && currentPollInterval.value < POLLING_INTERVALS.SLOW) {
                    startPolling(POLLING_INTERVALS.SLOW);
                }
                return;
            }

            let newEntriesAdded = 0;
            let latestEntry: FarmerStatsResponseItem | null = null;
            let latestTimestamp: Date | null = null;
            let hasNewActivity = false;

            // Process each entry with duplicate detection
            data.forEach((apiData) => {
                try {
                    const timestamp = convertApiTimestamp(apiData.gathered);
                    const isDuplicate = isDuplicateEntry(apiData.challenge_hash, apiData.sp_hash);

                    if (!isDuplicate) {
                        const activity = convertApiResponseToActivity(apiData);

                        // Check for actual farming activity
                        const hasActivity = activity.passedFilter.og.processed > 0 ||
                            activity.passedFilter.nft.processed > 0 ||
                            activity.passedFilter.compressed.processed > 0 ||
                            activity.proofsFound > 0;

                        if (hasActivity) {
                            hasNewActivity = true;
                            lastActivityTime.value = timestamp;
                        }

                        const activityRecord: FarmerActivityRecord = {
                            timestamp,
                            activity: deepCopy(activity),
                            metadata: {
                                challenge_hash: apiData.challenge_hash,
                                sp_hash: apiData.sp_hash,
                                full_node_height: apiData.full_node_height,
                                full_node_difficulty: apiData.full_node_difficulty,
                                full_node_synced: apiData.full_node_synced,
                                total_plot_space: apiData.total_plot_space
                            }
                        };

                        historyData.value.farmer_records.push(activityRecord);
                        newEntriesAdded++;

                        // Track most recent entry
                        if (!latestTimestamp || timestamp > latestTimestamp) {
                            latestEntry = apiData;
                            latestTimestamp = timestamp;
                        }
                    }
                } catch (entryError) {
                    // Skip malformed entries
                }
            });

            // Reset empty polls counter on successful data
            if (newEntriesAdded > 0) {
                consecutiveEmptyPolls.value = 0;
                lastSuccessfulFetch.value = new Date();
            }

            // Adaptive polling based on activity
            if (hasNewActivity && currentPollInterval.value > POLLING_INTERVALS.NORMAL) {
                startPolling(POLLING_INTERVALS.NORMAL);
            } else if (!hasNewActivity && newEntriesAdded === 0) {
                consecutiveEmptyPolls.value++;
            }

            // Update state if new entries were added
            if (newEntriesAdded > 0) {
                // Sort records by timestamp
                historyData.value.farmer_records.sort((a, b) =>
                    a.timestamp.getTime() - b.timestamp.getTime()
                );

                // Update current activity with most recent entry
                if (latestEntry) {
                    currentActivity.value = convertApiResponseToActivity(latestEntry);
                }

                // Maintain history size limit
                if (historyData.value.farmer_records.length > MAX_HISTORY_POINTS) {
                    const toRemove = historyData.value.farmer_records.length - MAX_HISTORY_POINTS;
                    historyData.value.farmer_records.splice(0, toRemove);
                }

                chartUpdateId.value++;
            }

            lastFetchTime.value = new Date();

        } catch (error) {
            consecutiveEmptyPolls.value++;

            // Don't log errors when farmer is not running (expected)
            if (error instanceof Error && !error.message.includes('farmer/stats')) {
                lastError.value = error.message;
            }
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Start polling with intelligent interval selection
     */
    function startPolling(intervalMs?: number): void {
        if (pollInterval) {
            stopPolling();
        }

        const interval = intervalMs || getSmartPollInterval();
        currentPollInterval.value = interval;

        // Initial fetch
        fetchFarmerStats();

        // Set up interval
        pollInterval = setInterval(() => {
            fetchFarmerStats();
        }, interval);
    }

    /**
     * Determine optimal polling interval based on farmer state and activity
     */
    function getSmartPollInterval(): number {
        const farmerStore = useFarmerStore();

        // If farmer is not running, poll slowly
        if (!farmerStore.isRunning) {
            return POLLING_INTERVALS.STOPPED;
        }

        if (lastActivityTime.value) {
            const timeSinceActivity = Date.now() - lastActivityTime.value.getTime();
            if (timeSinceActivity < 30000) { // 30 seconds
                return POLLING_INTERVALS.NORMAL;
            }
        }

        // If many empty polls, slow down
        if (consecutiveEmptyPolls.value > 5) {
            return POLLING_INTERVALS.SLOW;
        }

        return POLLING_INTERVALS.NORMAL;
    }

    function enableNormalPolling(): void {
        startPolling(POLLING_INTERVALS.NORMAL);
    }

    /**
     * Stop polling and wait for in-flight requests to complete
     */
    function stopPolling(): void {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }

        // Wait for any in-flight requests to complete
        if (isFetching.value && pendingFetchPromise.value) {
            pendingFetchPromise.value.finally(() => {
                // Request completed
            });
        }

        // Reset state
        fetchQueue.value = 0;
        currentRetryCount = 0;
    }

    /**
     * Get historical records within specified timeframe
     */
    function getHistoryForTimeframe(hours: number): FarmerActivityRecord[] {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hours);

            return historyData.value.farmer_records.filter(record =>
                record.timestamp >= cutoffTime
            );
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate chart data for specified timeframe with individual event tracking
     */
    function getChartData(timeframeHours: number) {
        try {
            const records = getHistoryForTimeframe(timeframeHours);

            if (!records || records.length === 0) {
                return {
                    timestamps: [],
                    ogPassedFilter: [],
                    nftPassedFilter: [],
                    compressedPassedFilter: [],
                    updateId: chartUpdateId.value
                };
            }

            const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            // Show individual events rather than aggregating for accurate farming view
            return {
                timestamps: sortedRecords.map(record => record.timestamp),
                ogPassedFilter: sortedRecords.map(record => record.activity.passedFilter.og.processed),
                nftPassedFilter: sortedRecords.map(record => record.activity.passedFilter.nft.processed),
                compressedPassedFilter: sortedRecords.map(record => record.activity.passedFilter.compressed.processed),
                updateId: chartUpdateId.value
            };
        } catch (error) {
            return {
                timestamps: [],
                ogPassedFilter: [],
                nftPassedFilter: [],
                compressedPassedFilter: [],
                updateId: chartUpdateId.value
            };
        }
    }

    function getProofsFoundInTimeframe(hours: number): number {
        const records = getHistoryForTimeframe(hours);
        if (records.length === 0) return 0;

        return records.reduce((total, record) => total + record.activity.proofsFound, 0);
    }

    function getPartialsFoundInTimeframe(hours: number): { nft: number, compressed: number } {
        const records = getHistoryForTimeframe(hours);
        if (records.length === 0) return { nft: 0, compressed: 0 };

        return records.reduce((totals, record) => ({
            nft: totals.nft + record.activity.partialsFound.nft,
            compressed: totals.compressed + record.activity.partialsFound.compressed
        }), { nft: 0, compressed: 0 });
    }

    function getCurrentProcessedPlots() {
        return currentActivity.value.passedFilter;
    }

    /**
     * Generate chart series data with filtering for meaningful data points
     */
    function getChartSeries(timeframeHours: number) {
        try {
            const chartData = getChartData(timeframeHours);

            if (!chartData.timestamps.length) {
                return [];
            }

            const { timestamps, ogPassedFilter, nftPassedFilter, compressedPassedFilter } = chartData;

            const series = [
                {
                    name: 'OG Plots Passed Filter',
                    data: timestamps.map((time, index) => ({
                        x: time.getTime(),
                        y: ogPassedFilter[index] || 0
                    })),
                    color: '#4CAF50'
                },
                {
                    name: 'NFT Plots Passed Filter',
                    data: timestamps.map((time, index) => ({
                        x: time.getTime(),
                        y: nftPassedFilter[index] || 0
                    })),
                    color: '#FF9800'
                },
                {
                    name: 'Compressed Plots Passed Filter',
                    data: timestamps.map((time, index) => ({
                        x: time.getTime(),
                        y: compressedPassedFilter[index] || 0
                    })),
                    color: '#9C27B0'
                }
            ];

            // Filter out series with no data
            const seriesWithData = series.filter(s => s.data.some(point => point.y > 0));

            // Return all series if none have data to maintain chart structure
            return seriesWithData.length === 0 ? series : seriesWithData;
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate chart configuration options based on timeframe
     */
    function getChartOptions(timeframeHours: number) {
        // Determine appropriate time format and title based on timeframe
        let timeFormat = 'HH:mm:ss';
        let titleText = 'Plots Passed Filter';

        if (timeframeHours <= 1) {
            timeFormat = 'HH:mm:ss';
            titleText = 'Plots Passed Filter (Individual Events)';
        } else if (timeframeHours <= 6) {
            timeFormat = 'HH:mm';
            titleText = 'Plots Passed Filter (Individual Events)';
        } else if (timeframeHours <= 24) {
            timeFormat = 'HH:mm';
            titleText = 'Plots Passed Filter (Individual Events)';
        } else {
            timeFormat = 'MMM dd HH:mm';
            titleText = 'Plots Passed Filter (Individual Events)';
        }

        return {
            chart: {
                type: 'column',
                animations: {
                    enabled: false,
                    dynamicAnimation: {
                        enabled: false
                    }
                },
                toolbar: {
                    show: true
                },
                zoom: {
                    enabled: true,
                    type: 'x'
                }
            },
            plotOptions: {
                bar: {
                    columnWidth: '50%',
                    distributed: false
                }
            },
            stroke: {
                width: 2,
                curve: 'straight'
            },
            markers: {
                size: 3,
                hover: {
                    size: 5
                }
            },
            colors: ['#4CAF50', '#FF9800', '#9C27B0'],
            dataLabels: {
                enabled: true,
                formatter: function(val: any) {
                    return val > 0 ? val : '';
                },
                style: {
                    fontSize: '10px',
                    fontWeight: 'bold'
                }
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    format: timeFormat,
                    formatter: function(val: any) {
                        if (!val) return '';
                        try {
                            const date = new Date(val);
                            return date.toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: timeframeHours <= 1 ? '2-digit' : undefined
                            });
                        } catch (e) {
                            return val;
                        }
                    }
                },
                title: {
                    text: 'Time'
                }
            },
            yaxis: {
                title: {
                    text: titleText
                },
                min: 0,
                forceNiceScale: true,
                decimalsInFloat: 0,
                labels: {
                    formatter: function(val: any) {
                        return Math.floor(val);
                    }
                }
            },
            legend: {
                position: 'top',
                show: true,
                labels: {
                    useSeriesColors: true
                }
            },
            tooltip: {
                shared: true,
                intersect: false,
                x: {
                    formatter: function(val: any) {
                        try {
                            const date = new Date(val);
                            return date.toLocaleString();
                        } catch (e) {
                            return val;
                        }
                    }
                },
                y: {
                    formatter: function(val: any) {
                        return val + ' plots';
                    }
                }
            }
        };
    }

    function resetActivity(): void {
        currentActivity.value = {
            passedFilter: {
                og: { processed: 0, total: 0 },
                nft: { processed: 0, total: 0 },
                compressed: { processed: 0, total: 0 }
            },
            proofsFound: 0,
            partialsFound: {
                nft: 0,
                compressed: 0
            }
        };
    }

    function clearHistory(): void {
        historyData.value.farmer_records = [];
        chartUpdateId.value++;
    }

    /**
     * Initialize store with farmer state monitoring and adaptive polling
     */
    function initializeData(): void {
        resetActivity();

        const farmerStore = useFarmerStore();

        // Start polling immediately if farmer is running
        if (farmerStore.isRunning) {
            startPolling();
        }

        // Monitor farmer state changes for responsive polling
        const stateCheckInterval = setInterval(() => {
            const isRunning = farmerStore.isRunning;

            if (isRunning && !pollInterval) {
                startPolling();
            } else if (!isRunning && pollInterval) {
                stopPolling();
            }
        }, 2000);

        // Store interval for cleanup
        (window as any).__chartStateCheck = stateCheckInterval;
    }

    function startChartCollection(): void {
        if (!pollInterval) {
            startPolling();
        }
    }

    function stopChartCollection(): void {
        if (pollInterval) {
            stopPolling();
        }
    }

    function refresh(): void {
        fetchFarmerStats();
    }

    // For backwards compatibility, compute these when needed
    const cumulativeProofsFound = computed(() => getProofsFoundInTimeframe(24));
    const cumulativePartialsFound = computed(() => getPartialsFoundInTimeframe(24));

    return {
        // State
        currentActivity,
        historyData,
        isLoading,
        lastError,
        lastFetchTime,
        chartUpdateId,

        // Computed
        activity,
        cumulativeProofsFound,
        cumulativePartialsFound,

        // Actions
        fetchFarmerStats,
        startPolling,
        stopPolling,
        startChartCollection,
        stopChartCollection,
        initializeData,
        refresh,

        // Data analysis
        getHistoryForTimeframe,
        getProofsFoundInTimeframe,
        getPartialsFoundInTimeframe,
        getCurrentProcessedPlots,

        // Chart functions
        getChartData,
        getChartSeries,
        getChartOptions,

        // Reset functions
        resetActivity,
        clearHistory,

        // Fast polling controls
        enableNormalPolling,
        currentPollInterval: computed(() => currentPollInterval.value),
        lastActivityTime: computed(() => lastActivityTime.value),
        consecutiveEmptyPolls: computed(() => consecutiveEmptyPolls.value)
    };
});