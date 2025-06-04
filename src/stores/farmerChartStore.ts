import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
    type FarmerActivity,
    type FarmerActivityRecord,
    MAX_HISTORY_POINTS
} from "@/types/farmer";
import { getFarmerStats, getFarmerStatsRange } from '@/services/farmer';
import { deepCopy } from "deep-copy-ts";
import {useFarmerStore} from "@/stores/farmerStore.ts";

// Updated type for the new API response format (object with numeric keys)
interface FarmerStatsResponseItem {
    challenge_hash: string;
    sp_hash: string;
    running: boolean;
    og_passed_filter: number;
    og_plot_count: number;
    nft_passed_filter: number;
    nft_plot_count: number;
    compressed_passed_filter: number;
    compresses_plot_count: number;
    invalid_plot_count: number;
    proofs_found: number;
    total_plot_space: number;
    full_node_height: number;
    full_node_difficulty: number;
    full_node_synced: boolean;
    gathered: string;
}

// API now returns an object with numeric keys instead of an array
type FarmerStatsResponse = Record<string, FarmerStatsResponseItem>;

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
    const lastHistoryLength = ref(0);

    // Computed properties
    const activity = computed(() => currentActivity.value);

    // Polling management
    let pollInterval: number | null = null;
    const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

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
                    total: apiData.compresses_plot_count || 0
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
            compresses_plot_count: apiData.compresses_plot_count,
            proofs_found: apiData.proofs_found
        });

        console.log('🔍 DEBUG: convertApiResponseToActivity output:', activity);

        return activity;
    }

    function isDuplicateEntry(newTimestamp: Date, newChallengeHash: string): boolean {
        return historyData.value.farmer_records.some(record => {
            const timeDiff = Math.abs(record.timestamp.getTime() - newTimestamp.getTime());
            return timeDiff < 1000; // 1 second tolerance for duplicates
        });
    }

    async function fetchFarmerStats(): Promise<void> {
        try {
            isLoading.value = true;
            lastError.value = null;

            const data: FarmerStatsResponse = await getFarmerStats();

            if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
                // This is normal when farmer is not running
                return;
            }

            console.log('🔍 DEBUG: Raw API response:', data);

            let newEntriesAdded = 0;
            let latestEntry: FarmerStatsResponseItem | null = null;
            let latestTimestamp: Date | null = null;

            // Convert object to array and process entries
            const entries = Object.entries(data).map(([key, value]) => ({
                index: parseInt(key),
                data: value
            }));

            // Sort by index to process in order
            entries.sort((a, b) => a.index - b.index);

            console.log('🔍 DEBUG: Processing entries:', entries.length);

            entries.forEach(({ index, data: apiData }) => {
                try {
                    const timestamp = convertApiTimestamp(apiData.gathered);

                    // Check for duplicates using challenge hash and timestamp
                    const isDuplicate = isDuplicateEntry(timestamp, apiData.challenge_hash);

                    if (!isDuplicate) {
                        const activity = convertApiResponseToActivity(apiData);

                        const activityRecord: FarmerActivityRecord = {
                            timestamp,
                            activity: deepCopy(activity)
                        };

                        historyData.value.farmer_records.push(activityRecord);
                        newEntriesAdded++;

                        console.log('📊 Added new record:', {
                            timestamp: timestamp.toISOString(),
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
                    }
                } catch (entryError) {
                    console.error('Error processing farmer stats entry:', entryError);
                }
            });

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
                console.log('📊 No new entries to add');
            }

            lastFetchTime.value = new Date();

        } catch (error) {
            // Don't log errors when farmer is not running - this is expected
            if (error instanceof Error && !error.message.includes('farmer/stats')) {
                console.error('Error fetching farmer stats:', error);
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
    function startPolling(intervalMs: number = DEFAULT_POLL_INTERVAL): void {
        // Don't start multiple intervals
        if (pollInterval) {
            return;
        }

        console.log(`🔄 Starting farmer stats polling every ${intervalMs}ms`);

        // Initial fetch (will fail silently if farmer not running)
        fetchFarmerStats();

        // Set up interval
        pollInterval = setInterval(() => {
            fetchFarmerStats();
        }, intervalMs);
    }

    function stopPolling(): void {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
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

            // Determine aggregation interval based on timeframe
            let intervalMs = 60000; // 1 minute default
            if (timeframeHours <= 1) {
                intervalMs = 30000; // 30 seconds for 1 hour view
            } else if (timeframeHours <= 6) {
                intervalMs = 300000; // 5 minutes for 6 hour view
            } else if (timeframeHours <= 24) {
                intervalMs = 900000; // 15 minutes for 24 hour view
            } else {
                intervalMs = 3600000; // 1 hour for longer views
            }

            console.log(`🔍 DEBUG: Using ${intervalMs}ms intervals for aggregation`);

            // Group records into time buckets and sum the activity
            const buckets = new Map<number, {
                timestamp: Date,
                og: number,
                nft: number,
                compressed: number,
                count: number
            }>();

            sortedRecords.forEach(record => {
                const bucketTime = Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;

                if (!buckets.has(bucketTime)) {
                    buckets.set(bucketTime, {
                        timestamp: new Date(bucketTime),
                        og: 0,
                        nft: 0,
                        compressed: 0,
                        count: 0
                    });
                }

                const bucket = buckets.get(bucketTime)!;
                bucket.og += record.activity.passedFilter.og.processed;
                bucket.nft += record.activity.passedFilter.nft.processed;
                bucket.compressed += record.activity.passedFilter.compressed.processed;
                bucket.count += 1;
            });

            // Convert buckets to arrays sorted by time
            const sortedBuckets = Array.from(buckets.values())
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            console.log('🔍 DEBUG: Aggregated buckets:', sortedBuckets.map(b => ({
                timestamp: b.timestamp.toISOString(),
                og: b.og,
                nft: b.nft,
                compressed: b.compressed,
                events: b.count
            })));

            const chartData = {
                timestamps: sortedBuckets.map(bucket => bucket.timestamp),
                ogPassedFilter: sortedBuckets.map(bucket => bucket.og),
                nftPassedFilter: sortedBuckets.map(bucket => bucket.nft),
                compressedPassedFilter: sortedBuckets.map(bucket => bucket.compressed),
                updateId: chartUpdateId.value
            };

            console.log('🔍 DEBUG: Final aggregated chart data:', {
                dataPoints: chartData.timestamps.length,
                totalOG: chartData.ogPassedFilter.reduce((sum, val) => sum + val, 0),
                totalNFT: chartData.nftPassedFilter.reduce((sum, val) => sum + val, 0),
                totalCompressed: chartData.compressedPassedFilter.reduce((sum, val) => sum + val, 0)
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
        let titleText = 'Plots Passed Filter (Aggregated)';

        if (timeframeHours <= 1) {
            timeFormat = 'HH:mm:ss';
            titleText = 'Plots Passed Filter (30-second intervals)';
        } else if (timeframeHours <= 6) {
            timeFormat = 'HH:mm';
            titleText = 'Plots Passed Filter (5-minute intervals)';
        } else if (timeframeHours <= 24) {
            timeFormat = 'HH:mm';
            titleText = 'Plots Passed Filter (15-minute intervals)';
        } else {
            timeFormat = 'MMM dd HH:mm';
            titleText = 'Plots Passed Filter (1-hour intervals)';
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
                    columnWidth: '70%',
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
        debugChartData
    };
});