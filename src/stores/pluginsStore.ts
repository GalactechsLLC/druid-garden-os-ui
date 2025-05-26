import {computed} from 'vue'
import {defineStore} from 'pinia'
import type {Plugin, PluginStatus} from "@/types/plugins.ts";
import {del, get, post, put} from "@/utils/api.ts";

export const usePluginStore = defineStore('plugins', {
    state: () => ({
        plugins: {} as Record<string, Plugin>,
        pluginStatus: {} as Record<string, PluginStatus>,
        loading: false,
        error: null as string | null
    }),

    getters: {
        sortedPlugins: (state) => {
            if (!state.plugins || Object.keys(state.plugins).length === 0) {
                return {};
            }

            const validEntries = Object.entries(state.plugins)
                .filter(([_, plugin]) => {
                    const isValid = plugin && typeof plugin === 'object' && plugin.name;
                    if (!isValid) {
                        console.warn('Found invalid plugin entry:', plugin);
                    }
                    return isValid;
                });

            return validEntries
                .sort(([a], [b]) => a.localeCompare(b))
                .reduce((acc, [key, value]) => ({...acc, [key]: value}), {});
        },

        enabledPlugins: (state) => {
            return Object.values(state.plugins).filter(plugin => plugin.enabled === 1);
        },

        runningPlugins: (state) => {
            return Object.keys(state.pluginStatus)
                .filter(name => state.pluginStatus[name]?.running)
                .map(name => state.plugins[name])
                .filter(plugin => !!plugin);
        },

        pluginCount: (state) => computed(() => {
            if (!state.plugins || typeof state.plugins !== 'object') {
                return 0;
            }
            return Object.keys(state.plugins).filter(key => !!state.plugins[key]).length;
        }),

        enabledCount: (state) => computed(() => {
            if (!state.plugins || typeof state.plugins !== 'object') {
                return 0;
            }
            return Object.values(state.plugins)
                .filter(p => p && p.enabled === 1)
                .length;
        }),

        runningCount: (state) => computed(() => {
            if (!state.pluginStatus || typeof state.pluginStatus !== 'object') {
                return 0;
            }
            return Object.values(state.pluginStatus)
                .filter(s => s && s.running)
                .length;
        }),

        builtInPlugins: (state) => computed(() => {
            return Object.values(state.plugins).filter(plugin => {
                const status = state.pluginStatus[plugin.name]
                return plugin.plugin_type ==  'System' ||
                    (status && status.running && status.should_be_running && !plugin.source)
            })
        })
    },

    actions: {
        async fetchPlugins() {
            this.loading = true;
            this.error = null;

            try {
                const response = await get('/api/plugins', {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                // Debug output
                console.log('API Response:', response);
                console.log('Response type:', typeof response);
                console.log('Is array?', Array.isArray(response));

                // Reset the store
                this.plugins = {};
                this.pluginStatus = {};

                if (!response) {
                    console.log('No response from API');
                    return;
                }

                if (typeof response === 'string' && response.includes('<!DOCTYPE html>')) {
                    console.error('Received HTML instead of JSON');
                    this.error = 'API returned invalid data format. Please check the API endpoint.';
                    return;
                }

                let processedPlugins = {};

                if (Array.isArray(response)) {
                    console.log('Processing array response');
                    processedPlugins = response.reduce((acc, plugin) => {
                        if (plugin && plugin.name) {
                            acc[plugin.name] = plugin;
                        }
                        return acc;
                    }, {});
                } else if (typeof response === 'object') {
                    console.log('Processing object response');
                    processedPlugins = Object.entries(response).reduce((acc, [key, value]) => {
                        if (value && typeof value === 'object' && 'name' in value) {
                            (acc as any)[key] = value;
                        }
                        return acc;
                    }, {});
                }

                console.log('Processed plugins:', processedPlugins);
                console.log('Number of processed plugins:', Object.keys(processedPlugins).length);

                this.plugins = processedPlugins;

                for (const [name, plugin] of Object.entries(this.plugins)) {
                    if (plugin && plugin.name) {
                        try {
                            await this.fetchPluginStatus(name);
                        } catch (statusError) {
                            console.warn(`Failed to fetch status for plugin '${name}':`, statusError);
                            this.pluginStatus[name] = {
                                running: false,
                                should_be_running: false,
                                started: null
                            };
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch plugins:', error);
                this.error = 'Failed to load plugins. Please check the API connection.';
                this.plugins = {};
            } finally {
                this.loading = false;
            }
        },

        async fetchPluginStatus(name: string) {
            try {
                const encodedName = encodeURIComponent(name);

                const status = await get(`/api/plugins/${encodedName}/status`)
                this.pluginStatus[name] = status

                if (status.running && status.should_be_running && !this.plugins[name]?.source) {
                    if (this.plugins[name]) {
                        this.plugins[name].plugin_type =  'System'
                    }
                }

                return status
            } catch (error) {
                console.error(`Failed to fetch status for plugin '${name}':`, error)
                this.pluginStatus[name] = {
                    running: false,
                    should_be_running: false,
                    started: null
                };
                return null
            }
        },

        async togglePlugin(name: string) {
            const plugin = this.plugins[name]

            if (!plugin) {
                throw new Error(`Plugin '${name}' not found`)
            }

            try {
                const newState = plugin.enabled ? 0 : 1
                await put(`/api/plugins`, {...plugin, enabled: newState})

                plugin.enabled = newState

                if (newState === 1) {
                    await this.startPlugin(name)
                } else {
                    await this.stopPlugin(name)
                }

                return true
            } catch (error) {
                console.error('Failed to toggle plugin:', error)
                throw error
            }
        },

        async startPlugin(name: string) {
            try {
                await post(`/api/plugins/${name}/start`, {}, {})

                await this.fetchPluginStatus(name)
                return true
            } catch (error) {
                console.error(`Failed to start plugin '${name}':`, error)
                throw error
            }
        },

        async stopPlugin(name: string) {
            const plugin = this.plugins[name]

            if (plugin?.plugin_type ==  'System') {
                throw new Error(`Cannot stop System plugin '${name}'`)
            }

            try {
                await post(`/api/plugins/${name}/stop`, {}, {})

                await this.fetchPluginStatus(name)
                return true
            } catch (error) {
                console.error(`Failed to stop plugin '${name}':`, error)
                throw error
            }
        },

        async addPlugin(plugin: Partial<Plugin>) {
            try {
                const submittedPlugin = {
                    ...plugin,
                    plugin_type: plugin.plugin_type ?
                        plugin.plugin_type.charAt(0).toUpperCase() + plugin.plugin_type.slice(1) :
                        'Docker'
                };

                const response = await post('/api/plugins', submittedPlugin)
                await this.fetchPlugins()
                return response
            } catch (error) {
                console.error('Failed to add plugin:', error)
                throw error
            }
        },

        async updatePlugin(plugin: Plugin) {
            try {
                const response = await put('/api/plugins', plugin, {})

                await this.fetchPlugins()

                return response
            } catch (error) {
                console.error('Failed to update plugin:', error)
                throw error
            }
        },

        async deletePlugin(name: string) {
            const plugin = this.plugins[name]

            if (!plugin) {
                throw new Error(`Plugin '${name}' not found`)
            }

            if (plugin.plugin_type ==  'System') {
                throw new Error(`Cannot delete System plugin '${name}'`)
            }

            try {
                const status = this.pluginStatus[name]
                if (status && status.running) {
                    await this.stopPlugin(name)
                }

                const response = await del(`/api/plugins/${name}`, {})
                await this.fetchPlugins()

                return response
            } catch (error) {
                console.error('Failed to delete plugin:', error)
                throw error
            }
        },

        async getPluginEnvironment(name: string) {
            try {
                return await get(`/api/plugins/${name}/env`)
            } catch (error) {
                console.error(`Failed to fetch environment for plugin '${name}':`, error)
                throw error
            }
        },

        async setPluginEnvironmentValue(pluginName: string, envEntry: any) {
            try {
                return await post(`/api/plugins/${pluginName}/env`, envEntry, {})
            } catch (error) {
                console.error(`Failed to set environment variable for plugin '${pluginName}':`, error)
                throw error
            }
        },

        async deletePluginEnvironmentValue(pluginName: string, key: string) {
            try {
                return await del(`/api/plugins/${pluginName}/env/${key}`, {})
            } catch (error) {
                console.error(`Failed to delete environment variable for plugin '${pluginName}':`, error)
                throw error
            }
        },

        getPlugin(name: string): Plugin | null {
            return this.plugins[name] || null
        },

        getPluginStatus(name: string): PluginStatus | null {
            return this.pluginStatus[name] || null
        },

        async checkForUpdates() {
            try {
                return await post('/api/plugins/updates', {},{})
            } catch (error) {
                console.error('Failed to check for plugin updates:', error)
                throw error
            }
        },

        async refreshAvailablePlugins() {
            try {
                return await post('/api/plugins/refresh', {}, {})
            } catch (error) {
                console.error('Failed to refresh available plugins:', error)
                throw error
            }
        },

        // Get available plugins
        async getAvailablePlugins() {
            try {
                const available = await post('/api/plugins/available', {},{});
                console.log('Available plugins response:', available);

                if (Array.isArray(available)) {
                    return available.map(plugin => ({
                        name: plugin.name || 'Unknown Plugin',
                        version: plugin.version || '1.0.0',
                        plugin_type: plugin.plugin_type || (plugin.p_type || ''),
                        repo: plugin.repo || '',
                        tag: plugin.tag || '',
                        source: plugin.source || '',
                        added: plugin.added || new Date().toISOString(),
                        updated: plugin.updated || new Date().toISOString(),
                        past_versions: plugin.past_versions || []
                    }));
                }

                return [];
            } catch (error) {
                console.error('Failed to get available plugins:', error);
                throw error;
            }
        },

        resetState() {
            this.plugins = {}
            this.pluginStatus = {}
            this.loading = false
            this.error = null
        }
    }
})