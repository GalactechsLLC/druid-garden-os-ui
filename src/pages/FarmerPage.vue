<script setup lang="ts">
import {ref, onMounted, onUnmounted, computed, watch} from 'vue'
import { formatBytes } from '@/utils/format'
import FarmerConfig from "@/components/setup/FarmerConfig.vue";
import { useRouter } from 'vue-router';

import {useFarmerStore} from "@/stores/farmerStore.ts";
import {useFarmerChartStore} from "@/stores/farmerChartStore.ts";
import {useNotificationStore} from "@/stores/notificationStore.ts";
import {useDiskStore} from "@/stores/diskStore.ts";
import Notification from "@/components/Notification.vue";
import FarmerLogs from "@/components/farmer/FarmerLogs.vue";
import FarmerChartComponent from "@/components/farmer/FarmerChart.vue";
import { useLogService } from '@/services/farmerLog.ts';

const router = useRouter();
const notificationStore = useNotificationStore()
const farmerStore = useFarmerStore()
const farmerChartStore = useFarmerChartStore()
const diskStore = useDiskStore()

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

const hasNonSystemDisks = computed(() => {
  return diskStore.disks.some(disk =>
      disk.partitions?.some(partition => {
        const mountPath = partition.mount_path || partition.mountpoint;
        return mountPath && !['/home', '/boot', '/', '/var'].includes(mountPath);
      })
  );
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

const dataIsReady = computed(() => {
  return farmerChartStore.historyData &&
      farmerChartStore.historyData.farmer_records.length > 0;
});

const goToDeviceSettings = () => {
  router.push('/settings?tab=devices');
};

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
  // Check if disk is mounted before starting
  if (!hasNonSystemDisks.value) {
    notificationStore.warning('Please mount a disk before starting the farmer');
    return;
  }

  if (!farmerStore.canStartFarmer) {
    notificationStore.error('Cannot start farmer: Invalid configuration or farmer is already running');
    return;
  }

  try {
    notificationStore.info('Starting farmer...');
    const result = await farmerStore.startFarmer();

    if (result && result.success) {
      window.dispatchEvent(new CustomEvent('farmer-started'));

      setTimeout("", 3000);

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

              // Start chart data collection
              console.log('🚀 Starting chart data collection from start handler');
              farmerChartStore.startChartCollection();

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

      // Stop chart data collection
      console.log('🛑 Stopping chart data collection from stop handler');
      farmerChartStore.stopChartCollection();
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

let refreshInterval: number | null = null;

onMounted(async () => {
  console.log('📊 Farmer page mounted');

  await farmerStore.checkFarmerStatus();
  await farmerStore.updateConfigTestResult();
  await diskStore.fetchDisks();

  if (farmerStore.isRunning) {
    console.log('✅ Farmer is running on page load - starting chart collection');
    await fetchAllData();
    farmerChartStore.startChartCollection();
  } else {
    console.log('❌ Farmer not running on page load');
  }
});

watch(() => farmerStore.isRunning, async (isRunning, wasRunning) => {
  console.log(`📊 Farmer state changed: ${wasRunning} → ${isRunning}`);

  if (isRunning && !wasRunning) {
    console.log('✅ Farmer started - starting chart collection and state refresh');
    await fetchAllData();
    farmerChartStore.startChartCollection();

    if (!refreshInterval) {
      refreshInterval = window.setInterval(async () => {
        if (farmerStore.isRunning) {
          await farmerStore.checkFarmerStatus();
          await fetchFarmerState();
        }
      }, 5000); // Refresh every 5 seconds
    }
  } else if (!isRunning && wasRunning) {
    console.log('❌ Farmer stopped - stopping chart collection and state refresh');
    farmerChartStore.stopChartCollection();

    // Stop the refresh interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
}, { immediate: true });

onUnmounted(() => {
  console.log('📊 Farmer page unmounted');

  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

});

</script>

<template>
  <q-page padding>
    <!-- Disk Warning Banner -->
    <q-banner
        v-if="!hasNonSystemDisks && !farmerStore.isRunning"
        class="bg-warning text-white q-mb-md"
        rounded
    >
      <template v-slot:avatar>
        <q-icon name="warning" size="2rem" />
      </template>
      <div class="text-subtitle1 text-weight-medium">No disk mounted</div>
      <div class="text-body2">Please mount a disk before starting the farmer</div>
      <template v-slot:action>
        <q-btn
            flat
            color="white"
            label="Go to Device Settings"
            @click="goToDeviceSettings"
            icon-right="arrow_forward"
        />
      </template>
    </q-banner>

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
            :disable="!farmerStore.canStartFarmer || farmerStore.processingAction || !hasNonSystemDisks"
            :loading="farmerStore.processingAction"
        >
          <q-tooltip v-if="!hasNonSystemDisks">Please mount a disk first</q-tooltip>
        </q-btn>

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
        <!-- Disk Mount Required Card -->
        <q-card v-if="!hasNonSystemDisks && !farmerStore.isRunning" class="q-mb-md">
          <q-card-section class="bg-warning text-white">
            <div class="text-h6">
              <q-icon name="storage" /> Disk Mount Required
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-center q-py-lg">
              <q-icon name="warning" size="4rem" color="warning" class="q-mb-md" />
              <div class="text-h6 q-mb-sm">No Disk Mounted</div>
              <div class="text-body2 text-grey-6 q-mb-lg">
                You need to mount a disk before you can start farming. Please go to Device Settings to mount a disk.
              </div>
              <q-btn
                  color="warning"
                  size="lg"
                  icon="settings"
                  label="Go to Device Settings"
                  @click="goToDeviceSettings"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Farming Activity Chart -->
        <q-card v-if="farmerStore.isRunning" class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Farming Activity
            </div>
          </q-card-section>

          <q-card-section>
            <!-- Always show the chart component when farmer is running -->
            <FarmerChartComponent />
          </q-card-section>
        </q-card>

        <!-- Start Farmer Card -->
        <q-card v-else-if="farmerStore.canStartFarmer && hasNonSystemDisks" class="q-mb-md">
          <q-card-section class="bg-green text-white">
            <div class="text-h6">
              <q-icon name="agriculture" /> Start your farmer
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-center q-py-lg">
              <q-icon name="play_circle" size="4rem" color="positive" class="q-mb-md" />
              <div class="text-h6 q-mb-sm">Ready to Farm</div>
              <div class="text-body2 text-grey-6 q-mb-lg">
                Your farmer is configured and ready to start.
              </div>
              <q-btn
                  color="positive"
                  size="lg"
                  icon="play_arrow"
                  label="Start Farmer"
                  @click="startFarmerHandler"
                  :disable="farmerStore.processingAction"
                  :loading="farmerStore.processingAction"
              />
            </div>
          </q-card-section>
        </q-card>

        <!-- Configure Farmer Card -->
        <q-card v-else-if="!farmerStore.canStartFarmer" class="q-mb-md">
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