/**
 * LED color and brightness configuration
 */
export interface LEDConfig {
    /** Red component (0-255) */
    red: number;
    /** Green component (0-255) */
    green: number;
    /** Blue component (0-255) */
    blue: number;
    /** Overall brightness (0-255) */
    brightness: number;
    enabled: boolean;
}

/**
 * Board-specific LED configuration with GPIO pin mapping
 */
export interface BoardConfig {
    id: string;
    name: string;
    displayName: string;
    /** GPIO pin assignments for each color */
    pins: {
        red: number;
        green: number;
        blue: number;
    };
    config: LEDConfig;
}

/**
 * Payload for updating GPIO pin assignments
 */
export interface PinUpdatePayload {
    pin: number;
    color: 'Red' | 'Green' | 'Blue';
}

/**
 * RGB color values for LED control
 */
export interface LedColorMode {
    /** Red component (0-255) */
    red: number;
    /** Green component (0-255) */
    green: number;
    /** Blue component (0-255) */
    blue: number;
}