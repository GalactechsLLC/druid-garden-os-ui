export interface ConfigOption {
    label: string;
    value: string;
}

export interface Config {
    key: string;
    value: string;
    description?: string;
    plugin?: string;
    type?: string;
    category?: string;
    [key: string]: any;
}

export interface ConfigValues {
    [key: string]: string | number | null | undefined;
}

export interface ConfigEntry {
    key: string;
    value: string;
    last_value: string;
    category: string;
    system: number;
    created: string;
    modified: string;
    description?: string;
    plugin?: string;
    type?: string;
}

export const themeOptions: ConfigOption[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' }
];
