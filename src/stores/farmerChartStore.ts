import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
    type FarmerActivity,
    type FarmerActivityRecord,
    MAX_HISTORY_POINTS
} from "@/types/farmer";

import { deepCopy } from "deep-copy-ts";

// Type for the API response
interface FarmerStatsResponse {
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
    gathered: [number, number, number, number, number, number, number, number, number];
}

export const useFarmerChartStore = defineStore('farmerChart', () => {
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

    const historyData = ref({
        farmer_records: [] as FarmerActivityRecord[]
    });

    // Track cumulative totals
    const totalProofsFound = ref(0);
    const totalPartialsFound = ref({
        nft: 0,
        compressed: 0
    });

    // Loading and error states
    const isLoading = ref(false);
    const lastError = ref<string | null>(null);
    const apiBaseUrl = ref('http://localhost:8080'); // Configurable base URL

    const activity = computed(() => currentActivity.value);
    const cumulativeProofsFound = computed(() => totalProofsFound.value);
    const cumulativePartialsFound = computed(() => totalPartialsFound.value);

    // Convert API timestamp array to Date
    function convertApiTimestamp(gathered: [number, number, number, number, number, number, number, number, number]): Date {
        try {
            const [year, dayOfYear, hour, minute, second] = gathered;

            // Create a new date for January 1st of the year
            const date = new Date(year, 0);

            // Adjust for day of year (subtract 1 because dayOfYear is 1-indexed)
            date.setDate(dayOfYear);

            // Set the time
            date.setHours(hour, minute, second);

            return date;
        } catch (error) {
            console.error('Error converting API timestamp:', error, gathered);
            return new Date();
        }
    }

    function convertApiResponseToActivity(apiResponse: FarmerStatsResponse): FarmerActivity {
        return {
            passedFilter: {
                og: {
                    processed: apiResponse.og_passed_filter,
                    total: apiResponse.og_plot_count
                },
                nft: {
                    processed: apiResponse.nft_passed_filter,
                    total: apiResponse.nft_plot_count
                },
                compressed: {
                    processed: apiResponse.compressed_passed_filter,
                    total: apiResponse.compresses_plot_count
                }
            },
            proofsFound: apiResponse.proofs_found,
            partialsFound: {
                nft: 0,
                compressed: 0
            }
        };
    }

    async function fetchFarmerStats(): Promise<void> {
        try {
            isLoading.value = true;
            lastError.value = null;

            const response = await fetch(`${apiBaseUrl.value}/farmer/stats`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: FarmerStatsResponse[] = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No farmer stats data received');
                return;
            }

            data.forEach(apiResponse => {
                const timestamp = convertApiTimestamp(apiResponse.gathered);
                const activity = convertApiResponseToActivity(apiResponse);

                const isDuplicate = historyData.value.farmer_records.some(record => {
                    const timeDiff = Math.abs(record.timestamp.getTime() - timestamp.getTime());
                    return timeDiff < 2000;
                });

                if (!isDuplicate) {
                    const activityRecord: FarmerActivityRecord = {
                        timestamp,
                        activity: deepCopy(activity)
                    };

                    historyData.value.farmer_records.push(activityRecord);

                    currentActivity.value = deepCopy(activity);
                }
            });

            historyData.value.farmer_records.sort((a, b) =>
                a.timestamp.getTime() - b.timestamp.getTime()
            );

            updateCumulativeTotals();

            if (historyData.value.farmer_records.length > MAX_HISTORY_POINTS) {
                historyData.value.farmer_records = historyData.value.farmer_records.slice(
                    historyData.value.farmer_records.length - MAX_HISTORY_POINTS
                );
            }

        } catch (error) {
            console.error('Error fetching farmer stats:', error);
            lastError.value = error instanceof Error ? error.message : 'Unknown error occurred';
        } finally {
            isLoading.value = false;
        }
    }

    let pollInterval: number | null = null;

    function startPolling(intervalMs: number = 10000): void {
        stopPolling();

        // Initial fetch
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

    function updateCumulativeTotals(): void {
        if (historyData.value.farmer_records.length === 0) {
            return;
        }

        let maxProofs = 0;
        let maxNftPartials = 0;
        let maxCompressedPartials = 0;

        historyData.value.farmer_records.forEach(record => {
            if (record.activity.proofsFound > maxProofs) {
                maxProofs = record.activity.proofsFound;
            }
            if (record.activity.partialsFound.nft > maxNftPartials) {
                maxNftPartials = record.activity.partialsFound.nft;
            }
            if (record.activity.partialsFound.compressed > maxCompressedPartials) {
                maxCompressedPartials = record.activity.partialsFound.compressed;
            }
        });

        totalProofsFound.value = maxProofs;
        totalPartialsFound.value.nft = maxNftPartials;
        totalPartialsFound.value.compressed = maxCompressedPartials;
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
        totalProofsFound.value = 0;
        totalPartialsFound.value.nft = 0;
        totalPartialsFound.value.compressed = 0;
    }

    function setApiBaseUrl(url: string): void {
        apiBaseUrl.value = url;
    }

    function getChartData(timeframeHours: number) {
        try {
            const records = getHistoryForTimeframe(timeframeHours);

            if (!records || records.length === 0) {
                return {
                    timestamps: [],
                    data: []
                };
            }

            const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            return {
                timestamps: sortedRecords.map(record => record.timestamp),
                formattedTimestamps: sortedRecords.map(record => {
                    const date = record.timestamp;
                    return new Intl.DateTimeFormat('default', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        ...(timeframeHours > 24 ? { month: 'short', day: 'numeric' } : {})
                    }).format(date);
                }),
                ogProcessed: sortedRecords.map(record => record.activity.passedFilter.og.processed),
                ogTotal: sortedRecords.map(record => record.activity.passedFilter.og.total),
                nftProcessed: sortedRecords.map(record => record.activity.passedFilter.nft.processed),
                nftTotal: sortedRecords.map(record => record.activity.passedFilter.nft.total),
                compressedProcessed: sortedRecords.map(record => record.activity.passedFilter.compressed.processed),
                compressedTotal: sortedRecords.map(record => record.activity.passedFilter.compressed.total),
                proofsFound: sortedRecords.map(record => record.activity.proofsFound),
                nftPartials: sortedRecords.map(record => record.activity.partialsFound.nft),
                compressedPartials: sortedRecords.map(record => record.activity.partialsFound.compressed)
            };
        } catch (error) {
            console.error('Error generating chart data:', error);
            return {
                timestamps: [],
                formattedTimestamps: [],
                ogProcessed: [],
                ogTotal: [],
                nftProcessed: [],
                nftTotal: [],
                compressedProcessed: [],
                compressedTotal: [],
                proofsFound: [],
                nftPartials: [],
                compressedPartials: []
            };
        }
    }

    function getChartSeries(timeframeHours: number) {
        try {
            const chartData = getChartData(timeframeHours);

            if (!chartData.timestamps.length) {
                return [];
            }

            const formattedTimestamps = chartData.formattedTimestamps || [];
            const ogProcessed = chartData.ogProcessed || [];
            const nftProcessed = chartData.nftProcessed || [];
            const compressedProcessed = chartData.compressedProcessed || [];
            const proofsFound = chartData.proofsFound || [];
            const nftPartials = chartData.nftPartials || [];
            const compressedPartials = chartData.compressedPartials || [];

            const processedProofs = [...proofsFound];
            const processedNFTPartials = [...nftPartials];
            const processedCompressedPartials = [...compressedPartials];

            for (let i = 1; i < processedProofs.length; i++) {
                processedProofs[i] = Math.max(processedProofs[i], processedProofs[i-1]);
            }

            for (let i = 1; i < processedNFTPartials.length; i++) {
                processedNFTPartials[i] = Math.max(processedNFTPartials[i], processedNFTPartials[i-1]);
            }

            for (let i = 1; i < processedCompressedPartials.length; i++) {
                processedCompressedPartials[i] = Math.max(processedCompressedPartials[i], processedCompressedPartials[i-1]);
            }

            return [
                {
                    name: 'OG Passed Filter',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: ogProcessed[index] || 0
                    })),
                    type: 'bar',
                    color: '#4CAF50'  // Green
                },
                {
                    name: 'NFT Passed Filter',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: nftProcessed[index] || 0
                    })),
                    type: 'bar',
                    color: '#FF9800'  // Orange
                },
                {
                    name: 'Compressed Passed Filter',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: compressedProcessed[index] || 0
                    })),
                    type: 'bar',
                    color: '#9C27B0'  // Purple
                },
                {
                    name: 'Proofs Found',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: processedProofs[index] || 0
                    })),
                    type: 'bar',
                    color: '#F44336'  // Red
                },
                {
                    name: 'NFT Partials',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: processedNFTPartials[index] || 0
                    })),
                    type: 'bar',
                    color: '#795548'  // Brown
                },
                {
                    name: 'Compressed Partials',
                    data: formattedTimestamps.map((time, index) => ({
                        x: time,
                        y: processedCompressedPartials[index] || 0
                    })),
                    type: 'bar',
                    color: '#607D8B'  // Blue-grey
                }
            ];
        } catch (error) {
            console.error('Error generating chart series:', error);
            return [];
        }
    }

    function getChartOptions(timeframeHours: number) {
        const chartData = getChartData(timeframeHours);

        return {
            chart: {
                type: 'bar',
                animations: {
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: {
                        speed: 500
                    }
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                stacked: true
            },
            colors: ['#4CAF50', '#1976D2', '#FF9800', '#9C27B0', '#F44336', '#795548', '#607D8B'],
            dataLabels: {
                enabled: false
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '80%',
                    endingShape: 'flat'
                },
            },
            xaxis: {
                type: 'category',
                categories: chartData.formattedTimestamps,
                labels: {
                    rotate: -45,
                    rotateAlways: false,
                    hideOverlappingLabels: true
                }
            },
            yaxis: {
                title: {
                    text: 'Plots/Proofs/Partials'
                },
                min: 0,
                forceNiceScale: true,
                decimalsInFloat: 0,
                labels: {
                    formatter: function(value: any) {
                        return Math.floor(value);
                    }
                }
            },
            legend: {
                position: 'top'
            },
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: function (y: any) {
                        if (typeof y !== 'undefined') {
                            return y.toFixed(0);
                        }
                        return y;
                    }
                }
            }
        };
    }

    function initializeData() {
        resetActivity();
        startPolling();
    }

    function cleanup() {
        stopPolling();
    }

    return {
        currentActivity,
        historyData,
        totalProofsFound,
        totalPartialsFound,
        isLoading,
        lastError,
        apiBaseUrl,
        activity,
        cumulativeProofsFound,
        cumulativePartialsFound,
        fetchFarmerStats,
        startPolling,
        stopPolling,
        setApiBaseUrl,
        initializeData,
        cleanup,
        getHistoryForTimeframe,
        resetActivity,
        clearHistory,
        updateCumulativeTotals,
        getChartData,
        getChartSeries,
        getChartOptions
    };
});