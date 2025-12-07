/**
 * Option for configuration dropdowns and selects
 */
export interface ConfigOption {
    label: string;
    value: string;
}

/**
 * Basic configuration setting
 */
export interface Config {
    key: string;
    value: string;
    description?: string;
    /** Plugin that owns this config */
    plugin?: string;
    /** Data type (string, number, boolean, etc.) */
    type?: string;
    category?: string;
    [key: string]: any;
}

/**
 * Collection of configuration values by key
 */
export interface ConfigValues {
    [key: string]: string | number | null | undefined;
}

/**
 * Complete configuration entry with metadata
 */
export interface ConfigEntry {
    key: string;
    value: string;
    last_value: string;
    category: string;
    /** 1 for system config, 0 for user config */
    system: number;
    /** ISO date string when created */
    created: string;
    /** ISO date string when last modified */
    modified: string;
    description?: string;
    /** Plugin that owns this config */
    plugin?: string;
    /** Data type (string, number, boolean, etc.) */
    type?: string;
}

/**
 * Available theme options
 */
export const themeOptions: ConfigOption[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' }
];