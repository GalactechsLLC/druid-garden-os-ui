<template>
  <div>
    <!-- Chart Header with Timeframe selector and Last Update -->
    <div class="chart-header q-mb-md">
      <div class="timeframe-selector">
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

      <div class="last-update-info">
        <div class="text-caption text-grey-6">Last Update</div>
        <div class="text-body2 text-weight-medium">
          {{ lastUpdateTime }}
          <q-icon
              v-if="farmerStore.isRunning"
              name="refresh"
              color="positive"
              size="xs"
              class="q-ml-xs"
          />
        </div>
      </div>
    </div>

    <!-- Chart -->
    <q-card class="q-mb-md" style="height: 350px">
      <q-card-section v-if="shouldShowChart" class="q-pa-none" style="height: 100%">
        <apexchart
            type="column"
            height="100%"
            :options="chartOptions"
            :series="chartSeries"
            :key="chartKey"
        />
      </q-card-section>
      <q-card-section v-else class="column flex-center">
        <q-icon name="agriculture" color="grey-5" size="48px" />
        <div class="text-grey q-mt-sm">
          {{ farmerStore.isRunning ? 'Waiting for farming data...' : 'Farmer not running' }}
        </div>
        <div class="text-caption text-grey-6 q-mt-xs">
          {{ farmerStore.isRunning ? 'Data will appear as farming occurs' : 'Start farmer to collect data' }}
        </div>
        <!-- Debug info -->
        <div class="text-caption text-grey-6 q-mt-xs" v-if="farmerStore.isRunning">
          Records: {{ totalRecords }} | In timeframe: {{ dataPointsInTimeframe }}
        </div>
      </q-card-section>
    </q-card>

    <!-- Activity metrics - Fixed to show proper proofs/partials -->
    <div class="row q-col-gutter-md q-mt-md">
      <!-- Current Plot Status -->
      <div class="col-12 col-md-4">
        <q-card class="bg-blue-1">
          <q-card-section>
            <div class="text-h6 text-blue-9">
              <div class="flex space-between">
                <div>Current Plot Status</div>
                <div>{{ totalPlots }}</div>
              </div>
            </div>
            <div class="text-caption text-grey-8 q-mb-sm">
              {{ farmerStore.isRunning ? 'Live from farmer' : 'Farmer stopped' }}
            </div>
            <div class="row justify-between q-mt-sm">
              <div class="text-center">
                <div class="text-caption text-grey-8">OG</div>
                <div class="text-h5 text-weight-bold">
                  {{ farmerStore.farmer.plot_counts.og_plot_count || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">NFT</div>
                <div class="text-h5 text-weight-bold">
                  {{ farmerStore.farmer.plot_counts.nft_plot_count || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">Compressed</div>
                <div class="text-h5 text-weight-bold">
                  {{ farmerStore.farmer.plot_counts.compresses_plot_count || 0 }}
                </div>
                <div class="text-caption">total</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Proofs Found -->
      <div class="col-12 col-md-4">
        <q-card class="bg-green-1">
          <q-card-section>
            <div class="text-h6 text-green-9">Proofs Found</div>
            <div class="text-caption text-grey-8 q-mb-sm">Last {{ timeframeLabel }}</div>
            <div class="text-h2 text-weight-bold text-center q-mt-sm">
              {{ proofsFoundInTimeframe }}
            </div>
            <div class="text-caption text-center text-grey-6">
              total proofs
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Partials Found -->
      <div class="col-12 col-md-4">
        <q-card class="bg-purple-1">
          <q-card-section>
            <div class="text-h6 text-purple-9">Partials Found</div>
            <div class="text-caption text-grey-8 q-mb-sm">Last {{ timeframeLabel }}</div>
            <div class="row justify-around q-mt-sm">
              <div class="text-center">
                <div class="text-caption text-grey-8">NFT</div>
                <div class="text-h4 text-weight-bold">
                  {{ partialsFoundInTimeframe.nft }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">Compressed</div>
                <div class="text-h4 text-weight-bold">
                  {{ partialsFoundInTimeframe.compressed }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Chart Data Summary -->
    <div class="row q-mt-md">
      <div class="col-12">
        <q-card class="bg-grey-1">
          <q-card-section>
            <div class="text-h6 text-grey-9">
              Chart Data
              <q-chip
                  :color="farmerStore.isRunning ? 'positive' : 'grey'"
                  :text-color="farmerStore.isRunning ? 'white' : 'dark'"
                  size="sm"
                  class="q-ml-sm"
              >
                {{ farmerStore.isRunning ? 'LIVE' : 'STATIC' }}
              </q-chip>
            </div>
            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col">
                <div class="text-caption">Total Records</div>
                <div class="text-h5 text-weight-bold">{{ totalRecords }}</div>
              </div>
              <div class="col">
                <div class="text-caption">Timeframe ({{ timeframeLabel }})</div>
                <div class="text-h5 text-weight-bold">{{ dataPointsInTimeframe }}</div>
              </div>
              <div class="col">
                <div class="text-caption">Series Data</div>
                <div class="text-body2">{{ chartSeries.length }} series</div>
              </div>
              <div class="col" v-if="farmerStore.isRunning">
                <div class="text-caption">Auto-refresh</div>
                <div class="text-body2">
                  <q-icon name="refresh" color="positive" />
                  Active
                </div>
              </div>
            </div>
            <!-- Debug info -->
            <div class="q-mt-sm text-caption text-grey-6" v-if="chartSeries.length > 0">
              Chart series: {{ chartSeries.map((s: any) => s.name).join(', ') }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useFarmerChartStore } from '@/stores/farmerChartStore';
import { useFarmerStore } from '@/stores/farmerStore';

const chartStore = useFarmerChartStore();
const farmerStore = useFarmerStore();

const timeframeOptions = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 }
];

const selectedTimeframe = ref(1);

// Simple computed properties that react to store data
const totalRecords = computed(() => chartStore.historyData.farmer_records.length);

const dataPointsInTimeframe = computed(() =>
    chartStore.getHistoryForTimeframe(selectedTimeframe.value).length
);

const hasChartData = computed(() => dataPointsInTimeframe.value > 0);

const shouldShowChart = computed(() => hasChartData.value);

const totalPlots = computed(() => {
  const counts = farmerStore.farmer.plot_counts;
  return (counts.og_plot_count || 0) +
      (counts.nft_plot_count || 0) +
      (counts.compresses_plot_count || 0);
});

// Fixed proofs and partials calculations
const proofsFoundInTimeframe = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);
  return records.reduce((total: number, record: any) => total + (record.activity.proofsFound || 0), 0);
});

const partialsFoundInTimeframe = computed(() => {
  const records = chartStore.getHistoryForTimeframe(selectedTimeframe.value);
  return records.reduce((totals: any, record: any) => ({
    nft: totals.nft + (record.activity.partialsFound.nft || 0),
    compressed: totals.compressed + (record.activity.partialsFound.compressed || 0)
  }), { nft: 0, compressed: 0 });
});

const timeframeLabel = computed(() => {
  const hours = selectedTimeframe.value;
  if (hours < 24) return `${hours}h`;
  if (hours === 24) return '24h';
  return `${Math.floor(hours / 24)}d`;
});

const lastUpdateTime = computed(() => {
  if (chartStore.lastFetchTime) {
    return chartStore.lastFetchTime.toLocaleTimeString();
  }
  const records = chartStore.historyData.farmer_records;
  if (records.length === 0) return 'Never';

  const lastRecord = records[records.length - 1];
  return lastRecord.timestamp.toLocaleTimeString();
});

// Chart data - directly reactive to store data
const chartSeries = computed(() => {
  if (!hasChartData.value) {
    console.log('📊 No chart data available');
    return [];
  }

  try {
    const series = chartStore.getChartSeries(selectedTimeframe.value);
    console.log('📊 Chart series computed:', series.map((s: any) => ({
      name: s.name,
      dataPoints: s.data.length,
      hasData: s.data.some((p: any) => p.y > 0)
    })));
    return series;
  } catch (error) {
    console.error('Error getting chart series:', error);
    return [];
  }
});

const chartOptions = computed(() => {
  try {
    const baseOptions = chartStore.getChartOptions(selectedTimeframe.value);
    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: 'column',
        animations: {
          enabled: false
        },
        toolbar: {
          show: false
        }
      }
    };
  } catch (error) {
    console.error('Error getting chart options:', error);
    return {
      chart: { type: 'column' },
      xaxis: { categories: [] },
      yaxis: {},
      series: []
    };
  }
});

