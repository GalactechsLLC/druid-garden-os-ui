<template>
  <div class="farmer-logs">
    <div class="logs-header">
      <h3 class="logs-title">Farmer Logs</h3>
      <div class="log-controls">
        <q-select
            v-model="selectedLogLevel"
            :options="logLevels"
            label="Log Level"
            dense
            outlined
            options-dense
            class="log-level-select"
            @update:model-value="handleLogLevelChange"
        />
        <q-btn
            flat
            round
            icon="refresh"
            :loading="reconnecting"
            @click="reconnectWebSocket"
            title="Reconnect to log stream"
        />
        <q-btn
            flat
            round
            icon="clear_all"
            @click="clearLogs"
            title="Clear logs"
        />
        <q-btn
            flat
            round
            :icon="autoScroll ? 'lock' : 'lock_open'"
            @click="toggleAutoScroll"
            :title="autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'"
            :color="autoScroll ? 'primary' : 'grey'"
        />
      </div>
    </div>

    <div class="logs-container" ref="logsContainer">
      <div v-if="filteredLogs && filteredLogs.length === 0 && connectionStatus === 'connected'" class="no-logs">
        <q-icon name="info" color="grey-5" size="2em" />
        <span class="q-ml-sm">No logs available at this level. Waiting for new logs...</span>
      </div>

      <div v-else-if="connectionStatus !== 'connected'" class="connection-status">
        <q-spinner v-if="connectionStatus === 'connecting'" color="primary" size="2em" />
        <q-icon v-else-if="connectionStatus === 'error'" name="error" color="negative" size="2em" />
        <q-icon v-else name="wifi_off" color="grey" size="2em" />

        <span class="status-text">
          {{ connectionStatusMessage }}
        </span>

        <q-btn
            v-if="connectionStatus === 'disconnected' || connectionStatus === 'error'"
            color="primary"
            label="Reconnect"
            @click="reconnectWebSocket"
            :loading="reconnecting"
            class="q-mt-sm"
        />
      </div>

      <div v-else class="log-entries">
        <div
            v-for="(log, index) in displayLogs"
            :key="log.uuid || `${log.timestamp}-${index}`"
            class="log-entry"
            :class="getLogLevelClass(log.level)"
        >
          <div class="log-timestamp">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="log-level">
            [{{ log.level }}]
          </div>
          <div v-if="log.target && showTarget" class="log-target">
            {{ log.target }}:
          </div>
          <div class="log-message">
            {{ log.message }}
          </div>
        </div>
      </div>

      <!-- Scroll to bottom indicator -->
      <div v-if="!isScrolledToBottom && autoScroll" class="scroll-indicator">
        <q-btn
            fab-mini
            color="primary"
            icon="keyboard_arrow_down"
            @click="scrollToBottom"
            title="Scroll to bottom"
        />
      </div>
    </div>

    <!-- Connection info footer -->
    <div class="logs-footer">
      <div class="connection-info">
        <q-chip
            :color="connectionStatus === 'connected' ? 'positive' : connectionStatus === 'connecting' ? 'warning' : 'negative'"
            text-color="white"
            :icon="getConnectionIcon()"
            size="sm"
        >
          {{ connectionStatus?.toUpperCase()  || 'UNKNOWN' }}
        </q-chip>

        <span class="log-count">
          {{ filteredLogs.length }} logs ({{ selectedLogLevel.label }})
        </span>

        <span v-if="connectionStatus === 'connected'" class="last-update">
          Level: {{ selectedLogLevel.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted, nextTick, watch} from 'vue';
import { useLogService } from '@/services/farmerLog';
import {type LogLevelOption, logLevels, type LogLevelValue} from "@/types/farmer";

import {useFarmerChartStore} from "@/stores/farmerChartStore";
const farmerChartStore = useFarmerChartStore();

// State
const selectedLogLevel = ref<LogLevelOption>(logLevels[3]);
const reconnecting = ref(false);
const autoScroll = ref(true);
const isScrolledToBottom = ref(true);
const showTarget = ref(false);

// Refs
const logsContainer = ref<HTMLElement>();

// Get log service
const { logs, connectionStatus, connect, disconnect, clearLogs: clearLogEntries, changeLogLevel } = useLogService();

// Computed properties
const filteredLogs = computed(() => {
  if (!logs.value) return [];

  if (selectedLogLevel.value.value === 'ALL') {
    return logs.value;
  }

  const levelPriority: Record<LogLevelValue, number> = {
    'ALL': -1,
    'TRACE': 0,
    'DEBUG': 1,
    'INFO': 2,
    'WARN': 3,
    'ERROR': 4
  };

  const selectedPriority = levelPriority[selectedLogLevel.value.value];

  return logs.value.filter(log => {
    const normalizedLevel = (log.level?.toUpperCase() || 'INFO') as LogLevelValue;
    const logLevelPriority = levelPriority[normalizedLevel] ?? 2; // Default to INFO priority
    return logLevelPriority >= selectedPriority;
  });
});

const displayLogs = computed(() => {
  // Reverse for bottom-up display (newest at bottom)
  return [...filteredLogs.value].reverse();
});

const connectionStatusMessage = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return 'Connecting to log stream...';
    case 'disconnected':
      return 'Disconnected from log stream.';
    case 'error':
      return 'Error connecting to log stream.';
    case 'connected':
      return `Connected to ${selectedLogLevel.value.label} log stream`;
    default:
      return 'Unknown connection status';
  }
});

