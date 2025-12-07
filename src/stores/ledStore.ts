import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get, post, del } from '@/utils/api';
import { useConfigStore } from '@/stores/configStore';
import type { LEDConfig, BoardConfig, PinUpdatePayload, LedColorMode } from '@/types/led';

/**
 * LED control store managing RGB LEDs across different board types
 * Handles GPIO pin configuration, color control, and board-specific settings
 */
export const useLEDStore = defineStore('led', () => {
    const configStore = useConfigStore();

    const isTestMode = ref<boolean>(false);
    const lastSaved = ref<Date | null>(null);
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);

    /**
     * Supported board configurations with GPIO pin mappings
     */
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
            pins: { red: 36, green: 38, blue: 40 },
            config: {
                red: 0,
                green: 0,
                blue: 0,
                brightness: 255,
                enabled: false
            }
        }
    ]);

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

    const getBrightness = async (): Promise<number> => {
        try {
            const brightness = await get<number>('/led/brightness', {
                errorMessage: 'Failed to get LED brightness',
                showErrorNotification: false
            });
            return brightness || 0;
        } catch (err) {
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
            throw err;
        }
    };

    /**
     * Set LED color using API's expected format: {"Solid": [r, g, b]}
     */
    const setColorMode = async (colorMode: LedColorMode): Promise<void> => {
        try {
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
            throw err;
        }
    };

    /**
     * Switch board type and reconfigure GPIO pins
     * Clears existing pins and sets up new board configuration
     */
    const setCurrentBoard = async (boardId: string) => {
        if (boards.value.find(board => board.id === boardId)) {
            // Clear existing pins when switching boards
            try {
                await clearPinModes();
            } catch (err) {
                // Continue with board switch even if clear fails
            }

            await configStore.setLEDBoardType(boardId);

            // Set up pins for the new board
            const newBoard = boards.value.find(board => board.id === boardId);
            if (newBoard) {
                try {
                    await setPinMode(newBoard.pins.red, 'Red');
                    await setPinMode(newBoard.pins.green, 'Green');
                    await setPinMode(newBoard.pins.blue, 'Blue');
                } catch (err) {
                    // Pin setup failed but board is switched
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

    /**
     * Set individual color component with value clamping
     */
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

    /**
     * Test individual color channel by setting it to full brightness
     */
    const testColor = async (color: 'red' | 'green' | 'blue') => {
        if (!currentBoardConfig.value) return;

        isTestMode.value = true;
        error.value = null;

        try {
            const testColorValues = {
                red: color === 'red' ? 255 : 0,
                green: color === 'green' ? 255 : 0,
                blue: color === 'blue' ? 255 : 0
            };

            await setColorMode(testColorValues);
        } catch (err) {
            error.value = `Failed to test ${color} LED`;
        } finally {
            isTestMode.value = false;
        }
    };

    /**
     * Save complete LED configuration including pins, brightness, and colors
     * Performs full setup sequence for reliable hardware state
     */
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

            // Set brightness and color
            await setBrightness(board.config.brightness);
            await setColorMode({
                red: board.config.red,
                green: board.config.green,
                blue: board.config.blue
            });

            lastSaved.value = new Date();

            return { success: true, message: 'LED configuration saved successfully' };
        } catch (err) {
            error.value = 'Failed to save LED configuration';
            return { success: false, message: 'Failed to save LED configuration' };
        } finally {
            loading.value = false;
        }
    };

    /**
     * Reset configuration to defaults and turn off hardware
     */
    const resetToDefaults = async () => {
        const board = boards.value.find(board => board.id === currentBoard.value);
        if (board) {
            const defaults: Record<string, LEDConfig> = {
                rpi4: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false },
                rock4: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false },
                rock5: { red: 0, green: 0, blue: 0, brightness: 255, enabled: false }
            };

            board.config = { ...defaults[board.id] };

            // Clear hardware pins and turn off LEDs
            try {
                await clearPinModes();
                await setColorMode({ red: 0, green: 0, blue: 0 });
            } catch (err) {
                // Reset local state even if hardware clear fails
            }
        }
    };

    /**
     * Turn off all LEDs without clearing pin configuration
     */
    const turnOffLEDs = async () => {
        try {
            await setColorMode({ red: 0, green: 0, blue: 0 });
        } catch (err) {
            throw err;
        }
    };

    /**
     * Initialize store by ensuring config store is loaded
     */
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