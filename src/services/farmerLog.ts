import { ref, onBeforeUnmount } from 'vue';
import { type LogEntry, type LogLevelValue } from '@/types/farmer';
import { useFarmerChartStore } from '@/stores/farmerChartStore';

interface LogServiceReturn {
    logs: ReturnType<typeof ref<LogEntry[]>>;
    connectionStatus: ReturnType<typeof ref<'connecting' | 'connected' | 'disconnected' | 'error'>>;
    connect: (chartStore: ReturnType<typeof useFarmerChartStore>, level?: LogLevelValue) => void;
    disconnect: () => void;
    clearLogs: () => void;
    changeLogLevel: (level: LogLevelValue) => void;
}

let websocket: WebSocket | null = null;
const logs = ref<LogEntry[]>([]);
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

const WS_CONFIG = {
    BASE_PATH: '/farmer/log_stream', // Updated to use new unified API path
    RECONNECT_INTERVAL: 5000, // 5 seconds
    MAX_RECONNECT_ATTEMPTS: 5,
    MAX_LOG_ENTRIES: 1000
};

export function useLogService(): LogServiceReturn {
    let reconnectAttempts = 0;
    let reconnectTimer: number | null = null;
    let currentLevel: LogLevelValue = 'INFO';
    let chartStore: ReturnType<typeof useFarmerChartStore> | null = null;

    function connect(store: ReturnType<typeof useFarmerChartStore>, level: LogLevelValue = 'INFO'): void {
        chartStore = store;
        currentLevel = level.toLowerCase() as LogLevelValue;

        if (websocket) {
            disconnect();
        }

        reconnectAttempts = 0;
        connectionStatus.value = 'connecting';
        connectWebSocket();
    }

    function connectWebSocket(): void {
        try {
            // Use the same host and port as the current page (unified API)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host; // This includes port if different from 80/443

            const wsUrl = `${protocol}//${host}${WS_CONFIG.BASE_PATH}/${currentLevel}`;
            console.log('Connecting to WebSocket:', wsUrl);

            websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
                connectionStatus.value = 'connected';
                console.log('WebSocket connection established for level:', currentLevel);
                reconnectAttempts = 0;

                // Note: No longer calling updateCumulativeTotals as it doesn't exist
                // The optimized chart store handles data updates automatically
                if (chartStore) {
                    console.log('WebSocket connected, chart store will handle data updates automatically');
                }
            };

            websocket.onmessage = (event) => {
                try {
                    const logEntry: LogEntry = JSON.parse(event.data);
                    logs.value.unshift(logEntry);

                    // Keep logs at a reasonable size
                    if (logs.value.length > WS_CONFIG.MAX_LOG_ENTRIES) {
                        logs.value = logs.value.slice(0, WS_CONFIG.MAX_LOG_ENTRIES);
                    }

                    // Process log entry for farmer activity tracking
                    if (chartStore && isActivityLogEntry(logEntry)) {
                        parseActivityFromLog(logEntry, chartStore);
                    }
                } catch (error) {
                    console.error('Error parsing log message:', error);
                }
            };

            websocket.onclose = (event) => {
                connectionStatus.value = 'disconnected';
                console.log('WebSocket connection closed', event.code, event.reason);

                // Only attempt reconnection for unexpected closures
                if (event.code !== 1000) {
                    tryReconnect();
                }
            };

            websocket.onerror = (error) => {
                connectionStatus.value = 'error';
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            connectionStatus.value = 'error';
            console.error('Error establishing WebSocket connection:', error);
            tryReconnect();
        }
    }

    function tryReconnect(): void {
        if (reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;

            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
            }

            const backoffTime = Math.min(
                WS_CONFIG.RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1),
                30000
            ) * (0.8 + Math.random() * 0.4);

            console.log(`Attempting to reconnect in ${Math.round(backoffTime / 1000)} seconds (attempt ${reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`);

            reconnectTimer = window.setTimeout(() => {
                if (connectionStatus.value !== 'connected') {
                    console.log(`Reconnecting... (attempt ${reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
                    connectWebSocket();
                }
            }, backoffTime);
        } else {
            console.error(`Failed to reconnect after ${WS_CONFIG.MAX_RECONNECT_ATTEMPTS} attempts`);
            connectionStatus.value = 'error';
        }
    }

    function changeLogLevel(level: LogLevelValue): void {
        const newLevel = level.toLowerCase() as LogLevelValue;

        if (newLevel !== currentLevel) {
            currentLevel = newLevel;

            // Reconnect with new level if currently connected
            if (connectionStatus.value === 'connected' && chartStore) {
                console.log('Changing log level to:', newLevel);
                disconnect();
                setTimeout(() => {
                    connect(chartStore!, newLevel);
                }, 100);
            }
        }
    }

    function disconnect(): void {
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (websocket) {
            if (websocket.readyState === WebSocket.OPEN ||
                websocket.readyState === WebSocket.CONNECTING) {
                websocket.close(1000, 'Intentional disconnect');
            }
            websocket = null;
        }
        connectionStatus.value = 'disconnected';
    }

    function clearLogs(): void {
        logs.value = [];
    }

    // Helper function to identify activity-related log entries
    function isActivityLogEntry(logEntry: LogEntry): boolean {
        if (!logEntry.message) return false;

        const message = logEntry.message.toLowerCase();

        // Look for farming activity keywords
        return message.includes('proof') ||
            message.includes('partial') ||
            message.includes('signage') ||
            message.includes('challenge') ||
            message.includes('plot') ||
            message.includes('filter');
    }

    // Parse farming activity from log entries
    function parseActivityFromLog(logEntry: LogEntry, chartStore: ReturnType<typeof useFarmerChartStore>): void {
        try {
            const message = logEntry.message;

            // Trigger stats refresh when important farming events occur
            if (message.includes('Proof found')) {
                // Delay to ensure backend has processed the event
                setTimeout(() => chartStore.fetchFarmerStats(), 1000);
            } else if (message.includes('Partial found')) {
                setTimeout(() => chartStore.fetchFarmerStats(), 1000);
            } else if (message.includes('plots passed filter')) {
                setTimeout(() => chartStore.fetchFarmerStats(), 2000);
            }
        } catch (error) {
            console.error('Error parsing activity from log:', error);
        }
    }

    onBeforeUnmount(() => {
        disconnect();
    });

    return {
        logs,
        connectionStatus,
        connect,
        disconnect,
        clearLogs,
        changeLogLevel
    };
}