import { ref, onBeforeUnmount } from 'vue';
import { type LogEntry } from '@/types/farmer';
import { useFarmerChartStore } from '@/stores/farmerChartStore';

interface LogServiceReturn {
    logs: ReturnType<typeof ref<LogEntry[]>>;
    connectionStatus: ReturnType<typeof ref<'connecting' | 'connected' | 'disconnected' | 'error'>>;
    connect: (chartStore: ReturnType<typeof useFarmerChartStore>) => void;
    disconnect: () => void;
    clearLogs: () => void;
}

let websocket: WebSocket | null = null;
const logs = ref<LogEntry[]>([]);
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

const WS_CONFIG = {
    PORT: 9090,
    PATH: '/log_stream/info',
    RECONNECT_INTERVAL: 5000, // 5 seconds
    MAX_RECONNECT_ATTEMPTS: 5
};

export function useLogService(): LogServiceReturn {
    let reconnectAttempts = 0;
    let reconnectTimer: number | null = null;

    function connect(chartStore: ReturnType<typeof useFarmerChartStore>): void {
        if (websocket) {
            disconnect();
        }

        reconnectAttempts = 0;
        connectionStatus.value = 'connecting';

        connectWebSocket(chartStore);
    }

    function connectWebSocket(chartStore: ReturnType<typeof useFarmerChartStore>): void {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const hostname = window.location.hostname;

            websocket = new WebSocket(`${protocol}//${hostname}:${WS_CONFIG.PORT}${WS_CONFIG.PATH}`);

            websocket.onopen = () => {
                connectionStatus.value = 'connected';
                console.log('WebSocket connection established');
                reconnectAttempts = 0;

                chartStore.updateCumulativeTotals();
            };

            websocket.onmessage = (event) => {
                try {
                    const logEntry: LogEntry = JSON.parse(event.data);
                    logs.value.unshift(logEntry);

                    // Keep logs at a reasonable size
                    if (logs.value.length > 1000) {
                        logs.value = logs.value.slice(0, 1000);
                    }

                    // Process log entry for farmer activity tracking
                    // if (chartStore) {
                    //     chartStore.parseAndStoreActivity(logEntry);
                    //     chartStore.updateCumulativeTotals();
                    // }
                } catch (error) {
                    console.error('Error parsing log message:', error);
                }
            };

            websocket.onclose = (event) => {
                connectionStatus.value = 'disconnected';
                console.log('WebSocket connection closed', event.code, event.reason);

                if (event.code !== 1000) {
                    tryReconnect(chartStore);
                }
            };

            websocket.onerror = (error) => {
                connectionStatus.value = 'error';
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            connectionStatus.value = 'error';
            console.error('Error establishing WebSocket connection:', error);

            tryReconnect(chartStore);
        }
    }

    function tryReconnect(chartStore: ReturnType<typeof useFarmerChartStore>): void {
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
                    connectWebSocket(chartStore);
                }
            }, backoffTime);
        } else {
            console.error(`Failed to reconnect after ${WS_CONFIG.MAX_RECONNECT_ATTEMPTS} attempts`);
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

    onBeforeUnmount(() => {
        disconnect();
    });

    return {
        logs,
        connectionStatus,
        connect,
        disconnect,
        clearLogs
    };
}