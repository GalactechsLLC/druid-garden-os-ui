import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {type FarmerActivity, type FarmerActivityRecord, MAX_HISTORY_POINTS} from "@/types/farmer";
import {getFarmerStats} from '@/services/farmer';
import {deepCopy} from "deep-copy-ts";
import {useFarmerStore} from "@/stores/farmerStore.ts";

// Updated type for the API response format (array of objects)
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

// API returns an array of FarmerStatsResponseItem
type FarmerStatsResponse = FarmerStatsResponseItem[];

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

    // Computed properties
    const activity = computed(() => currentActivity.value);

    // Polling management
    let pollInterval: number | null = null;

    const POLLING_INTERVALS = {
        FAST: 1000,          // 1 second for real-time updates during farming
        NORMAL: 5000,        // 5 seconds for normal monitoring
        SLOW: 10000,         // 10 seconds when idle
        STOPPED: 30000       // 30 seconds when farmer is stopped
    };

// Add these new state variables after the existing ref declarations
    const currentPollInterval = ref(POLLING_INTERVALS.NORMAL);
    const lastActivityTime = ref<Date | null>(null);
    const consecutiveEmptyPolls = ref(0);

    const isFetching = ref(false);
    const pendingFetchPromise = ref<Promise<void> | null>(null);
    const fetchQueue = ref<number>(0);
    const lastSuccessfulFetch = ref<Date | null>(null);

    const REQUEST_TIMEOUT = 10000; // 10 seconds
    const MAX_RETRIES = 3;
    let currentRetryCount = 0;

    // Helper functions
    function convertApiTimestamp(gathered: string): Date {
        try {
            const cleanTimestamp = gathered.replace(' +00:00:00', 'Z');
            const date = new Date(cleanTimestamp);

            if (isNaN(date.getTime())) {
                console.warn('Invalid timestamp, using current time:', gathered);
                return new Date();
            }

            return date;
        } catch (error) {
            console.error('Error converting API timestamp:', error, gathered);
            return new Date();
        }
    }

    function convertApiResponseToActivity(apiData: FarmerStatsResponseItem): FarmerActivity {
        const activity = {
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

        console.log('🔍 DEBUG: convertApiResponseToActivity input:', {
            og_passed_filter: apiData.og_passed_filter,
            og_plot_count: apiData.og_plot_count,
            nft_passed_filter: apiData.nft_passed_filter,
            nft_plot_count: apiData.nft_plot_count,
            compressed_passed_filter: apiData.compressed_passed_filter,
            compressed_plot_count: apiData.compressed_plot_count,
            proofs_found: apiData.proofs_found
        });

        console.log('🔍 DEBUG: convertApiResponseToActivity output:', activity);

        return activity;
    }

    function isDuplicateEntry(newChallengeHash: string, newSpHash: string): boolean {
        return historyData.value.farmer_records.some(record => {
            // Check if we have metadata to compare hashes
            return record.metadata &&
                record.metadata.challenge_hash === newChallengeHash &&
                record.metadata.sp_hash === newSpHash;
        });
    }

    async function fetchFarmerStats(): Promise<void> {
        // Prevent multiple concurrent requests
        if (isFetching.value) {
            console.log('📊 Fetch already in progress, skipping...');
            fetchQueue.value++;

            // If there's a pending promise, wait for it instead of creating a new one
            if (pendingFetchPromise.value) {
                try {
                    await pendingFetchPromise.value;
                } catch (error) {
                    // Ignore errors from pending promise
                }
            }
            return;
        }

        // Set fetching flag and create promise
        isFetching.value = true;
        fetchQueue.value = 0;

        const fetchPromise = performFetch();
        pendingFetchPromise.value = fetchPromise;

        try {
            await fetchPromise;
        } finally {
            isFetching.value = false;
            pendingFetchPromise.value = null;

            // If requests were queued while we were fetching, handle them
            if (fetchQueue.value > 0) {
                console.log(`📊 Processing ${fetchQueue.value} queued requests`);
                // Delay slightly to prevent immediate spam
                setTimeout(() => {
                    if (!isFetching.value) {
                        fetchFarmerStats();
                    }
                }, 100);
            }
        }
    }

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
                currentRetryCount = 0; // Reset retry count on success
            } catch (fetchError) {
                clearTimeout(timeoutId);

                // Handle retry logic for failed requests
                if (currentRetryCount < MAX_RETRIES) {
                    currentRetryCount++;
                    console.log(`📊 Fetch failed, retrying (${currentRetryCount}/${MAX_RETRIES})...`);

                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, currentRetryCount - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    return performFetch(); // Recursive retry
                }

                throw fetchError; // Re-throw after max retries
            }

            if (!data || !Array.isArray(data) || data.length === 0) {
                consecutiveEmptyPolls.value++;
                console.log(`📊 No farmer stats data available (${consecutiveEmptyPolls.value} consecutive empty polls)`);

                // Slow down polling if we keep getting empty results
                if (consecutiveEmptyPolls.value > 3 && currentPollInterval.value < POLLING_INTERVALS.SLOW) {
                    console.log('📊 Multiple empty polls detected, slowing down polling');
                    startPolling(POLLING_INTERVALS.SLOW);
                }
                return;
            }

            console.log('🔍 DEBUG: Raw API response (array):', data);
            console.log('🔍 DEBUG: Processing', data.length, 'entries');

            let newEntriesAdded = 0;
            let latestEntry: FarmerStatsResponseItem | null = null;
            let latestTimestamp: Date | null = null;
            let hasNewActivity = false;

            // Process each entry in the array
            data.forEach((apiData, index) => {
                try {
                    const timestamp = convertApiTimestamp(apiData.gathered);

                    const isDuplicate = isDuplicateEntry(apiData.challenge_hash, apiData.sp_hash);

                    if (!isDuplicate) {
                        const activity = convertApiResponseToActivity(apiData);

                        // Check if this entry has actual farming activity
                        const hasActivity = activity.passedFilter.og.processed > 0 ||
                            activity.passedFilter.nft.processed > 0 ||
                            activity.passedFilter.compressed.processed > 0 ||
                            activity.proofsFound > 0;

                        if (hasActivity) {
                            hasNewActivity = true;
                            lastActivityTime.value = timestamp;
                            console.log('⚡ New farming activity detected!', {
                                og: activity.passedFilter.og.processed,
                                nft: activity.passedFilter.nft.processed,
                                compressed: activity.passedFilter.compressed.processed,
                                proofs: activity.proofsFound
                            });
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

                        console.log('📊 Added new record:', {
                            timestamp: timestamp.toISOString(),
                            challenge_hash: apiData.challenge_hash.substring(0, 10) + '...',
                            sp_hash: apiData.sp_hash.substring(0, 10) + '...',
                            og_processed: activity.passedFilter.og.processed,
                            nft_processed: activity.passedFilter.nft.processed,
                            compressed_processed: activity.passedFilter.compressed.processed,
                            proofs_found: activity.proofsFound
                        });

                        // Track the most recent entry by timestamp
                        if (!latestTimestamp || timestamp > latestTimestamp) {
                            latestEntry = apiData;
                            latestTimestamp = timestamp;
                        }
                    } else {
                        console.log('📊 Skipping duplicate entry:', {
                            timestamp: timestamp.toISOString(),
                            challenge_hash: apiData.challenge_hash.substring(0, 10) + '...',
                            sp_hash: apiData.sp_hash.substring(0, 10) + '...'
                        });
                    }
                } catch (entryError) {
                    console.error('Error processing farmer stats entry:', entryError);
                }
            });

            // Reset consecutive empty polls counter if we got data
            if (newEntriesAdded > 0) {
                consecutiveEmptyPolls.value = 0;
                lastSuccessfulFetch.value = new Date();
            }

            // Adjust polling speed based on activity
            if (hasNewActivity && currentPollInterval.value > POLLING_INTERVALS.FAST) {
                console.log('⚡ Switching to fast polling due to new activity');
                startPolling(POLLING_INTERVALS.FAST);
            } else if (!hasNewActivity && newEntriesAdded === 0) {
                consecutiveEmptyPolls.value++;
            }

            // Only update if we added new entries
            if (newEntriesAdded > 0) {
                // Sort records by timestamp
                historyData.value.farmer_records.sort((a, b) =>
                    a.timestamp.getTime() - b.timestamp.getTime()
                );

                // Update current activity with the most recent entry
                if (latestEntry) {
                    currentActivity.value = convertApiResponseToActivity(latestEntry);
                    console.log('🔄 Updated current activity:', currentActivity.value);
                }

                // Limit history size
                if (historyData.value.farmer_records.length > MAX_HISTORY_POINTS) {
                    const toRemove = historyData.value.farmer_records.length - MAX_HISTORY_POINTS;
                    historyData.value.farmer_records.splice(0, toRemove);
                }

                // Trigger chart update
                chartUpdateId.value++;

                console.log(`✅ Added ${newEntriesAdded} new entries, total: ${historyData.value.farmer_records.length}`);
            } else {
                console.log('📊 No new entries to add (all were duplicates)');
            }

            lastFetchTime.value = new Date();

        } catch (error) {
            consecutiveEmptyPolls.value++;
            console.error('📊 Fetch error after retries:', error);

            // Don't log errors when farmer is not running - this is expected
            if (error instanceof Error && !error.message.includes('farmer/stats')) {
                lastError.value = error.message;
            }
        } finally {
            isLoading.value = false;
        }
    }

    function debugChartData(timeframeHours: number) {
        console.log(`🔍 DEBUG: Getting chart data for ${timeframeHours}h timeframe`);

        const records = getHistoryForTimeframe(timeframeHours);
        console.log(`🔍 DEBUG: Records in timeframe:`, records.length);

        if (records.length > 0) {
            console.log(`🔍 DEBUG: First record in timeframe:`, records[0]);
            console.log(`🔍 DEBUG: Last record in timeframe:`, records[records.length - 1]);

            records.forEach((record, index) => {
                if (record.activity.passedFilter.og.processed > 0 ||
                    record.activity.passedFilter.nft.processed > 0 ||
                    record.activity.passedFilter.compressed.processed > 0) {
                    console.log(`🔍 DEBUG: Record ${index} has activity:`, {
                        timestamp: record.timestamp,
                        og_processed: record.activity.passedFilter.og.processed,
                        nft_processed: record.activity.passedFilter.nft.processed,
                        compressed_processed: record.activity.passedFilter.compressed.processed
                    });
                }
            });
        }

        return records;
    }

    // Polling management
    function startPolling(intervalMs?: number): void {
        // Don't start multiple intervals
        if (pollInterval) {
            stopPolling();
        }

        // Use provided interval or determine smart interval
        const interval = intervalMs || getSmartPollInterval();
        currentPollInterval.value = interval;

        console.log(`🔄 Starting farmer stats polling every ${interval}ms`);

        // Initial fetch
        fetchFarmerStats();

        // Set up interval
        pollInterval = setInterval(() => {
            fetchFarmerStats();
        }, interval);
    }

