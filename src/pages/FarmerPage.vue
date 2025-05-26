<script setup lang="ts">
import {ref, onMounted, onUnmounted, computed, watch} from 'vue'
import { formatBytes } from '@/utils/format'
import FarmerConfig from "@/components/setup/FarmerConfig.vue";

import {useFarmerStore} from "@/stores/farmerStore.ts";
import {useFarmerChartStore} from "@/stores/farmerChartStore.ts";
import {useNotificationStore} from "@/stores/notificationStore.ts";
import Notification from "@/components/Notification.vue";
import FarmerLogs from "@/components/farmer/FarmerLogs.vue";
// import FarmerChartComponent from "@/components/farmer/FarmerChart.vue";
import { useLogService } from '@/services/farmerLog.ts';

const notificationStore = useNotificationStore()
const farmerStore = useFarmerStore()
const farmerChartStore = useFarmerChartStore()

const farmerConfigRef = ref<any>(null);
const lastValidPlotCount = ref(0);
const lastValidPlotSpace = ref(0);
const lastUpdated = ref<Date | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const needsConfigSetup = computed(() => {
  if (farmerStore.isRunning) return false;
  return !farmerStore.canStartFarmer;
});

const sync = computed(() => {
  if (!farmerStore.isRunning) return false;
  return farmerStore.farmer.blockchain_state.sync.synced;
})

const height = computed(() => {
  if (!farmerStore.isRunning) return 0;
  return farmerStore.farmer.blockchain_state.peak?.height || 0;
})

const difficulty = computed(() => {
  if (!farmerStore.isRunning) return 0;
  return farmerStore.farmer.blockchain_state.difficulty;
})

const space = computed(() => {
  if (!farmerStore.isRunning) return 0;
  return farmerStore.farmer.blockchain_state.space;
})

const mempool_size = computed(() => {
  if (!farmerStore.isRunning) return 0;
  return farmerStore.farmer.blockchain_state.mempool_size;
})

const formattedSpace = computed(() => {
  return formatBytes(space.value, 3)
})


const openFarmerConfigModal = () => {
  farmerConfigRef.value?.open?.();
};

const onImportSuccess = (message: string): void => {
  console.log('Import successful:', message);
};

const onImportError = (error: string): void => {
  console.error('Import error:', error);
};

