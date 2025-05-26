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

    <!-- Chart -->
    <q-card class="q-mb-md" style="height: 350px">
      <q-card-section v-if="hasData" class="q-pa-none" style="height: 100%">
        <apexchart
            v-if="isChartReady && !chartStore.isLoading"
            type="bar"
            height="100%"
            :options="chartOptions"
            :series="chartSeries"
        />
        <div v-else class="full-height column flex-center">
          <q-spinner color="primary" size="40px" />
          <div class="q-mt-sm text-grey">
            {{ chartStore.isLoading ? 'Loading data...' : 'Loading chart...' }}
          </div>
        </div>
      </q-card-section>
      <q-card-section v-else class="column flex-center">
        <q-spinner v-if="chartStore.isLoading" color="primary" size="40px" />
        <template v-else>
          <q-icon name="data_usage" color="grey-5" size="48px" />
          <div class="text-grey q-mt-sm">No activity data available</div>
          <q-btn
              flat
              color="primary"
              label="Fetch Data"
              @click="chartStore.fetchFarmerStats()"
              class="q-mt-sm"
          />
        </template>
      </q-card-section>
    </q-card>

    <!-- Activity metrics -->
    <div class="row q-col-gutter-md q-mt-md">
      <!-- Passed Filter -->
      <div class="col-12 col-md-4">
        <q-card class="bg-blue-1">
          <q-card-section>
            <div class="text-h6 text-blue-9">
              <div class="flex space-between">
                <div>Processed Plots</div>
                <div>{{ totalPlots }}</div>
              </div>
            </div>
            <div class="row justify-between q-mt-sm">
              <div class="text-center">
                <div class="text-caption text-grey-8">OG</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentActivity.passedFilter.og.processed }}/{{ currentActivity.passedFilter.og.total }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">NFT</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentActivity.passedFilter.nft.processed }}/{{ currentActivity.passedFilter.nft.total }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">Compressed</div>
                <div class="text-h5 text-weight-bold">
                  {{ currentActivity.passedFilter.compressed.processed }}/{{ currentActivity.passedFilter.compressed.total }}
                </div>
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
            <div class="text-h2 text-weight-bold text-center q-mt-sm">
              {{ chartStore.cumulativeProofsFound }}
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Partials Found -->
      <div class="col-12 col-md-4">
        <q-card class="bg-purple-1">
          <q-card-section>
            <div class="text-h6 text-purple-9">Partials Found</div>
            <div class="row justify-around q-mt-sm">
              <div class="text-center">
                <div class="text-caption text-grey-8">NFT</div>
                <div class="text-h4 text-weight-bold">
                  {{ chartStore.cumulativePartialsFound.nft }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-caption text-grey-8">Compressed</div>
                <div class="text-h4 text-weight-bold">
                  {{ chartStore.cumulativePartialsFound.compressed }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useFarmerChartStore } from '@/stores/farmerChartStore';

const chartStore = useFarmerChartStore();

const timeframeOptions = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 }
];

const selectedTimeframe = ref(6);
const isChartReady = ref(false);
const showDebugInfo = ref(false);

const currentActivity = computed(() => chartStore.activity);

const totalPlots = computed(() => {
  const activity = chartStore.activity;
  return activity.passedFilter.og.total +
      activity.passedFilter.nft.total +
      activity.passedFilter.compressed.total;
});

const chartSeries = computed(() => chartStore.getChartSeries(selectedTimeframe.value));
const chartOptions = computed(() => chartStore.getChartOptions(selectedTimeframe.value));

const hasData = computed(() => {
  return chartSeries.value && chartSeries.value.length > 0 &&
      chartSeries.value.some(series => series.data && series.data.length > 0);
});

const lastUpdateTime = computed(() => {
  const records = chartStore.historyData.farmer_records;
  if (records.length === 0) return 'Never';

  const lastRecord = records[records.length - 1];
  return lastRecord.timestamp.toLocaleTimeString();
});

const initChart = () => {
  isChartReady.value = false;
  setTimeout(() => {
    isChartReady.value = true;
  }, 100);
};

watch(selectedTimeframe, () => {
  initChart();
});

watch(() => chartStore.historyData.farmer_records.length, (newLength, oldLength) => {
  if (newLength !== oldLength && newLength > 0) {
    initChart();
  }
});

watch(() => chartStore.isLoading, (isLoading) => {
  if (!isLoading && hasData.value) {
    initChart();
  }
});

onMounted(() => {
  chartStore.initializeData();

  setTimeout(() => {
    initChart();
  }, 500);

  const handleFarmerStarted = () => {
    console.log('Farmer started event received');
    chartStore.fetchFarmerStats();
  };

  window.addEventListener('farmer-started', handleFarmerStarted);

  onUnmounted(() => {
    chartStore.cleanup();

    window.removeEventListener('farmer-started', handleFarmerStarted);
  });
});
</script>

<style scoped>
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