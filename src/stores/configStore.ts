import { defineStore } from 'pinia';
import { get, post, del } from '@/utils/api';
import type {ConfigEntry} from "@/types/settings.ts";

export const useConfigStore = defineStore('config', {
    state: () => ({
        configs: [] as ConfigEntry[],
        loading: false,
        error: null as string | null,
        jsonErrors: {} as Record<string, { error: boolean; message: string }>
    }),

    getters: {
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
        }
    },

    actions: {
        async fetchConfigs() {
            this.loading = true;
            this.error = null;

            try {
                console.log("Fetching configs from API");
                const data = await get('config', {
                    errorMessage: 'Failed to load settings',
                    showErrorNotification: false
                });

                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Loaded ${data.length} configs from API`);

                    const bookmarkConfig = data.find(c => c.key === 'bookmarks');
                    if (bookmarkConfig) {
                        console.log("Found bookmark config in API response:",
                            bookmarkConfig.key, bookmarkConfig.value?.substring(0, 100));
                    } else {
                        console.log("No bookmark config found in API response");
                    }

                    this.configs = data;
                } else {
                    console.log("No configs returned from API, using defaults");
                    this.configs = this.getDefaultConfigs();
                }
            } catch (error) {
                console.error('Error fetching configs:', error);
                this.error = 'Failed to load settings';

                if (this.configs.length === 0) {
                    this.configs = this.getDefaultConfigs();
                }
            } finally {
                this.loading = false;
            }

            return this.configs;
        },

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
                }
            ];
        },

        async updateConfig(key: string, value: string | number | boolean, last_value?: string) {
            this.loading = true;
            this.error = null;

            try {
                const index = this.configs.findIndex(c => c.key === key);

                if (index === -1) {
                    throw new Error(`Config with key ${key} not found`);
                }

                const config = this.configs[index];

                const updateData = {
                    key: config.key,
                    value: String(value),
                    last_value: last_value ? String(last_value) : config.value,
                    category: config.category,
                    system: config.system,
                    created: config.created,
                    modified: "0"
                };

                const response = await post(`config/${key}`, updateData, {
                    successMessage: `Setting "${key}" updated successfully`,
                    errorMessage: `Failed to update setting "${key}"`,
                    showSuccessNotification: false
                });

                if (response && typeof response === 'object') {
                    this.configs[index] = response;
                } else {
                    this.configs[index] = {
                        ...config,
                        value: String(value),
                        last_value: last_value ? String(last_value) : config.value
                    };
                }
            } catch (error) {
                console.error('Error updating config:', error);
                this.error = 'Failed to update setting';

                const index = this.configs.findIndex(c => c.key === key);
                if (index >= 0) {
                    const config = this.configs[index];
                    this.configs[index] = {
                        ...config,
                        value: String(value),
                        last_value: last_value ? String(last_value) : config.value
                    };
                }
            } finally {
                this.loading = false;
            }
        },

        async createConfig(configData: Partial<ConfigEntry>) {
            this.loading = true;
            this.error = null;

            try {
                if (!configData.key) {
                    throw new Error('Config key is required');
                }

                console.log(`Creating config "${configData.key}"`, configData);

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
                    console.log(`Sending API request to create config ${configData.key}`, newConfig);
                    const response = await post(`config/${configData.key}`, newConfig, {
                        successMessage: `Setting "${configData.key}" created successfully`,
                        errorMessage: 'Failed to create setting',
                        showSuccessNotification: false
                    });

                    if (response && typeof response === 'object') {
                        console.log(`Config "${configData.key}" created successfully:`, response);
                        const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                        if (existingIndex >= 0) {
                            this.configs[existingIndex] = response;
                        } else {
                            this.configs.push(response);
                        }
                        return response;
                    } else {
                        console.warn(`API returned non-object response for config "${configData.key}"`, response);
                        const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                        if (existingIndex >= 0) {
                            this.configs[existingIndex] = newConfig;
                        } else {
                            this.configs.push(newConfig);
                        }
                        return newConfig;
                    }
                } catch (apiError) {
                    console.error(`API error creating config "${configData.key}":`, apiError);
                    console.log(`Adding config "${configData.key}" locally despite API error`);
                    const existingIndex = this.configs.findIndex(c => c.key === configData.key);
                    if (existingIndex >= 0) {
                        this.configs[existingIndex] = newConfig;
                    } else {
                        this.configs.push(newConfig);
                    }
                    return newConfig;
                }
            } catch (error) {
                console.error('Error in createConfig method:', error);
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
                console.error('Error deleting config:', error);
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
        }
    }
});