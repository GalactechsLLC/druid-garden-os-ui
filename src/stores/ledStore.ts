import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, post, del } from '@/utils/api';
import { useConfigStore } from '@/stores/configStore';

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
    const configStore = useConfigStore();

    const isTestMode = ref<boolean>(false);
    const lastSaved = ref<Date | null>(null);
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);

    // Board configurations with your updated GPIO pins
    const boards = ref<BoardConfig[]>([
        {
            id: 'rpi4',
            name: 'rpi4',
            displayName: 'Raspberry Pi 4',
            pins: { red: 16, green: 20, blue: 21 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 255,
                enabled: false
            }
        },
        {
            id: 'rock4',
            name: 'rock4',
            displayName: 'Rock Pi 4',
            pins: { red: 132, green: 134, blue: 135 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 255,
                enabled: false
            }
        },
        {
            id: 'rock5',
            name: 'rock5',
            displayName: 'Rock Pi 5',
            pins: { red: 32, green: 33, blue: 35 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 255,
                enabled: false
            }
        }
    ]);

    // Computed properties
    const currentBoard = computed(() => configStore.getLEDBoardType());

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
            const brightness = await get<number>('/led/brightness', {
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
            await post(`/led/brightness/${brightness}`, {}, {
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
            const value = await get<number>(`/led/pin/${pin}`, {
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
            await post('/led/pin', payload, {
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
            await del('/led/pin', {
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
            // The API expects {"Solid": [r, g, b]} format
            const payload = {
                "Solid": [colorMode.red, colorMode.green, colorMode.blue]
            };

            await post('/led/color', payload, {
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
    const setCurrentBoard = async (boardId: string) => {
        if (boards.value.find(board => board.id === boardId)) {
            // Clear existing pins when switching boards
            try {
                await clearPinModes();
                console.log('Cleared pins for board switch');
            } catch (err) {
                console.error('Failed to clear pins during board switch:', err);
            }

            // Update the board in config
            await configStore.setLEDBoardType(boardId);

            // Set up pins for the new board
            const newBoard = boards.value.find(board => board.id === boardId);
            if (newBoard) {
                try {
                    console.log(`Setting up pins for ${newBoard.displayName}`);

                    // Set up all 3 pins for the new board
                    await setPinMode(newBoard.pins.red, 'Red');
                    await setPinMode(newBoard.pins.green, 'Green');
                    await setPinMode(newBoard.pins.blue, 'Blue');

                    console.log(`Pins configured for ${newBoard.displayName}:`, newBoard.pins);
                } catch (err) {
                    console.error('Failed to set up pins for new board:', err);
                }
            }
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

            console.log(`Testing ${colorName} LED on pin ${pin}`);

            // Set the pin mode for testing
            await setPinMode(pin, colorName);

            // Set a test color (full intensity for the tested color)
            const testColorValues = {
                red: color === 'red' ? 255 : 0,
                green: color === 'green' ? 255 : 0,
                blue: color === 'blue' ? 255 : 0
            };

            await setColorMode(testColorValues);

            // Keep the test running - don't auto-clear
            // User can manually switch colors or reset
            console.log(`${colorName} LED test activated - LED should stay on`);

        } catch (err) {
            console.error(`Failed to test ${color} LED:`, err);
            error.value = `Failed to test ${color} LED`;
        } finally {
            isTestMode.value = false;
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
                rpi4: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false },
                rock4: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false },
                rock5: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false }
            };

            board.config = { ...defaults[board.id] };

            // Clear hardware pins and turn off LEDs
            try {
                await clearPinModes();
                // Turn off all colors
                await setColorMode({ red: 0, green: 0, blue: 0 });
                console.log('Reset to defaults - pins cleared and LEDs turned off');
            } catch (err) {
                console.error('Failed to clear pins during reset:', err);
            }
        }
    };

    // Add a method to turn off all LEDs without clearing pins
    const turnOffLEDs = async () => {
        try {
            await setColorMode({ red: 0, green: 0, blue: 0 });
            console.log('All LEDs turned off');
        } catch (err) {
            console.error('Failed to turn off LEDs:', err);
            throw err;
        }
    };

    // Initialize store - ensure config store is loaded
    const initializeStore = async () => {
        await configStore.fetchConfigs();
    };

    return {
        // State
        isTestMode,
        lastSaved,
        loading,
        error,
        boards,

        // Getters
        currentBoard,
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
        turnOffLEDs,
        initializeStore
    };
});