// Functions
function formatTimestamp(timestamp: Date | number[]): string {
  let date: Date;

  if (Array.isArray(timestamp)) {
    // Format: [year, day_of_year, hour, minute, second, nanosecond, tz_offset, _, _]
    const [year, dayOfYear, hour, minute, second] = timestamp;
    date = new Date(year, 0);
    date.setDate(dayOfYear);
    date.setHours(hour, minute, second);
  } else {
    date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function getLogLevelClass(level: string): string {
  const normalizedLevel = level.toUpperCase();
  switch (normalizedLevel) {
    case 'ERROR':
      return 'log-level-error';
    case 'WARN':
      return 'log-level-warn';
    case 'INFO':
      return 'log-level-info';
    case 'DEBUG':
      return 'log-level-debug';
    case 'TRACE':
      return 'log-level-trace';
    default:
      return '';
  }
}

function getConnectionIcon(): string {
  switch (connectionStatus.value) {
    case 'connected':
      return 'wifi';
    case 'connecting':
      return 'wifi_find';
    case 'error':
      return 'wifi_off';
    case 'disconnected':
      return 'wifi_off';
    default:
      return 'help';
  }
}

function handleLogLevelChange(): void {
  console.log('Log level changed to:', selectedLogLevel.value.label);
  changeLogLevel(selectedLogLevel.value.value);
}

async function reconnectWebSocket(): Promise<void> {
  reconnecting.value = true;
  try {
    console.log('Manually reconnecting WebSocket...');
    disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    connect(farmerChartStore, selectedLogLevel.value.value);
  } finally {
    reconnecting.value = false;
  }
}

function clearLogs(): void {
  clearLogEntries();
}

function toggleAutoScroll(): void {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    nextTick(() => scrollToBottom());
  }
}

function scrollToBottom(): void {
  if (logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    isScrolledToBottom.value = true;
  }
}

function checkScrollPosition(): void {
  if (logsContainer.value) {
    const { scrollTop, scrollHeight, clientHeight } = logsContainer.value;
    isScrolledToBottom.value = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
  }
}

// Auto-scroll management
watch(() => filteredLogs.value?.length, () => {
  if (autoScroll.value) {
    nextTick(() => scrollToBottom());
  }
});

// Setup scroll listener
onMounted(() => {
  console.log('FarmerLogs component mounted');

  // Connect to log stream with the selected level
  if (connectionStatus.value !== 'connected') {
    connect(farmerChartStore, selectedLogLevel.value.value);
  }

  // Setup scroll listener
  if (logsContainer.value) {
    logsContainer.value.addEventListener('scroll', checkScrollPosition);
  }

  // Listen for farmer events
  const handleFarmerStarted = () => {
    console.log('Farmer started - reconnecting log stream');
    reconnectWebSocket();
  };

  window.addEventListener('farmer-started', handleFarmerStarted);

  // Initial scroll
  nextTick(() => scrollToBottom());

  onUnmounted(() => {
    if (logsContainer.value) {
      logsContainer.value.removeEventListener('scroll', checkScrollPosition);
    }
    window.removeEventListener('farmer-started', handleFarmerStarted);
    disconnect();
  });
});
</script>

<style scoped>
.farmer-logs {
  display: flex;
  flex-direction: column;
  height: 29vh;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  background-color: #fafafa;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  min-height: 50px;
}

.logs-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
  color: #2c3e50;
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-level-select {
  width: 120px;
}

.logs-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 8px;
  position: relative;
  height: calc(100% - 80px); /* Account for header and footer */
  scroll-behavior: smooth;
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 100%;
  justify-content: flex-end;
}

.log-entry {
  display: flex;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  background-color: #ffffff;
  border: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.log-entry:hover {
  background-color: #f8f9fa;
}

.log-timestamp {
  color: #666;
  margin-right: 8px;
  white-space: nowrap;
  font-weight: 500;
}

.log-level {
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
  min-width: 60px;
}

.log-target {
  color: #0066cc;
  margin-right: 8px;
  white-space: nowrap;
  font-style: italic;
}

.log-message {
  word-break: break-word;
  flex: 1;
  line-height: 1.4;
}

.no-logs {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
  font-style: italic;
  flex-direction: column;
  gap: 8px;
}

.connection-status {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
  gap: 12px;
}

.status-text {
  text-align: center;
  font-weight: 500;
}

.scroll-indicator {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
}

.logs-footer {
  padding: 4px 16px;
  background-color: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  min-height: 30px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8rem;
  color: #666;
}

.log-count {
  font-weight: 500;
}

.last-update {
  margin-left: auto;
  font-style: italic;
}

/* Log level styling */
.log-level-error {
  background-color: #ffebee;
  border-left: 4px solid #f44336;
}

.log-level-error .log-level {
  color: #d32f2f;
}

.log-level-warn {
  background-color: #fff8e1;
  border-left: 4px solid #ff9800;
}

.log-level-warn .log-level {
  color: #f57c00;
}

.log-level-info {
  background-color: #e8f5e9;
  border-left: 4px solid #4caf50;
}

.log-level-info .log-level {
  color: #2e7d32;
}

.log-level-debug {
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
}

.log-level-debug .log-level {
  color: #1976d2;
}

.log-level-trace {
  background-color: #f3e5f5;
  border-left: 4px solid #9c27b0;
}

.log-level-trace .log-level {
  color: #7b1fa2;
}
</style>