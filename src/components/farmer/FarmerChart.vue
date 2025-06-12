<template>
  <div>
    <!-- Timeframe selector -->
    <div class="q-mb-md">
      <q-btn-group flat>
        <q-btn
            v-for="option in timeframeOptions"
            :key="option.value"
            :label="option.label"
            :color="selectedTimeframe === option.value ? 'primary' : 'grey-4'"
            :text-color="selectedTimeframe === option.value ? 'white' : 'grey-8'"
            @click="selectedTimeframe = option.value"
            :unelevated="selectedTimeframe !== option.value"
            :outline="selectedTimeframe !== option.value"
            class="q-px-md"
        />
      </q-btn-group>
    </div>

    <!-- Chart Component -->
    <Chart
        :chart-data="chartData"
        :title="'Plots Passed Filter'"
        :subtitle="`Last ${timeframeLabel} • ${dataPointsInTimeframe} Signage Point` + (dataPointsInTimeframe === 1 ? `` : 's')"
        :y-axis-label="'Plots'"
        :legend-items="legendItems"
        :data-keys="dataKeys"
        :show-live-indicator="true"
        :is-live="farmerStore.isRunning"
        :empty-state-icon="'agriculture'"
        :empty-state-text="`No farming activity in ${timeframeLabel}`"
        :empty-state-subtext="'Data will appear as plots pass the filter'"
    />

    <!-- Statistics Cards -->
    <div class="row q-col-gutter-md">
      <!-- Current Plot Status -->
      <div class="col-12 col-md-6">
        <q-card class="bg-blue-1">
          <q-card-section>
            <div class="text-h6 text-blue-9">Current Plot Status</div>
            <div class="text-caption text-grey-8 q-mb-sm">
              {{ farmerStore.isRunning ? 'Live from farmer' : 'Farmer stopped' }}
            </div>
            <div class="row justify-between q-mt-sm">
              <div class="text-center">
                <div class="text-caption text-grey-8">OG</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentPlotCounts.og || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">NFT</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentPlotCounts.nft || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">Compressed</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentPlotCounts.compressed || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Combined Activity Stats -->
      <div class="col-12 col-md-6">
        <q-card class="bg-green-1">
          <q-card-section>
            <div class="text-h6 text-green-9">Activity ({{ timeframeLabel }})</div>
            <div class="text-caption text-grey-8">Farming activity summary</div>

            <div class="row q-col-gutter-md q-mt-xs">
              <div class="col-4 text-center">
                <div class="text-caption text-grey-8">Plots Passed</div>
                <div class="text-h4 text-weight-bold">
                  {{ totalPlotsPassedInTimeframe }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="col-4 text-center">
                <div class="text-caption text-grey-8">Partials Found</div>
                <div class="text-h4 text-weight-bold">
                  {{ partialsFoundInTimeframe }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="col-4 text-center">
                <div class="text-caption text-grey-8">Proofs Found</div>
                <div class="text-h4 text-weight-bold">
                  {{ proofsFoundInTimeframe }}
                </div>
                <div class="text-caption">total</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useFarmerChartStore } from '@/stores/farmerChartStore';
import { useFarmerStore } from '@/stores/farmerStore';
import Chart from "@/components/farmer/Chart.vue";

const chartStore = useFarmerChartStore();
const farmerStore = useFarmerStore();

const timeframeOptions = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 }
];

const selectedTimeframe = ref(1);

// Persistent plot count tracker to prevent random 0s
const lastKnownPlotCounts = ref({
  og: 0,
  nft: 0,
  compressed: 0
});

// Chart configuration
const legendItems = [
  { key: 'og', label: 'OG Plots', color: '#4CAF50' },
  { key: 'nft', label: 'NFT Plots', color: '#FF9800' },
  { key: 'compressed', label: 'Compressed Plots', color: '#9C27B0' },
  { key: 'proofs', label: 'Proofs Found', color: '#FFC107' }
];

const dataKeys = ['og', 'nft', 'compressed'];

// Basic computed properties
const totalRecords = computed(() => chartStore.historyData.farmer_records.length);

const dataPointsInTimeframe = computed(() =>
    chartStore.getHistoryForTimeframe(selectedTimeframe.value).length
);

const timeframeLabel = computed(() => {
  const hours = selectedTimeframe.value;
  if (hours < 24) return `${hours}h`;
  if (hours === 24) return '24h';
  return `${Math.floor(hours / 24)}d`;
});

// Statistics
const proofsFoundInTimeframe = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);
  return records.reduce((total, record) => total + (record.activity.proofsFound || 0), 0);
});

const partialsFoundInTimeframe = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);
  return records.reduce((total, record) => {
    return total +
        (record.activity.partialsFound?.nft || 0) +
        (record.activity.partialsFound?.compressed || 0);
  }, 0);
});

const totalPlotsPassedInTimeframe = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);
  return records.reduce((total, record) => {
    return total +
        record.activity.passedFilter.og.processed +
        record.activity.passedFilter.nft.processed +
        record.activity.passedFilter.compressed.processed;
  }, 0);
});

