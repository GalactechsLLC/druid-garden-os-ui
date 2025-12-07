import { defineStore } from 'pinia';
import { get, post, del } from '@/utils/api';
import type {ConfigEntry} from "@/types/settings.ts";

/**
 * Configuration management store handling system settings, drive labels, and LED board configuration
 * Provides JSON validation, default config creation, and specialized accessors for hardware settings
 */
export const useConfigStore = defineStore('config', {
    state: () => ({
        configs: [] as ConfigEntry[],
        loading: false,
        error: null as string | null,
        jsonErrors: {} as Record<string, { error: boolean; message: string }>
    }),

    getters: {
        /**
         * Group configurations by plugin for organized display
         */
        groupedConfigs: (state) => {
            const result: Record<string, ConfigEntry[]> = {};

            for (const config of state.configs) {
                const plugin = config.plugin || 'system';
                if (!result[plugin]) {
                    result[plugin] = [];
                }
                result[plugin].push(config);
            }

            return result;
        },

        pluginTabs: (state) => {
            const tabs: string[] = [];

            for (const config of state.configs) {
                const plugin = config.plugin || 'system';
                if (!tabs.includes(plugin)) {
                    tabs.push(plugin);
                }
            }

            return tabs.sort();
        },

        /**
         * Parse labeled drives configuration as object with error handling
         */
        labeledDrives: (state) => {
            const labeledDrivesConfig = state.configs.find(c => c.key === 'labeled_drives');
            if (!labeledDrivesConfig || !labeledDrivesConfig.value) {
                return {};
            }

            try {
                return JSON.parse(labeledDrivesConfig.value) as Record<string, string>;
            } catch {
                return {};
            }
        }
    },

    actions: {
        /**
         * Load configurations from API with fallback to defaults
         * Ensures required system configurations exist
         */
        async fetchConfigs() {
            this.loading = true;
            this.error = null;

            try {
                const data = await get('config', {
                    errorMessage: 'Failed to load settings',
                    showErrorNotification: false
                });

                if (Array.isArray(data) && data.length > 0) {
                    this.configs = data;
                } else {
                    this.configs = this.getDefaultConfigs();
                }

                // Ensure required configs exist
                await this.ensureRequiredConfigs();
            } catch (error) {
                this.error = 'Failed to load settings';

                if (this.configs.length === 0) {
                    this.configs = this.getDefaultConfigs();
                }
            } finally {
                this.loading = false;
            }

            return this.configs;
        },

        /**
         * Generate default system configurations
         */
        getDefaultConfigs(): ConfigEntry[] {
            const timestamp = "0";

            return [
                {
                    key: 'theme',
                    value: 'dark',
                    last_value: 'dark',
                    category: 'appearance',
                    system: 1,
                    created: timestamp,
                    modified: timestamp,
                    description: 'Application theme',
                    plugin: 'system',
                    type: 'text'
                },
                {
                    key: 'debug',
                    value: 'false',
                    last_value: 'false',
                    category: 'system',
                    system: 1,
                    created: timestamp,
                    modified: timestamp,
                    description: 'Enable debug mode',
                    plugin: 'system',
                    type: 'boolean'
                },
                {
                    key: 'labeled_drives',
                    value: '{}',
                    last_value: '{}',
                    category: 'storage',
                    system: 1,
                    created: timestamp,
                    modified: timestamp,
                    description: 'Custom labels for disk partitions by UUID',
                    plugin: 'system',
                    type: 'json'
                },
                {
                    key: 'led_board_type',
                    value: 'rpi4',
                    last_value: 'rpi4',
                    category: 'hardware',
                    system: 1,
                    created: timestamp,
                    modified: timestamp,
                    description: 'Selected LED board type for GPIO pin configuration',
                    plugin: 'system',
                    type: 'text'
                }
            ];
        },

        /**
         * Create missing required system configurations
         */
        async ensureRequiredConfigs() {
            // Ensure labeled_drives config exists
            const existingLabeledConfig = this.configs.find(c => c.key === 'labeled_drives');
            if (!existingLabeledConfig) {
                await this.createConfig({
                    key: 'labeled_drives',
                    value: '{}',
                    category: 'storage',
                    system: 1,
                    description: 'Custom labels for disk partitions by UUID',
                    plugin: 'system',
                    type: 'json'
                });
            }

            // Ensure LED board config exists
            const existingLEDConfig = this.configs.find(c => c.key === 'led_board_type');
            if (!existingLEDConfig) {
                await this.createConfig({
                    key: 'led_board_type',
                    value: 'rpi4',
                    category: 'hardware',
                    system: 1,
                    description: 'Selected LED board type for GPIO pin configuration',
                    plugin: 'system',
                    type: 'text'
                });
            }
        },

        /**
         * Update configuration value with optimistic updates and rollback on error
         */
        async updateConfig(key: string, value: string | number | boolean, last_value?: string) {
            this.loading = true;
            this.error = null;

            try {
                const index = this.configs.findIndex(c => c.key === key);

                if (index === -1) {
                    throw new Error(`Config with key ${key} not found`);
                }

                const config = this.configs[index];
                const originalValue = config.value;

                const updateData = {
                    key: config.key,
                    value: String(value),
                    last_value: last_value ? String(last_value) : config.value,
                    category: config.category,
                    system: config.system,
                    created: config.created,
                    modified: "0"
                };

                // Optimistic update
                this.configs[index] = {
                    ...config,
                    value: String(value),
                    last_value: last_value ? String(last_value) : config.value
                };

                const response = await post(`config/${key}`, updateData, {
                    successMessage: `Setting "${key}" updated successfully`,
                    errorMessage: `Failed to update setting "${key}"`,
                    showSuccessNotification: false
                });

                if (response && typeof response === 'object') {
                    this.configs[index] = response;
                }

            } catch (error) {
                this.error = 'Failed to update setting';

                // Rollback on error
                const index = this.configs.findIndex(c => c.key === key);
                if (index >= 0) {
                    const originalConfig = this.configs[index];
                    this.configs[index] = {
                        ...originalConfig,
                        value: originalConfig.last_value || originalConfig.value
                    };
                }

                throw error;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Create new configuration with fallback to local storage on API failure
         */
        async createConfig(configData: Partial<ConfigEntry>) {
            this.loading = true;
            this.error = null;

            try {
                if (!configData.key) {
                    throw new Error('Config key is required');
                }

                const newConfig: ConfigEntry = {
                    key: configData.key,
                    value: configData.value || '',
                    last_value: configData.last_value || configData.value || '',
                    category: configData.category || 'general',
                    system: configData.system === undefined ? 0 : configData.system,
                    created: configData.created || Date.now().toString(),
                    modified: configData.modified || Date.now().toString(),
                    description: configData.description || `Configuration for ${configData.key}`,
                    plugin: configData.plugin || 'system',
                    type: configData.type || (configData.value && configData.value.startsWith('{') ? 'json' : 'text')
                };

                try {
                    const response = await post(`config/${configData.key}`, newConfig, {
                        successMessage: `Setting "${configData.key}" created successfully`,
                        errorMessage: 'Failed to create setting',
                        showSuccessNotification: false
                    });

                    if (response && typeof response === 'object') {
                        const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                        if (existingIndex >= 0) {
                            this.configs[existingIndex] = response;
                        } else {
                            this.configs.push(response);
                        }
                        return response;
                    } else {
                        // Fallback to local storage
                        const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                        if (existingIndex >= 0) {
                            this.configs[existingIndex] = newConfig;
                        } else {
                            this.configs.push(newConfig);
                        }
                        return newConfig;
                    }
                } catch (apiError) {
                    // Store locally despite API error
                    const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                    if (existingIndex >= 0) {
                        this.configs[existingIndex] = newConfig;
                    } else {
                        this.configs.push(newConfig);
                    }
                    return newConfig;
                }
            } catch (error) {
                this.error = 'Failed to create setting';
                return null;
            } finally {
                this.loading = false;
            }
        },

        async deleteConfig(key: string) {
            this.loading = true;
            this.error = null;

            try {
                await del(`config/${key}`, {
                    successMessage: `Setting "${key}" deleted successfully`,
                    errorMessage: `Failed to delete setting "${key}"`,
                    showSuccessNotification: false
                });

                this.configs = this.configs.filter(c => c.key !== key);
            } catch (error) {
                this.error = 'Failed to delete setting';
                this.configs = this.configs.filter(c => c.key !== key);
            } finally {
                this.loading = false;
            }
        },

        validateJSON(value: string): boolean {
            try {
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
        },

        setJSONError(key: string, error: { error: boolean; message: string }) {
            this.jsonErrors = { ...this.jsonErrors, [key]: error };
        },

        /**
         * Validate and update JSON configuration with error tracking
         */
        async checkAndUpdateJSON(key: string, value: string, last_value?: string) {
            try {
                JSON.parse(value);
                this.setJSONError(key, { error: false, message: '' });
                return this.updateConfig(key, value, last_value);
            } catch {
                this.setJSONError(key, { error: true, message: 'Invalid JSON format' });
                throw new Error('Invalid JSON format');
            }
        },

        /**
         * Format JSON with proper indentation and validation
         */
        async formatJSON(key: string, value: string, last_value?: string) {
            try {
                const parsed = JSON.parse(value);
                const formatted = JSON.stringify(parsed, null, 2);
                this.setJSONError(key, { error: false, message: '' });
                return this.updateConfig(key, formatted, last_value);
            } catch {
                this.setJSONError(key, { error: true, message: 'Cannot format invalid JSON' });
                throw new Error('Cannot format invalid JSON');
            }
        },

        getDriveLabel(uuid: string): string | null {
            const labeledDrives = this.labeledDrives;
            return labeledDrives[uuid] || null;
        },

        /**
         * Set or remove drive label by UUID
         */
        async setDriveLabel(uuid: string, label: string) {
            const labeledDrives = { ...this.labeledDrives };

            if (label.trim() === '') {
                delete labeledDrives[uuid];
            } else {
                labeledDrives[uuid] = label.trim();
            }

            const newValue = JSON.stringify(labeledDrives);
            await this.updateConfig('labeled_drives', newValue);
        },

        async removeDriveLabel(uuid: string) {
            const labeledDrives = { ...this.labeledDrives };
            delete labeledDrives[uuid];

            const newValue = JSON.stringify(labeledDrives);
            await this.updateConfig('labeled_drives', newValue);
        },

        getLEDBoardType(): string {
            const ledBoardConfig = this.configs.find(c => c.key === 'led_board_type');
            return ledBoardConfig?.value || 'rpi4';
        },

        async setLEDBoardType(boardType: string) {
            const currentValue = this.getLEDBoardType();

            try {
                await this.updateConfig('led_board_type', boardType, currentValue);
            } catch (error) {
                throw error;
            }
        }
    }
});