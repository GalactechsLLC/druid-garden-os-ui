<template>
  <div class="farmer-logs">
    <div class="logs-header">
      <h3 class="logs-title">Farmer Logs</h3>
      <div class="log-controls">
        <q-select
            v-model="logLevel"
            :options="logLevels"
            label="Log Level"
            dense
            outlined
            options-dense
            class="log-level-select"
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
      </div>
    </div>

    <div class="logs-container" ref="logsContainer">
      <div v-if="filteredLogs && filteredLogs.length === 0 && connectionStatus === 'connected'" class="no-logs">
        No logs available at this level. Waiting for new logs...
      </div>

      <div v-else-if="connectionStatus !== 'connected'" class="connection-status">
        <q-spinner v-if="connectionStatus === 'connecting'" color="primary" size="2em" />
        <q-icon v-else name="error" color="negative" size="2em" />
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
            v-for="(log, index) in filteredLogs"
            :key="log.uuid || index"
            class="log-entry"
            :class="getLogLevelClass(log.level)"
        >
          <div class="log-timestamp">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="log-level">
            [{{ log.level }}]
          </div>
          <div v-if="log.target" class="log-target">
            {{ log.target }}:
          </div>
          <div class="log-message">
            {{ log.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted, nextTick, watch} from 'vue';
import { useLogService } from '@/services/farmerLog.ts';
import {type LogLevelOption, logLevels, type LogLevelValue} from "@/types/farmer.ts";
import {useFarmerChartStore} from "@/stores/farmerChartStore.ts";
const farmerChartStore = useFarmerChartStore();

// Current selected log level
const logLevel = ref<LogLevelOption>(logLevels[3]); // Default to INFO

// Reconnection state
const reconnecting = ref(false);

// Ref for logs container to control scrolling
const logsContainer = ref<HTMLElement>();

// Get log service
const { logs, connectionStatus, connect, disconnect, clearLogs: clearLogEntries } = useLogService();

// Filter logs based on selected level
const filteredLogs = computed(() => {
  let result;

  if (logLevel.value.value === 'ALL') {
    result = logs.value || [];
  } else {
    const levelPriority: Record<LogLevelValue, number> = {
      'ALL': -1,
      'TRACE': 0,
      'DEBUG': 1,
      'INFO': 2,
      'WARN': 3,
      'ERROR': 4
    };

    const selectedPriority = levelPriority[logLevel.value.value];

    if (!logs.value) {
      return [];
    }
    result = logs.value.filter(log => {
      const normalizedLevel = (log.level?.toUpperCase() || 'INFO') as LogLevelValue;
      const logLevelPriority = levelPriority[normalizedLevel] ?? 0;
      return logLevelPriority >= selectedPriority;
    });
  }

  // Reverse the array so newest logs appear at the bottom
  return [...result].reverse();
});
// Connection status message
const connectionStatusMessage = computed(() => {
  switch (connectionStatus.value) {
    case 'connecting':
      return 'Connecting to log stream...';
    case 'disconnected':
      return 'Disconnected from log stream.';
    case 'error':
      return 'Error connecting to log stream.';
    default:
      return '';
  }
});

// Auto-scroll to bottom when new logs arrive
const scrollToBottom = () => {
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    }
  });
};

// Watch for new logs and auto-scroll
watch(() => filteredLogs.value?.length, () => {
  scrollToBottom();
});

function formatTimestamp(timestamp: Date | number[]): string {
  let date: Date;

  if (Array.isArray(timestamp)) {
    // Format: [year, day_of_year, hour, minute, second, nanosecond, tz_offset, _, _]
    const [year, dayOfYear, hour, minute, second] = timestamp;

    // Create date from year and day of year
    date = new Date(year, 0);
    date.setDate(dayOfYear);
    date.setHours(hour, minute, second);
  } else {
    date = timestamp;
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Get CSS class for log level
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

// Reconnect to WebSocket
async function reconnectWebSocket() {
  reconnecting.value = true;
  try {
    connect(farmerChartStore);
    await new Promise(resolve => setTimeout(resolve, 1000));
  } finally {
    reconnecting.value = false;
  }
}

function clearLogs() {
  clearLogEntries();
}

onMounted(() => {
  if (connectionStatus.value !== 'connected') {
    connect(farmerChartStore);
  }

  const handleFarmerStarted = () => {
    reconnectWebSocket();
  };

  window.addEventListener('farmer-started', handleFarmerStarted);

  scrollToBottom();

  onUnmounted(() => {
    window.removeEventListener('farmer-started', handleFarmerStarted);
  });
});

onUnmounted(() => {
  window.removeEventListener('farmer-started', reconnectWebSocket);
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
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.logs-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
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
  background-color: #fafafa;
  height: calc(100% - 50px);
  scroll-behavior: smooth;
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 100%;
  justify-content: flex-end;
}

.log-entry {
  display: flex;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  background-color: #f9f9f9;
}

.log-timestamp {
  color: #666;
  margin-right: 8px;
  white-space: nowrap;
}

.log-level {
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
}

.log-target {
  color: #0066cc;
  margin-right: 8px;
  white-space: nowrap;
  display: none;
}

.log-message {
  word-break: break-word;
  flex: 1;
}

.no-logs {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
  font-style: italic;
}

.connection-status {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}

.status-text {
  margin-top: 8px;
  text-align: center;
}

.log-level-error {
  background-color: #ffebee;
}

.log-level-error .log-level {
  color: #d32f2f;
}

.log-level-warn {
  background-color: #fff8e1;
}

.log-level-warn .log-level {
  color: #ff8f00;
}

.log-level-info {
  background-color: #e8f5e9;
}

.log-level-info .log-level {
  color: #2e7d32;
}

.log-level-debug {
  background-color: #e3f2fd;
}

.log-level-debug .log-level {
  color: #1976d2;
}

.log-level-trace {
  background-color: #f3e5f5;
}

.log-level-trace .log-level {
  color: #7b1fa2;
}
</style>