const currentPlotCounts = computed(() => {
  const counts = farmerStore.farmer.plot_counts || {};

  const currentCounts = {
    og: counts.og_plot_count || 0,
    nft: counts.nft_plot_count || 0,
    compressed: counts.compressed_plot_count || 0
  };

  const totalCurrent = currentCounts.og + currentCounts.nft + currentCounts.compressed;
  const totalLastKnown = lastKnownPlotCounts.value.og + lastKnownPlotCounts.value.nft + lastKnownPlotCounts.value.compressed;

  if (totalCurrent > 0) {
    lastKnownPlotCounts.value = { ...currentCounts };
    return currentCounts;
  } else if (totalLastKnown > 0 && farmerStore.isRunning) {
    console.log('📊 Using last known plot counts to prevent random 0s');
    return lastKnownPlotCounts.value;
  }

  return currentCounts;
});

// Chart data processing with consolidation
const chartData = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);

  if (records.length === 0) {
    return [];
  }

  // Filter records with activity
  const activeRecords = records.filter(record => {
    return record.activity.passedFilter.og.processed > 0 ||
        record.activity.passedFilter.nft.processed > 0 ||
        record.activity.passedFilter.compressed.processed > 0;
  });

  if (activeRecords.length === 0) {
    return [];
  }

  // Determine consolidation interval based on timeframe and data volume
  const consolidationInterval = getConsolidationInterval(selectedTimeframe.value, activeRecords.length);

  // Group and consolidate data
  const consolidatedData = consolidateRecords(activeRecords, consolidationInterval);

  return consolidatedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
});

// Helper function to determine consolidation interval
function getConsolidationInterval(timeframeHours: number, recordCount: number) {
  // Aim for max 50 data points to keep chart readable
  const maxDataPoints = 50;

  if (recordCount <= maxDataPoints) {
    return 0; // No consolidation needed
  }

  // Calculate minutes per bucket to fit within maxDataPoints
  const totalMinutes = timeframeHours * 60;
  const minutesPerBucket = Math.ceil(totalMinutes / maxDataPoints);

  // Round to sensible intervals
  if (minutesPerBucket <= 1) return 1;
  if (minutesPerBucket <= 5) return 5;
  if (minutesPerBucket <= 15) return 15;
  if (minutesPerBucket <= 30) return 30;
  if (minutesPerBucket <= 60) return 60;
  return Math.ceil(minutesPerBucket / 60) * 60; // Round to hours
}

// Helper function to consolidate records into time buckets
function consolidateRecords(records: any[], intervalMinutes: number) {
  if (intervalMinutes === 0) {
    // No consolidation - return original data
    return records.map(record => ({
      timestamp: record.timestamp,
      og: record.activity.passedFilter.og.processed,
      nft: record.activity.passedFilter.nft.processed,
      compressed: record.activity.passedFilter.compressed.processed,
      proofs: record.activity.proofsFound || 0,
      total: record.activity.passedFilter.og.processed +
          record.activity.passedFilter.nft.processed +
          record.activity.passedFilter.compressed.processed
    }));
  }

  // Group records into time buckets
  const buckets = new Map();

  records.forEach(record => {
    const bucketTime = roundToInterval(record.timestamp, intervalMinutes);
    const bucketKey = bucketTime.getTime();

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        timestamp: bucketTime,
        og: 0,
        nft: 0,
        compressed: 0,
        proofs: 0,
        total: 0
      });
    }

    const bucket = buckets.get(bucketKey);
    bucket.og += record.activity.passedFilter.og.processed;
    bucket.nft += record.activity.passedFilter.nft.processed;
    bucket.compressed += record.activity.passedFilter.compressed.processed;
    bucket.proofs += record.activity.proofsFound || 0;
    bucket.total = bucket.og + bucket.nft + bucket.compressed;
  });

  return Array.from(buckets.values());
}

// Helper function to round timestamp to interval
function roundToInterval(date: Date, intervalMinutes: number): Date {
  const roundedDate = new Date(date);
  const minutes = roundedDate.getMinutes();
  const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
  roundedDate.setMinutes(roundedMinutes, 0, 0);
  return roundedDate;
}

// Watch for new data and auto-refresh farmer state
watch(() => chartStore.chartUpdateId, () => {
  // When new chart data arrives, refresh farmer state to get latest plot counts
  if (farmerStore.isRunning) {
    farmerStore.refreshData();
  }
});

// Watch farmer state and start/stop chart collection accordingly
watch(() => farmerStore.isRunning, (isRunning, wasRunning) => {
  if (isRunning && wasRunning === false) {
    chartStore.startChartCollection();
  } else if (!isRunning && wasRunning === true) {
    chartStore.stopChartCollection();
  }
});

onMounted(() => {
  if (farmerStore.isRunning) {
    chartStore.startChartCollection();
  }
  chartStore.refresh();
});
</script>

<style scoped>
/* Add any dashboard-specific styles here */
</style>