// Add this new function for smart polling
    function getSmartPollInterval(): number {
        const farmerStore = useFarmerStore();

        // If farmer is not running, poll slowly
        if (!farmerStore.isRunning) {
            return POLLING_INTERVALS.STOPPED;
        }

        // If we recently had activity, poll fast
        if (lastActivityTime.value) {
            const timeSinceActivity = Date.now() - lastActivityTime.value.getTime();
            if (timeSinceActivity < 30000) { // 30 seconds
                return POLLING_INTERVALS.FAST;
            }
        }

        // If we've had several empty polls in a row, slow down
        if (consecutiveEmptyPolls.value > 5) {
            return POLLING_INTERVALS.SLOW;
        }

        // Default to normal speed
        return POLLING_INTERVALS.NORMAL;
    }

// Add these new control functions
    function enableFastPolling(): void {
        console.log('⚡ Enabling fast polling (1 second intervals)');
        startPolling(POLLING_INTERVALS.FAST);
    }

    function enableNormalPolling(): void {
        console.log('📊 Enabling normal polling (5 second intervals)');
        startPolling(POLLING_INTERVALS.NORMAL);
    }

    function stopPolling(): void {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }

        // Wait for any in-flight requests to complete
        if (isFetching.value && pendingFetchPromise.value) {
            console.log('📊 Waiting for in-flight request to complete...');
            pendingFetchPromise.value.finally(() => {
                console.log('📊 In-flight request completed, polling stopped');
            });
        }

        // Reset state
        fetchQueue.value = 0;
        currentRetryCount = 0;
    }

    // Data analysis functions
    function getHistoryForTimeframe(hours: number): FarmerActivityRecord[] {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hours);

            return historyData.value.farmer_records.filter(record =>
                record.timestamp >= cutoffTime
            );
        } catch (error) {
            console.error('Error getting history for timeframe:', error);
            return [];
        }
    }

    function getChartData(timeframeHours: number) {
        try {
            console.log(`🔍 DEBUG: getChartData called for ${timeframeHours}h`);

            const records = getHistoryForTimeframe(timeframeHours);
            console.log(`🔍 DEBUG: Found ${records.length} records in timeframe`);

            if (!records || records.length === 0) {
                console.log('🔍 DEBUG: No records found, returning empty data');
                return {
                    timestamps: [],
                    ogPassedFilter: [],
                    nftPassedFilter: [],
                    compressedPassedFilter: [],
                    updateId: chartUpdateId.value
                };
            }

            const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            // For farming data, we want to show individual events rather than aggregating
            // This gives a more accurate view of farming activity
            const chartData = {
                timestamps: sortedRecords.map(record => record.timestamp),
                ogPassedFilter: sortedRecords.map(record => record.activity.passedFilter.og.processed),
                nftPassedFilter: sortedRecords.map(record => record.activity.passedFilter.nft.processed),
                compressedPassedFilter: sortedRecords.map(record => record.activity.passedFilter.compressed.processed),
                updateId: chartUpdateId.value
            };

            console.log('🔍 DEBUG: Final chart data:', {
                dataPoints: chartData.timestamps.length,
                totalOG: chartData.ogPassedFilter.reduce((sum, val) => sum + val, 0),
                totalNFT: chartData.nftPassedFilter.reduce((sum, val) => sum + val, 0),
                totalCompressed: chartData.compressedPassedFilter.reduce((sum, val) => sum + val, 0),
                nonZeroOG: chartData.ogPassedFilter.filter(val => val > 0).length,
                nonZeroNFT: chartData.nftPassedFilter.filter(val => val > 0).length,
                nonZeroCompressed: chartData.compressedPassedFilter.filter(val => val > 0).length
            });

            return chartData;
        } catch (error) {
            console.error('❌ Error generating chart data:', error);
            return {
                timestamps: [],
                ogPassedFilter: [],
                nftPassedFilter: [],
                compressedPassedFilter: [],
                updateId: chartUpdateId.value
            };
        }
    }

    // Separate functions for different metrics
    function getProofsFoundInTimeframe(hours: number): number {
        const records = getHistoryForTimeframe(hours);
        if (records.length === 0) return 0;

        // Sum all proofs found in the timeframe
        return records.reduce((total, record) => total + record.activity.proofsFound, 0);
    }

    function getPartialsFoundInTimeframe(hours: number): { nft: number, compressed: number } {
        const records = getHistoryForTimeframe(hours);
        if (records.length === 0) return { nft: 0, compressed: 0 };

        // Sum all partials found in the timeframe
        return records.reduce((totals, record) => ({
            nft: totals.nft + record.activity.partialsFound.nft,
            compressed: totals.compressed + record.activity.partialsFound.compressed
        }), { nft: 0, compressed: 0 });
    }

    function getCurrentProcessedPlots() {
        // Return the most recent plot counts (current activity)
        return currentActivity.value.passedFilter;
    }

    function getChartSeries(timeframeHours: number) {
        try {
            console.log(`🔍 DEBUG: getChartSeries called for ${timeframeHours}h`);

            const chartData = getChartData(timeframeHours);
            console.log('🔍 DEBUG: Chart data for series:', chartData);

            if (!chartData.timestamps.length) {
                console.log('🔍 DEBUG: No timestamps in chart data, returning empty series');
                return [];
            }

            const { timestamps, ogPassedFilter, nftPassedFilter, compressedPassedFilter } = chartData;

            // Create series with explicit names and proper data structure
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

            // Filter out series with no data to avoid empty charts
            const seriesWithData = series.filter(s => s.data.some(point => point.y > 0));

            console.log('🔍 DEBUG: Generated series with data:', seriesWithData.map(s => ({
                name: s.name,
                dataPoints: s.data.length,
                nonZeroPoints: s.data.filter(p => p.y > 0).length,
                totalValue: s.data.reduce((sum, p) => sum + p.y, 0)
            })));

            // If no series have data, return all series so the chart structure is maintained
            if (seriesWithData.length === 0) {
                console.log('🔍 DEBUG: No series with data, returning all series for structure');
                return series;
            }

            return seriesWithData;
        } catch (error) {
            console.error('❌ Error generating chart series:', error);
            return [];
        }
    }

    function getChartOptions(timeframeHours: number) {
        // Determine the appropriate time format based on timeframe
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

    // Reset and cleanup functions
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

    // Lifecycle management
    function initializeData(): void {
        console.log('🚀 Chart store initializing...');

        // Reset state
        resetActivity();

        // Get farmer store and check current state
        const farmerStore = useFarmerStore();

        // Start polling immediately if farmer is running
        if (farmerStore.isRunning) {
            console.log('✅ Farmer is running - starting polling immediately');
            startPolling();
        } else {
            console.log('❌ Farmer not running - will start polling when farmer starts');
        }

        // Watch farmer state changes more aggressively
        const stateCheckInterval = setInterval(() => {
            const isRunning = farmerStore.isRunning;

            // If farmer is running and we're not polling, start
            if (isRunning && !pollInterval) {
                console.log('✅ Farmer detected as running - starting polling');
                startPolling();
            }
            // If farmer is stopped and we're polling, stop
            else if (!isRunning && pollInterval) {
                console.log('❌ Farmer detected as stopped - stopping polling');
                stopPolling();
            }
        }, 2000); // Check every 2 seconds for faster response

        // Store the interval so we can clean it up
        (window as any).__chartStateCheck = stateCheckInterval;
    }

    // Simple function to start chart data collection
    function startChartCollection(): void {
        console.log('📊 Starting chart data collection');
        if (!pollInterval) {
            startPolling();
        }
    }

    // Simple function to stop chart data collection
    function stopChartCollection(): void {
        console.log('📊 Stopping chart data collection');
        if (pollInterval) {
            stopPolling();
        }
    }

    function refresh(): void {
        fetchFarmerStats();
    }

    // For backwards compatibility, compute these when needed
    const cumulativeProofsFound = computed(() => getProofsFoundInTimeframe(24)); // Last 24h
    const cumulativePartialsFound = computed(() => getPartialsFoundInTimeframe(24)); // Last 24h

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

        // Debug functions
        debugChartData,

        // NEW: Fast polling controls
        enableFastPolling,
        enableNormalPolling,
        currentPollInterval: computed(() => currentPollInterval.value),
        lastActivityTime: computed(() => lastActivityTime.value),
        consecutiveEmptyPolls: computed(() => consecutiveEmptyPolls.value)
    };
});