async function startFarmerHandler() {
  if (!farmerStore.canStartFarmer) {
    notificationStore.error('Cannot start farmer: Invalid configuration or farmer is already running');
    return;
  }

  try {
    notificationStore.info('Starting farmer...');
    const result = await farmerStore.startFarmer();

    if (result && result.success) {
      window.dispatchEvent(new CustomEvent('farmer-started'));

      await new Promise(resolve => setTimeout(resolve, 3000));

      const logService = useLogService();

      let fetchSuccess = false;
      let wsConnected = false;
      let attempts = 0;
      const maxAttempts = 5;
      const retryDelay = 2000;

      while ((!fetchSuccess || !wsConnected) && attempts < maxAttempts) {
        attempts++;
        try {
          notificationStore.info(`Connecting to farmer services (attempt ${attempts}/${maxAttempts})...`);

          await farmerStore.checkFarmerStatus();

          if (farmerStore.isRunning) {
            if (logService.connectionStatus.value !== 'connected') {
              console.log(`Attempt ${attempts}: WebSocket not connected, trying to connect...`);
              logService.connect(farmerChartStore);
              wsConnected = false;
            } else {
              wsConnected = true;
              console.log(`WebSocket connected on attempt ${attempts}`);
            }

            if (!fetchSuccess) {
              await fetchAllData();
              fetchSuccess = true;
              console.log(`Farmer state fetched on attempt ${attempts}`);
            }

            if (fetchSuccess && wsConnected) {
              notificationStore.success('Farmer started and connected successfully');

              // Initialize farming activity data
              // setTimeout(() => {
              //   farmerChartStore.addActivityHistoryPoint();
              //   farmerChartStore.updateCumulativeTotals();
              // }, 1000);

              break;
            }
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } catch (fetchError) {
          console.error(`Attempt ${attempts} failed:`, fetchError);

          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      if (!fetchSuccess && !wsConnected) {
        notificationStore.warning('Farmer started, but could not connect to any services. Try refreshing the page or check logs for errors.');
      } else if (!fetchSuccess) {
        notificationStore.warning('Farmer started, but could not fetch farmer state. Some data may not be available.');
      } else if (!wsConnected) {
        notificationStore.warning('Farmer started, but log stream connection failed. Log data may not be available.');
      }
    } else {
      notificationStore.error('Failed to start farmer: Unknown error');
    }
  } catch (error) {
    console.error('Error starting farmer:', error);
    notificationStore.error('Failed to start farmer: ' + (error instanceof Error ? error.message : String(error)));
  }
}

async function stopFarmerHandler() {
  if (!farmerStore.canStopFarmer) {
    notificationStore.error('Cannot stop farmer: Farmer is not running');
    return;
  }

  try {
    const success = await farmerStore.stopFarmer();
    if (!success) {
      notificationStore.error('Failed to stop farmer');
    } else {
      farmerStore.isRunning = false;
    }
  } catch (err) {
    console.error('Error stopping farmer:', err);
    notificationStore.error('An unexpected error occurred while stopping the farmer');
  }
}

async function fetchFarmerState() {
  try {
    await farmerStore.getFarmerState();

    const ogCount = farmerStore.farmer.plot_counts.og_plot_count || 0;
    const nftCount = farmerStore.farmer.plot_counts.nft_plot_count || 0;
    const compressedCount = farmerStore.farmer.plot_counts.compresses_plot_count || 0;
    const total = ogCount + nftCount + compressedCount;

    if (total > 0) {
      lastValidPlotCount.value = total;
    }

    const plotSpace = farmerStore.farmer.plot_counts.total_plot_space;
    if (plotSpace && plotSpace > 0) {
      lastValidPlotSpace.value = plotSpace;
    }

  } catch (err) {
    console.error('Error fetching farmer state:', err);
    notificationStore.error('An unexpected error occurred while fetching the farmer state');
  }
}

async function fetchAllData() {
  try {
    loading.value = true

    await Promise.all([
      fetchFarmerState(),
    ])

    lastUpdated.value = new Date()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch data'
    console.error('Error fetching all data:', err)
  } finally {
    loading.value = false
  }
}

// const dataIsReady = computed(() => {
//   return farmerChartStore.historyData &&
//       farmerChartStore.historyData.farmer_records.length > 0;
// });

function getTotalPlotCount() {
  const ogCount = farmerStore.farmer.plot_counts.og_plot_count || 0;
  const nftCount = farmerStore.farmer.plot_counts.nft_plot_count || 0;
  const compressedCount = farmerStore.farmer.plot_counts.compresses_plot_count || 0;
  const total = ogCount + nftCount + compressedCount;

  if (total > 0) {
    lastValidPlotCount.value = total;
    return total;
  }

  if (total === 0 && lastValidPlotCount.value > 0) {
    return lastValidPlotCount.value;
  }

  if (farmerChartStore.currentActivity.passedFilter) {
    const chartOgTotal = farmerChartStore.currentActivity.passedFilter.og.total || 0;
    const chartNftTotal = farmerChartStore.currentActivity.passedFilter.nft.total || 0;
    const chartCompressedTotal = farmerChartStore.currentActivity.passedFilter.compressed.total || 0;
    const chartTotal = chartOgTotal + chartNftTotal + chartCompressedTotal;

    if (chartTotal > 0) {
      return chartTotal;
    }
  }

  return total || 0;
}

function getTotalPlotSpace() {
  const plotSpaceFromApi = farmerStore.farmer.plot_counts.total_plot_space;

  if (plotSpaceFromApi && plotSpaceFromApi > 0) {
    lastValidPlotSpace.value = plotSpaceFromApi;
    return formatBytes(plotSpaceFromApi, 2);
  }

  if ((!plotSpaceFromApi || plotSpaceFromApi === 0) && lastValidPlotSpace.value > 0) {
    return formatBytes(lastValidPlotSpace.value, 2);
  }

  const totalCount = getTotalPlotCount();
  if (totalCount > 0) {
    return "Plot space data unavailable";
  }

  return "0 Bytes";
}

onMounted(async () => {
  console.log('Component mounted');

  await farmerStore.checkFarmerStatus();
  await farmerStore.updateConfigTestResult();

  if (farmerStore.isRunning) {
    await fetchAllData();
  } else {
    console.log('Farmer not running, skipping data fetch');
  }
});

watch(() => farmerStore.isRunning, async (newVal) => {
  console.log('isRunning changed to:', newVal);
  if (newVal) {
    await farmerStore.checkFarmerStatus();
    await fetchAllData();
  }
}, { immediate: false });

let refreshInterval: number | null = null;

watch(() => farmerStore.isRunning, (isRunning) => {
  if (isRunning) {
    refreshInterval = window.setInterval(async () => {
      if (farmerStore.isRunning) {
        await farmerStore.checkFarmerStatus();
        await fetchFarmerState();
      }
    }, 5000);
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
}, { immediate: true });

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <q-page padding>
    <div class="row q-mb-md items-center justify-between">
      <div>
        <h5 class="q-mt-none q-mb-xs text-green">Chia Farmer Dashboard</h5>
        <div class="text-caption text-grey-8" v-if="lastUpdated">
          Last updated: {{ lastUpdated.toLocaleString() }}
        </div>
      </div>

      <div class="row q-gutter-sm">
        <!-- Start Button -->
        <q-btn
            v-if="!farmerStore.isRunning"
            color="positive"
            label="Start"
            @click="startFarmerHandler"
            :disable="!farmerStore.canStartFarmer || farmerStore.processingAction"
            :loading="farmerStore.processingAction"
        />

        <!-- Stop Button -->
        <q-btn
            v-else
            color="negative"
            label="Stop"
            @click="stopFarmerHandler"
            :disable="!farmerStore.canStopFarmer || farmerStore.processingAction"
            :loading="farmerStore.processingAction"
        />

        <!-- Config Button -->
        <q-btn
            :color="needsConfigSetup ? 'warning' : 'primary'"
            icon="settings"
            :label="needsConfigSetup ? 'Setup Required' : ''"
            @click="openFarmerConfigModal"
            :class="{ 'config-highlight': needsConfigSetup }"
        >
          <q-tooltip v-if="needsConfigSetup">Configure your farmer to get started</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Main grid layout -->
    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-4">
        <!-- Farmer Information -->
        <q-card class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Farmer Information
            </div>
          </q-card-section>

          <q-card-section>
            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="play_circle" color="positive" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Process State</q-item-label>
                  <q-item-label><span :class="farmerStore.isRunning? 'text-positive' : 'text-negative'">{{ farmerStore.isRunning ? 'Running' : 'Stopped' }}</span></q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="storage" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Plot Count</q-item-label>
                  <q-item-label>{{ getTotalPlotCount() }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="sd_storage" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Total Space</q-item-label>
                  <q-item-label>{{ getTotalPlotSpace() }} ({{ farmerStore.farmer.plot_counts.total_plot_space || 0 }} bytes)</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="schedule" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Most Recent Signage Point</q-item-label>
                  <q-item-label v-if="farmerStore.farmer.blockchain_state.peak">
                    {{ farmerStore.farmer.blockchain_state.peak.signage_point_index }}
                  </q-item-label>
                  <q-item-label v-else>N/A</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- Fullnode Information -->
        <q-card class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="dns" /> Fullnode Information
            </div>
          </q-card-section>

          <q-card-section>
            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-icon :name="sync ? 'sync' : 'sync_disabled'" :color="sync ? 'positive' : 'warning'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Blockchain Sync</q-item-label>
                  <q-item-label>{{ sync ? 'Synced' : 'Not Synced' }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="trending_up" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Blockchain Height</q-item-label>
                  <q-item-label>{{ height }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="language" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Blockchain Space</q-item-label>
                  <q-item-label>{{ formattedSpace }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="bolt" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Blockchain Difficulty</q-item-label>
                  <q-item-label>{{ difficulty }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="pending" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label caption>Blockchain Mempool Size</q-item-label>
                  <q-item-label>{{ mempool_size }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-8">
        <!-- Farming Activity Chart -->
        <q-card v-if=farmerStore.isRunning class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Farming Active
            </div>
          </q-card-section>
        </q-card>
<!--        <q-card v-if=farmerStore.isRunning class="q-mb-md">-->
<!--          <q-card-section class="bg-green text-white">-->
<!--            <div class="text-h6">-->
<!--              <q-icon name="agriculture" /> Farming Activity-->
<!--            </div>-->
<!--          </q-card-section>-->

<!--          <q-card-section>-->
<!--            <div>-->
<!--              <FarmerChartComponent v-if="dataIsReady" />-->
<!--              <div v-else class="loading-placeholder">Loading farming data...</div>-->
<!--            </div>-->
<!--          </q-card-section>-->
<!--        </q-card>-->
        <q-card v-else-if="farmerStore.canStartFarmer" class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Start your farmer
            </div>
          </q-card-section>
        </q-card>
        <q-card v-else class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Configure your farmer
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-center q-py-lg">
              <q-icon name="settings" size="4rem" color="grey-5" class="q-mb-md" />
              <div class="text-h6 q-mb-sm">Configuration Required</div>
              <div class="text-body2 text-grey-6 q-mb-lg">
                Please configure your farmer settings to get started with Chia farming.
              </div>
              <q-btn
                  color="primary"
                  size="lg"
                  icon="settings"
                  label="Configure Farmer"
                  @click="openFarmerConfigModal"
                  class="config-highlight"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-12">
        <FarmerLogs />
      </div>
    </div>
  </q-page>

  <!-- Farmer Config Popup -->
  <FarmerConfig
      ref="farmerConfigRef"
      @import-success="onImportSuccess"
      @import-error="onImportError"
  />
  <Notification />
</template>

<style scoped>
.q-card {
  transition: all 0.3s ease;
}

.q-card:hover {
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* Highlight config button when setup is needed */
.config-highlight {
  animation: pulse-warning 2s infinite;
  box-shadow: 0 0 15px rgba(255, 193, 7, 0.5) !important;
}

@keyframes pulse-warning {
  0% {
    box-shadow: 0 0 15px rgba(255, 193, 7, 0.5);
  }
  50% {
    box-shadow: 0 0 25px rgba(255, 193, 7, 0.8);
  }
  100% {
    box-shadow: 0 0 15px rgba(255, 193, 7, 0.5);
  }
}

/* Style for the log section */
.log-section {
  height: 400px;
  overflow-y: auto;
}

/* Custom styling for the progress bars */
:deep(.q-linear-progress) {
  border-radius: 4px;
  overflow: hidden;
}

/* Animation for when data refreshes */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.data-refreshed {
  animation: pulse 0.5s ease-in-out;
}

/* Transition for tab changes */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.farmer-config-btn {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.farmer-config-btn:hover {
  background-color: #3e8e41;
}

.config-icon {
  margin-right: 6px;
  font-size: 16px;
}

.farmer-config-btn,
.farmer-start-btn,
.farmer-stop-btn {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Config button style (existing) */
.farmer-config-btn {
  background-color: #4caf50;
  color: white;
}

.farmer-config-btn:hover {
  background-color: #3e8e41;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

/* Start button style */
.farmer-start-btn {
  background-color: #2196F3;
  color: white;
}

.farmer-start-btn:hover:not(:disabled) {
  background-color: #1976D2;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

/* Stop button style */
.farmer-stop-btn {
  background-color: #F44336;
  color: white;
}

.farmer-stop-btn:hover:not(:disabled) {
  background-color: #D32F2F;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
}

/* Disabled state for all buttons */
.farmer-config-btn:disabled,
.farmer-start-btn:disabled,
.farmer-stop-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

/* Icons styling */
.config-icon,
.start-icon,
.stop-icon {
  margin-right: 6px;
  font-size: 16px;
}

/* Processing indicator */
.processing-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  font-size: 14px;
  color: #666;
}

.processing-indicator::before {
  content: "";
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 8px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.text-white .text-h6 {
  color: white;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>