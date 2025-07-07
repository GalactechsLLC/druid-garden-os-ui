import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, post, del } from '@/utils/api';

export interface LEDConfig {
    red: number;
    green: number;
    blue: number;
    brightness: number;
    enabled: boolean;
}

export interface BoardConfig {
    id: string;
    name: string;
    displayName: string;
    pins: {
        red: number;
        green: number;
        blue: number;
    };
    config: LEDConfig;
}

export interface PinUpdatePayload {
    pin: number;
    color: 'Red' | 'Green' | 'Blue';
}

export interface LedColorMode {
    red: number;
    green: number;
    blue: number;
}

export const useLEDStore = defineStore('led', () => {
    const currentBoard = ref<string>('rpi4');
    const isTestMode = ref<boolean>(false);
    const lastSaved = ref<Date | null>(null);
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);

    // Board configurations - will be updated with real pin mappings later
    const boards = ref<BoardConfig[]>([
        {
            id: 'rpi4',
            name: 'rpi4',
            displayName: 'Raspberry Pi 4',
            pins: { red: 20, green: 21, blue: 18 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 0,
                enabled: false
            }
        },
        {
            id: 'rock4',
            name: 'rock4',
            displayName: 'Rock Pi 4',
            pins: { red: 20, green: 21, blue: 18 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 0,
                enabled: false
            }
        },
        {
            id: 'rock5',
            name: 'rock5',
            displayName: 'Rock Pi 5',
            pins: { red: 20, green: 21, blue: 18 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 0,
                enabled: false
            }
        }
    ]);

    // Computed properties
    const currentBoardConfig = computed(() =>
        boards.value.find(board => board.id === currentBoard.value)
    );

    const availableBoards = computed(() =>
        boards.value.map(board => ({
            label: board.displayName,
            value: board.id
        }))
    );

    // API Actions
    const getBrightness = async (): Promise<number> => {
        try {
            const brightness = await get<number>('/api/led/brightness', {
                errorMessage: 'Failed to get LED brightness',
                showErrorNotification: false
            });
            return brightness || 0;
        } catch (err) {
            console.error('Failed to get brightness:', err);
            return 0;
        }
    };

    const setBrightness = async (brightness: number): Promise<void> => {
        try {
            await post(`/api/led/brightness/${brightness}`, {}, {
                successMessage: `Brightness set to ${brightness}%`,
                errorMessage: 'Failed to set LED brightness',
                showSuccessNotification: false,
                showErrorNotification: true
            });

            // Update local state
            const board = boards.value.find(board => board.id === currentBoard.value);
            if (board) {
                board.config.brightness = brightness;
            }
        } catch (err) {
            console.error('Failed to set brightness:', err);
            throw err;
        }
    };

    const getPinValue = async (pin: number): Promise<number> => {
        try {
            const value = await get<number>(`/api/led/pin/${pin}`, {
                errorMessage: `Failed to get pin ${pin} value`,
                showErrorNotification: false
            });
            return value || 0;
        } catch (err) {
            console.error(`Failed to get pin ${pin} value:`, err);
            return 0;
        }
    };

    const setPinMode = async (pin: number, color: 'Red' | 'Green' | 'Blue'): Promise<void> => {
        try {
            const payload: PinUpdatePayload = { pin, color };
            await post('/api/led/pin', payload, {
                successMessage: `${color} LED pin set to ${pin}`,
                errorMessage: `Failed to set ${color} LED pin`,
                showSuccessNotification: false,
                showErrorNotification: true
            });
        } catch (err) {
            console.error(`Failed to set pin ${pin} to ${color}:`, err);
            throw err;
        }
    };

    const clearPinModes = async (): Promise<void> => {
        try {
            await del('/api/led/pin', {
                successMessage: 'All LED pins cleared',
                errorMessage: 'Failed to clear LED pins',
                showSuccessNotification: true,
                showErrorNotification: true
            });
        } catch (err) {
            console.error('Failed to clear pin modes:', err);
            throw err;
        }
    };

    const setColorMode = async (colorMode: LedColorMode): Promise<void> => {
        try {
            await post('/api/led/color', colorMode, {
                successMessage: 'LED color mode updated',
                errorMessage: 'Failed to set LED color mode',
                showSuccessNotification: false,
                showErrorNotification: true
            });
        } catch (err) {
            console.error('Failed to set color mode:', err);
            throw err;
        }
    };

    // Local state management actions
    const setCurrentBoard = (boardId: string) => {
        if (boards.value.find(board => board.id === boardId)) {
            currentBoard.value = boardId;
        }
    };

    const updateLEDConfig = (config: Partial<LEDConfig>) => {
        const board = boards.value.find(board => board.id === currentBoard.value);
        if (board) {
            board.config = { ...board.config, ...config };
        }
    };

    const setLEDColor = (color: 'red' | 'green' | 'blue', value: number) => {
        const board = boards.value.find(board => board.id === currentBoard.value);
        if (board) {
            board.config[color] = Math.max(0, Math.min(255, value));
        }
    };

    const toggleEnabled = () => {
        const board = boards.value.find(board => board.id === currentBoard.value);
        if (board) {
            board.config.enabled = !board.config.enabled;
        }
    };

    // Test LED color by setting individual pin
    const testColor = async (color: 'red' | 'green' | 'blue') => {
        if (!currentBoardConfig.value) return;

        isTestMode.value = true;
        error.value = null;

        try {
            const board = currentBoardConfig.value;
            const pin = board.pins[color];
            const colorName = color.charAt(0).toUpperCase() + color.slice(1) as 'Red' | 'Green' | 'Blue';

            // Set the pin mode for testing
            await setPinMode(pin, colorName);

            // Simulate test duration
            setTimeout(async () => {
                try {
                    // Clear the pin after test
                    await clearPinModes();
                } catch (err) {
                    console.error('Failed to clear pin after test:', err);
                } finally {
                    isTestMode.value = false;
                }
            }, 2000);

        } catch (err) {
            console.error(`Failed to test ${color} LED:`, err);
            error.value = `Failed to test ${color} LED`;
            isTestMode.value = false;
            throw err;
        }
    };

    // Save configuration by setting up all pins and color mode
    const saveConfiguration = async () => {
        if (!currentBoardConfig.value) return { success: false, message: 'No board selected' };

        loading.value = true;
        error.value = null;

        try {
            const board = currentBoardConfig.value;

            // Clear any existing pin modes first
            await clearPinModes();

            // Set up pin modes for each color
            await setPinMode(board.pins.red, 'Red');
            await setPinMode(board.pins.green, 'Green');
            await setPinMode(board.pins.blue, 'Blue');

            // Set brightness
            await setBrightness(board.config.brightness);

            // Set color mode
            await setColorMode({
                red: board.config.red,
                green: board.config.green,
                blue: board.config.blue
            });

            lastSaved.value = new Date();
            saveToLocalStorage();

            return { success: true, message: 'LED configuration saved successfully' };
        } catch (err) {
            console.error('Failed to save LED configuration:', err);
            error.value = 'Failed to save LED configuration';
            return { success: false, message: 'Failed to save LED configuration' };
        } finally {
            loading.value = false;
        }
    };

    const resetToDefaults = async () => {
        const board = boards.value.find(board => board.id === currentBoard.value);
        if (board) {
            // Reset to default values based on board type
            const defaults: Record<string, LEDConfig> = {
                rpi4: { red: 0, green: 0, blue: 0, brightness: 0, enabled: false },
                rock4: { red: 0, green: 0, blue: 0, brightness: 0, enabled: false },
                rock5: { red: 0, green: 0, blue: 0, brightness: 0, enabled: false }
            };

            board.config = { ...defaults[board.id] };

            // Clear hardware pins
            try {
                await clearPinModes();
            } catch (err) {
                console.error('Failed to clear pins during reset:', err);
            }
        }
    };

    // Load/Save local storage (for UI state persistence)
    const loadSavedConfig = () => {
        try {
            const saved = localStorage.getItem('ledConfig');
            if (saved) {
                const parsedConfig = JSON.parse(saved);
                boards.value = parsedConfig.boards || boards.value;
                currentBoard.value = parsedConfig.currentBoard || currentBoard.value;
                lastSaved.value = parsedConfig.lastSaved ? new Date(parsedConfig.lastSaved) : null;
            }
        } catch (error) {
            console.error('Failed to load LED configuration from localStorage:', error);
        }
    };

    const saveToLocalStorage = () => {
        try {
            const configToSave = {
                boards: boards.value,
                currentBoard: currentBoard.value,
                lastSaved: lastSaved.value?.toISOString()
            };
            localStorage.setItem('ledConfig', JSON.stringify(configToSave));
        } catch (error) {
            console.error('Failed to save LED configuration to localStorage:', error);
        }
    };

    // Initialize store
    loadSavedConfig();

    return {
        // State
        currentBoard,
        isTestMode,
        lastSaved,
        loading,
        error,
        boards,

        // Getters
        currentBoardConfig,
        availableBoards,

        // API Actions
        getBrightness,
        setBrightness,
        getPinValue,
        setPinMode,
        clearPinModes,
        setColorMode,

        // Local Actions
        setCurrentBoard,
        updateLEDConfig,
        setLEDColor,
        toggleEnabled,
        testColor,
        saveConfiguration,
        resetToDefaults,
        saveToLocalStorage
    };
});