// Simple chart key that updates when data changes
const chartKey = computed(() =>
    `${selectedTimeframe.value}-${totalRecords.value}-${chartStore.chartUpdateId}`
);

// Watch for timeframe changes and log debug info
watch(selectedTimeframe, (newTimeframe) => {
  console.log(`📊 Timeframe changed to ${newTimeframe}h`);
  chartStore.debugChartData(newTimeframe);
});

// Watch farmer state and start/stop chart collection accordingly
watch(() => farmerStore.isRunning, (isRunning, wasRunning) => {
  console.log(`📊 Farmer state changed: ${wasRunning} → ${isRunning}`);

  if (isRunning && wasRunning === false) {
    console.log('✅ Farmer started - starting chart collection from component');
    chartStore.startChartCollection();
  } else if (!isRunning && wasRunning === true) {
    console.log('❌ Farmer stopped - stopping chart collection from component');
    chartStore.stopChartCollection();
  }
});

onMounted(() => {
  console.log('📊 Chart component mounted');

  // Check if farmer is already running and start chart collection if needed
  if (farmerStore.isRunning) {
    console.log('✅ Farmer is running on mount - starting chart collection');
    chartStore.startChartCollection();
  } else {
    console.log('❌ Farmer not running on mount');
  }

  // Refresh to get any existing data
  chartStore.refresh();
});

onUnmounted(() => {
  console.log('📊 Chart component unmounted');
  // Don't cleanup polling - let it continue globally
});
</script>

<style scoped>
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeframe-selector {
  flex-grow: 0;
}

.last-update-info {
  text-align: right;
  flex-shrink: 0;
}

.space-between {
  justify-content: space-between;
}

.flex {
  display: flex;
}

.full-height {
  height: 100%;
}

.column {
  flex-direction: column;
}

.flex-center {
  align-items: center;
  justify-content: center;
}
</style>