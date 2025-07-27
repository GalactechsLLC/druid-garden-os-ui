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
            class="q-px-md timeframe-btn"
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
        <q-card class="status-card plot-status-card">
          <q-card-section>
            <div class="text-h6 status-title">
              <q-icon name="donut_small" class="q-mr-sm" />
              Current Plot Status
            </div>
            <div class="status-subtitle q-mb-sm">
              <q-icon
                  :name="farmerStore.isRunning ? 'radio_button_checked' : 'radio_button_unchecked'"
                  :color="farmerStore.isRunning ? 'positive' : 'negative'"
                  size="xs"
                  class="q-mr-xs"
              />
              {{ farmerStore.isRunning ? 'Live from farmer' : 'Farmer stopped' }}
            </div>
            <div class="row justify-between q-mt-sm">
              <div class="text-center plot-count-item">
                <div class="plot-type-label">OG</div>
                <div class="plot-count-value">
                  {{ currentPlotCounts.og || 0 }}
                </div>
                <div class="plot-count-label">total</div>
              </div>
              <div class="text-center plot-count-item">
                <div class="plot-type-label">NFT</div>
                <div class="plot-count-value">
                  {{ currentPlotCounts.nft || 0 }}
                </div>
                <div class="plot-count-label">total</div>
              </div>
              <div class="text-center plot-count-item">
                <div class="plot-type-label">Compressed</div>
                <div class="plot-count-value">
                  {{ currentPlotCounts.compressed || 0 }}
                </div>
                <div class="plot-count-label">total</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Combined Activity Stats -->
      <div class="col-12 col-md-6">
        <q-card class="status-card activity-card">
          <q-card-section>
            <div class="text-h6 status-title">
              <q-icon name="trending_up" class="q-mr-sm" />
              Activity ({{ timeframeLabel }})
            </div>
            <div class="status-subtitle">Farming activity summary</div>

            <div class="row q-col-gutter-md q-mt-xs activity-stats">
              <div class="col-4 text-center activity-stat">
                <div class="activity-label">
                  <q-icon name="filter_alt" size="xs" class="q-mr-xs" />
                  Plots Passed
                </div>
                <div class="activity-value">
                  {{ totalPlotsPassedInTimeframe }}
                </div>
                <div class="activity-unit">total</div>
              </div>
              <div class="col-4 text-center activity-stat">
                <div class="activity-label">
                  <q-icon name="sensors" size="xs" class="q-mr-xs" />
                  Partials Found
                </div>
                <div class="activity-value">
                  {{ partialsFoundInTimeframe }}
                </div>
                <div class="activity-unit">total</div>
              </div>
              <div class="col-4 text-center activity-stat">
                <div class="activity-label">
                  <q-icon name="verified" size="xs" class="q-mr-xs" />
                  Proofs Found
                </div>
                <div class="activity-value">
                  {{ proofsFoundInTimeframe }}
                </div>
                <div class="activity-unit">total</div>
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

// Chart configuration with dark mode friendly colors
const legendItems = [
  { key: 'og', label: 'OG Plots', color: '#66BB6A' },
  { key: 'nft', label: 'NFT Plots', color: '#FFA726' },
  { key: 'compressed', label: 'Compressed Plots', color: '#AB47BC' },
  { key: 'proofs', label: 'Proofs Found', color: '#FFCA28' }
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
/* Light Mode Styles */
.timeframe-btn {
  transition: all 0.2s ease;
}

.status-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.status-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.plot-status-card {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-left: 4px solid #2196f3;
}

.activity-card {
  background: linear-gradient(135deg, #e8f5e9 0%, #fff3e0 100%);
  border-left: 4px solid #4caf50;
}

.status-title {
  color: #1565c0;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.status-subtitle {
  color: #666;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
}

.plot-count-item {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  width: 30%;
}

.plot-type-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.plot-count-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1565c0;
  margin: 4px 0;
}

.plot-count-label {
  font-size: 0.75rem;
  color: #888;
}

.activity-stat {
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  width: 30%;
}

.activity-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.activity-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: #2e7d32;
  margin: 4px 0;
}

.activity-unit {
  font-size: 0.75rem;
  color: #888;
}

.activity-stats {
  justify-content: space-between;
  margin-left: 0;
}

/* Dark Mode Styles */
.dark-mode .timeframe-btn {
  background: rgba(255, 255, 255, 0.05);
}

.dark-mode .status-card {
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark-mode .status-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.2);
}

.dark-mode .plot-status-card {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(156, 39, 176, 0.1) 100%);
  border-left: 4px solid #42a5f5;
}

.dark-mode .activity-card {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
  border-left: 4px solid #66bb6a;
}

.dark-mode .status-title {
  color: #bbdefb;
}

.dark-mode .status-subtitle {
  color: #b0bec5;
}

.dark-mode .plot-count-item,
.dark-mode .activity-stat {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
}

.dark-mode .plot-type-label,
.dark-mode .activity-label {
  color: #b0bec5;
}

.dark-mode .plot-count-value {
  color: #bbdefb;
}

.dark-mode .activity-value {
  color: #c8e6c9;
}

.dark-mode .plot-count-label,
.dark-mode .activity-unit {
  color: #78909c;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .plot-count-value,
  .activity-value {
    font-size: 1.25rem;
  }

  .status-card {
    margin-bottom: 1rem;
  }

  .activity-stat {
    margin-bottom: 0.5rem;
  }
}


/* Animation for live indicator */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.dark-mode .q-icon[name="radio_button_checked"] {
  animation: pulse 2s infinite;
}
</style>