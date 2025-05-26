<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePluginStore } from '@/stores/pluginsStore'
import type { Plugin, PluginStatus } from '@/types/plugins';
import {useNotificationStore} from "@/stores/notificationStore.ts";

const store = usePluginStore()
const notificationStore = useNotificationStore()

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const confirmDeleteDialog = ref(false)
const showEnvironmentDialog = ref(false)
const showAvailablePluginsDialog = ref(false)
const selectedPlugin = ref<Plugin | null>(null)
const loading = ref<Record<string, boolean>>({})
const environmentEntries = ref<any[]>([])
const newEnvironmentEntry = ref({ key: '', value: '' })

const availablePlugins = ref<Array<AvailablePlugin>>([])
const availablePluginsLoading = ref(false)
const availablePluginsError = ref<string | null>(null)

interface AvailablePlugin {
  name: string;
  version: string;
  plugin_type: string;
  repo: string;
  tag: string;
  source: string;
  added: string;
  updated: string;
  past_versions: any[];
}

async function fetchAvailablePlugins() {
  availablePluginsLoading.value = true
  availablePluginsError.value = null

  try {
    const plugins = await store.getAvailablePlugins()
    availablePlugins.value = plugins.map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      plugin_type: plugin.plugin_type,
      repo: plugin.repo,
      tag: plugin.tag,
      source: plugin.source,
      added: plugin.added,
      updated: plugin.updated,
      past_versions: plugin.past_versions || []
    }));
  } catch (error) {
    console.error('Failed to fetch available plugins:', error)
    availablePluginsError.value = 'Failed to load available plugins'

    notificationStore.notify('negative','Failed to load available plugins',{ icon: 'error'})
  } finally {
    availablePluginsLoading.value = false
  }
}

function adaptAvailablePluginToPlugin(availablePlugin: AvailablePlugin): Partial<Plugin> {
  return {
    name: availablePlugin.name,
    label: availablePlugin.name, // Using name as label
    plugin_type: availablePlugin.plugin_type,
    source: availablePlugin.source,
    repo: availablePlugin.repo,
    tag: availablePlugin.tag,
    version: availablePlugin.version
  };
}


// Function to prepare plugin from available list
function prepareAvailablePlugin(plugin: AvailablePlugin) {
  console.log('Preparing plugin:', plugin);

  if (!plugin || typeof plugin !== 'object') {
    console.error('Invalid plugin object:', plugin);
    return;
  }

  const adaptedPlugin = adaptAvailablePluginToPlugin(plugin);

  newPlugin.value = {
    name: adaptedPlugin.name || '',
    label: adaptedPlugin.label || '',
    plugin_type: (adaptedPlugin.plugin_type || 'Docker'),
    enabled: 1,
    install_dir: '',
    environment: 'production',
    source: adaptedPlugin.source || '',
    repo: adaptedPlugin.repo || '',
    tag: adaptedPlugin.tag || '',
    version: adaptedPlugin.version || '1.0.0',
    run_command: ''
  };
  console.log('Prepared plugin:', newPlugin.value);

  showAddDialog.value = true;
  showAvailablePluginsDialog.value = false;
}

// Form state for new plugin
const newPlugin = ref({
  name: '',
  plugin_type: '',
  enabled: 0,
  install_dir: '',
  environment: '',
  source: '',
  repo: '',
  tag: '',
  version: '1.0.0',
  label: ''
} as any)

// Form validation rules

const nameRules = [(val: string) => !!val || 'Name is required']
const typeRules = [(val: string) => !!val || 'Type is required']
const sourceRules = [(val: string) => !!val || 'Source is required']

// Plugin type options
const pluginTypes = [
  { label: 'Docker Container', value: 'docker' },
  { label: 'Rust Project', value: 'rustproject' },
  { label: 'File', value: 'file' },
  { label: 'Internal', value: 'internal' }
]

// Reset the form for adding a new plugin
function resetNewPluginForm() {
  newPlugin.value = {
    name: '',
    label: '',
    plugin_type: '',
    install_dir: '',
    environment: '',
    source: '',
    repo: '',
    tag: '',
    enabled: 0,
    version: '1.0.0',
    run_command: ''
  }
}

async function manageEnvironment(plugin: Plugin | null | undefined) {
  if (!plugin) return;
  selectedPlugin.value = plugin;

  try {
    loading.value[plugin.name] = true;
    const entries = await store.getPluginEnvironment(plugin.name);
    environmentEntries.value = entries || [];
    showEnvironmentDialog.value = true;
  } catch (error) {
    notificationStore.notify('negative','Failed to fetch environment variables',{ icon: 'error'})
  } finally {
    if (plugin.name) {
      loading.value[plugin.name] = false;
    }
  }
}

async function addEnvironmentEntry() {
  if (!selectedPlugin.value || !newEnvironmentEntry.value.key) return;

  try {
    const entry = {
      plugin_name: selectedPlugin.value.name,
      key: newEnvironmentEntry.value.key,
      value: newEnvironmentEntry.value.value
    };

    await store.setPluginEnvironmentValue(selectedPlugin.value.name, entry);

    const entries = await store.getPluginEnvironment(selectedPlugin.value.name);
    environmentEntries.value = entries || [];

    newEnvironmentEntry.value = { key: '', value: '' };

    notificationStore.notify('positive','Environment variable added successfully',{ icon: 'check_circle'})
  } catch (error) {
    notificationStore.notify('negative','Failed to add environment variable',{ icon: 'error'})
  }
}

// Delete environment variable
async function deleteEnvironmentEntry(key: string) {
  if (!selectedPlugin.value) return;

  try {
    await store.deletePluginEnvironmentValue(selectedPlugin.value.name, key);

    // Refresh environment variables
    const entries = await store.getPluginEnvironment(selectedPlugin.value.name);
    environmentEntries.value = entries || [];

    notificationStore.notify('positive','Environment variable deleted successfully',{ icon: 'check_circle'})
  } catch (error) {
    notificationStore.notify('negative','Failed to delete environment variable',{ icon: 'error'})
  }
}

// Confirm deletion dialog
function confirmDelete(plugin: Plugin | null | undefined) {
  if (!plugin) return;

  if (plugin.plugin_type ==  'System') {
    notificationStore.notify('info','System plugins cannot be deleted',{ icon: 'info'})
    return;
  }

  selectedPlugin.value = plugin;
  confirmDeleteDialog.value = true;
}

// Add a new plugin
async function addPlugin() {
  try {
    await store.addPlugin(newPlugin.value)
    showAddDialog.value = false
    resetNewPluginForm()

    notificationStore.notify('positive','Plugin added successfully',{ icon: 'check_circle'})
  } catch (error) {
    notificationStore.notify('negative','Failed to add plugin',{ icon: 'error'})
  }
}

// Delete a plugin
async function deletePlugin() {
  if (selectedPlugin.value) {
    try {
      if (selectedPlugin.value.plugin_type ==  'System') {
        notificationStore.notify('negative','Cannot delete System plugins',{ icon: 'error'})
        return
      }

      await store.deletePlugin(selectedPlugin.value.name)
      confirmDeleteDialog.value = false
      notificationStore.notify('positive','Plugin deleted successfully',{ icon: 'check_circle'})
    } catch (error) {
      let errorMessage = 'Failed to delete plugin'

      if (error instanceof Error && error.message.includes('System plugin')) {
        errorMessage = error.message
      }

      notificationStore.notify('negative',errorMessage,{ icon: 'error'})
    }
  }
}

// Toggle plugin enabled state
async function togglePlugin(plugin: Plugin | null | undefined) {
  if (!plugin || !plugin.name) return;

  try {
    loading.value[plugin.name] = true;
    await store.togglePlugin(plugin.name);

    notificationStore.notify('positive',`Plugin ${plugin.enabled ? 'disabled' : 'enabled'}`,{ icon: 'check_circle'})
  } catch (error) {
    let message = 'Failed to toggle plugin state';
    if (error instanceof Error) {
      message = error.message;
    }
    notificationStore.notify('negative',message,{ icon: 'error'})
  } finally {
    if (plugin.name) {
      loading.value[plugin.name] = false;
    }
  }
}

// Start plugin
async function startPlugin(plugin: Plugin | null | undefined) {
  if (!plugin || !plugin.name) return;

  try {
    loading.value[plugin.name] = true;
    await store.startPlugin(plugin.name);

    notificationStore.notify('positive',`Plugin ${plugin.name} started`,{ icon: 'check_circle'})

  } catch (error) {
    let message = 'Failed to start plugin';
    if (error instanceof Error) {
      message = error.message;
    }
    notificationStore.notify('negative',message,{ icon: 'error'})
  } finally {
    if (plugin.name) {
      loading.value[plugin.name] = false;
    }
  }
}

// Stop plugin
async function stopPlugin(plugin: Plugin | null | undefined) {
  if (!plugin || !plugin.name) return;

  if (plugin.plugin_type ==  'System') {
    notificationStore.notify('warning','System plugins cannot be stopped',{ icon: 'warning'})
    return;
  }

  try {
    loading.value[plugin.name] = true;
    await store.stopPlugin(plugin.name);
    notificationStore.notify('positive',`Plugin ${plugin.name} stopped`,{ icon: 'check_circle'})
  } catch (error) {
    let message = 'Failed to stop plugin';
    if (error instanceof Error) {
      message = error.message;
    }
    notificationStore.notify('negative',message,{ icon: 'error'})
  } finally {
    if (plugin.name) {
      loading.value[plugin.name] = false;
    }
  }
}

// Check for updates
async function checkForUpdates() {
  try {
    const updates = await store.checkForUpdates();
    if (updates && updates.length > 0) {
      notificationStore.notify('info',`${updates.length} plugin updates available`,{ icon: 'update'})
    } else {
      notificationStore.notify('positive','All plugins are up to date',{ icon: 'check_circle'})
    }
  } catch (error) {
    notificationStore.notify('negative','Failed to check for updates',{ icon: 'error'})
  }
}

// Refresh available plugins
async function refreshAvailablePlugins() {
  try {
    await store.refreshAvailablePlugins();
    // Refresh the local list of available plugins
    await fetchAvailablePlugins();

    notificationStore.notify('positive','Available plugins refreshed',{ icon: 'check_circle'})
  } catch (error) {
    notificationStore.notify('negative','Failed to refresh available plugins',{ icon: 'error'})
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()

    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)

    if (diffSecs < 60) {
      return 'just now'
    } else if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    } else if (diffDays < 30) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    } else if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
    } else {
      return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
    }
  } catch (e) {
    return dateStr
  }
}

const hasPlugins = computed(() => {
  const plugins = store.plugins;
  return plugins && Object.keys(plugins).length > 0;
});

const hasAvailablePlugins = computed(() => {
  return availablePlugins.value && availablePlugins.value.length > 0;
});

function getStatus(plugin: Plugin | null | undefined): PluginStatus | null {
  if (!plugin || !plugin.name) return null;
  return store.getPluginStatus(plugin.name);
}

function getStatusDisplay(plugin: Plugin | null | undefined) {
  if (!plugin) {
    return { label: 'Unknown', color: 'grey' };
  }

  const status = getStatus(plugin);

  if (!status) {
    return { label: 'Unknown', color: 'grey' };
  }

  if (status.running) {
    return { label: 'Running', color: 'positive' };
  }

  if (status.should_be_running) {
    return { label: 'Starting...', color: 'warning' };
  }

  if (plugin.enabled) {
    return { label: 'Stopped', color: 'warning' };
  }

  return { label: 'Disabled', color: 'grey' };
}

onMounted(() => {
  store.fetchPlugins();
  fetchAvailablePlugins();
})
</script>

<template>
  <q-page padding>
    <!-- Header -->
    <div class="row q-mb-md items-start">
      <!-- Main content column -->
      <div class="col-12 col-md-9 q-pr-md-md">
        <div class="row justify-between q-mb-md items-center">
          <div>
            <h5 class="q-mt-none q-mb-xs">Plugins</h5>
            <div class="text-caption text-grey-8">
              Total: {{ Object.keys(store.plugins).length }} (Store count: {{ store.pluginCount }}) |
              Running: {{ store.runningCount }} |
              Enabled: {{ store.enabledCount }}
            </div>
          </div>
          <div class="row q-gutter-sm">
            <q-btn color="info" icon="update" label="Check Updates" @click="checkForUpdates" />
            <q-btn color="secondary" icon="refresh" label="Refresh Available" @click="refreshAvailablePlugins" />
            <q-btn color="primary" icon="add" label="Add Plugin" @click="showAddDialog = true" />
            <q-btn color="info" icon="download" label="Browse Available" @click="showAvailablePluginsDialog = true" />
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="store.loading" class="row justify-center q-pa-md">
          <q-spinner color="primary" size="3em" />
        </div>

        <!-- Error state -->
        <div v-else-if="store.error" class="q-pa-md">
          <q-banner class="bg-negative text-white">
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            {{ store.error }}
            <template v-slot:action>
              <q-btn flat label="Retry" @click="store.fetchPlugins()" />
            </template>
          </q-banner>
        </div>

        <!-- Content loaded -->
        <div v-else>
          <!-- Plugin cards -->
          <template v-if="hasPlugins">
            <q-card v-for="plugin in Array.isArray(store.sortedPlugins)
          ? store.sortedPlugins
          : Object.values(store.sortedPlugins)"
                    :key="plugin?.name"
                    class="q-mb-md plugin-card">
              <q-card-section v-if="plugin">
                <div class="row justify-between items-center">
                  <div>
                    <div class="text-h6">{{ plugin?.name }}</div>
                    <div class="row items-center q-gutter-x-sm">
                      <q-badge v-if="plugin?.plugin_type ==  'System'" color="primary">
                        System
                      </q-badge>
                      <q-badge :color="getStatusDisplay(plugin).color">
                        {{ getStatusDisplay(plugin).label }}
                      </q-badge>
                      <span class="text-caption text-grey-7">
              {{ plugin?.plugin_type || 'N/A' }} •
              Added {{ formatDate(plugin?.added) }} •
              Last updated {{ formatDate(plugin?.updated) }}
              <template v-if="getStatus(plugin)?.running && getStatus(plugin)?.started">
                • Running since {{ formatDate(getStatus(plugin)?.started ?? null) }}
              </template>
            </span>
                    </div>
                  </div>
                  <div>
                    <q-btn-group flat>
                      <q-btn
                          :color="plugin?.enabled ? 'negative' : 'positive'"
                          :icon="plugin?.enabled ? 'power_settings_new' : 'play_arrow'"
                          :label="plugin?.enabled ? 'Disable' : 'Enable'"
                          @click="togglePlugin(plugin)"
                          :loading="loading[plugin?.name]"
                          flat
                          :disable="plugin?.plugin_type ==  'System' && !plugin?.enabled"
                      />
                      <q-btn
                          v-if="plugin?.enabled"
                          color="warning"
                          icon="stop"
                          label="Stop"
                          @click="stopPlugin(plugin)"
                          :loading="loading[plugin?.name]"
                          flat
                          :disable="plugin?.plugin_type ==  'System' || !getStatus(plugin)?.running"
                      />
                      <q-btn
                          v-if="plugin?.enabled && !getStatus(plugin)?.running"
                          color="positive"
                          icon="play_arrow"
                          label="Start"
                          @click="startPlugin(plugin)"
                          :loading="loading[plugin?.name]"
                          flat
                      />
                    </q-btn-group>
                  </div>
                </div>
              </q-card-section>

              <q-separator />

              <q-card-section>
                <div class="row q-col-gutter-md">
                  <div class="col-12 col-md-6">
                    <div class="row q-col-gutter-sm">
                      <!-- Installation details -->
                      <div class="col-12">
                        <q-item>
                          <q-item-section avatar>
                            <q-icon name="folder" color="primary" />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label caption>Install Directory</q-item-label>
                            <q-item-label>{{ plugin?.install_dir || 'Not specified' }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </div>

                      <!-- Environment -->
                      <div class="col-12">
                        <q-item>
                          <q-item-section avatar>
                            <q-icon name="settings" color="primary" />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label caption>Environment</q-item-label>
                            <q-item-label>{{ plugin?.environment || 'Default' }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </div>
                    </div>
                  </div>

                  <div class="col-12 col-md-6">
                    <div class="row q-col-gutter-sm">
                      <!-- Source information -->
                      <div class="col-12">
                        <q-item>
                          <q-item-section avatar>
                            <q-icon name="link" color="primary" />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label caption>Source</q-item-label>
                            <q-item-label>{{ plugin?.source || 'System' }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </div>

                      <!-- Repository information -->
                      <div v-if="plugin?.repo || plugin?.tag" class="col-12">
                        <q-item>
                          <q-item-section avatar>
                            <q-icon name="storage" color="primary" />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label caption>Repository/Tag</q-item-label>
                            <q-item-label>{{ [plugin?.repo, plugin?.tag].filter(Boolean).join(':') }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </div>
                    </div>
                  </div>
                </div>
              </q-card-section>

              <q-card-actions align="right">
                <q-btn flat color="info" icon="settings" @click="manageEnvironment(plugin)">
                  <q-tooltip>Manage environment variables</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    color="negative"
                    icon="delete"
                    @click="confirmDelete(plugin)"
                    :disable="plugin?.plugin_type ==  'System'"
                >
                  <q-tooltip>
                    {{ plugin?.plugin_type ==  'System' ? 'System plugins cannot be deleted' : 'Delete plugin' }}
                  </q-tooltip>
                </q-btn>
              </q-card-actions>
            </q-card>
          </template>

          <!-- Empty state -->
          <q-banner v-else class="bg-grey-3 text-center q-pa-lg">
            <q-icon name="extension" size="4em" class="q-mb-md text-grey-7" />
            <div class="text-h6">No plugins installed</div>
            <div class="q-mt-sm">
              Click the "Add Plugin" button to install your first plugin or browse available plugins to get started.
            </div>
            <div class="q-mt-md">
              <q-btn color="primary" icon="add" label="Add Plugin" @click="showAddDialog = true" class="q-mr-sm" />
              <q-btn color="info" icon="download" label="Browse Available" @click="showAvailablePluginsDialog = true" />
            </div>
          </q-banner>
        </div>
      </div>

      <!-- Sidebar with info -->
      <div class="col-12 col-md-3 q-pl-md">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Plugin Repository</div>
<!--            <div class="text-caption">Browse and install plugins</div>-->
          </q-card-section>

          <q-card-section>
<!--            <p class="q-mb-md">Plugins extend your system with additional functionality.</p>-->
            <q-btn
                color="primary"
                icon="download"
                label="Browse Available Plugins"
                class="full-width"
                @click="showAvailablePluginsDialog = true"
            />
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section class="bg-grey-3">
            <div class="text-h6">Plugin Info</div>
          </q-card-section>

          <q-card-section>
            <p>Plugins extend your system with additional functionality.</p>
            <p>System plugins are part of the core system and cannot be removed.</p>
            <p>Docker plugins run in containers and can be started/stopped independently.</p>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Add Plugin Dialog -->
    <q-dialog v-model="showAddDialog">
      <q-card style="min-width: 500px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Add Plugin</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="addPlugin" class="q-gutter-md">
            <q-input
                v-model="newPlugin.name"
                label="Name"
                :rules="nameRules"
                outlined
                stack-label
                dense
            />

            <q-select
                v-model="newPlugin.plugin_type"
                :options="pluginTypes"
                label="Type"
                :rules="typeRules"
                outlined
                stack-label
                dense
                map-options
                emit-value
            />

            <q-input
                v-model="newPlugin.install_dir"
                label="Install Directory"
                outlined
                stack-label
                dense
            />

            <q-input
                v-model="newPlugin.environment"
                label="Environment"
                outlined
                stack-label
                dense
            />

            <q-input
                v-model="newPlugin.source"
                label="Source"
                :rules="sourceRules"
                outlined
                stack-label
                dense
            />

            <q-input
                v-model="newPlugin.repo"
                label="Repository"
                outlined
                stack-label
                dense
            />

            <q-input
                v-model="newPlugin.tag"
                label="Tag"
                outlined
                stack-label
                dense
            />
          </q-form>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-1">
          <q-btn flat label="Cancel" v-close-popup @click="resetNewPluginForm" />
          <q-btn color="primary" label="Add" @click="addPlugin" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="confirmDeleteDialog">
      <q-card>
        <q-card-section class="bg-negative text-white">
          <div class="text-h6">Delete Plugin</div>
        </q-card-section>

        <q-card-section v-if="selectedPlugin">
          <p>Are you sure you want to delete plugin <strong>{{ selectedPlugin.name }}</strong>?</p>
          <p class="text-negative">This action cannot be undone.</p>

          <div v-if="getStatus(selectedPlugin)?.running" class="text-warning q-mt-md">
            <q-icon name="warning" />
            This plugin is currently running. It will be stopped before deletion.
          </div>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-1">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="negative" label="Delete" @click="deletePlugin" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Environment Variables Dialog -->
    <q-dialog v-model="showEnvironmentDialog">
      <q-card style="min-width: 700px; max-width: 90vw">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Environment Variables</div>
          <div class="text-caption" v-if="selectedPlugin">
            {{ selectedPlugin.name }}
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-mb-md items-center">
            <div class="col">
              <div class="text-subtitle1">Current Variables</div>
            </div>
            <div class="col-auto">
              <q-btn color="primary" icon="add" label="Add Variable" size="sm" @click="newEnvironmentEntry = { key: '', value: '' }" />
            </div>
          </div>

          <!-- No environment variables yet -->
          <q-banner v-if="!environmentEntries.length" class="bg-grey-3 text-center q-pa-md">
            <q-icon name="info" size="2em" class="q-mb-sm text-grey-7" />
            <div>No environment variables set for this plugin.</div>
          </q-banner>

          <!-- List of environment variables -->
          <q-list v-else bordered separator>
            <q-item v-for="entry in environmentEntries" :key="entry.key">
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ entry.key }}</q-item-label>
                <q-item-label caption>{{ entry.value }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round color="negative" icon="delete" @click="deleteEnvironmentEntry(entry.key)">
                  <q-tooltip>Delete variable</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Add new variable form -->
          <div v-if="newEnvironmentEntry.key !== undefined" class="q-mt-md">
            <div class="text-subtitle1 q-mb-sm">Add New Variable</div>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-5">
                <q-input
                    v-model="newEnvironmentEntry.key"
                    label="Key"
                    outlined
                    dense
                    autofocus
                />
              </div>
              <div class="col-12 col-sm-5">
                <q-input
                    v-model="newEnvironmentEntry.value"
                    label="Value"
                    outlined
                    dense
                />
              </div>
              <div class="col-12 col-sm-2">
                <q-btn
                    color="primary"
                    icon="save"
                    label="Save"
                    class="full-width"
                    :disable="!newEnvironmentEntry.key"
                    @click="addEnvironmentEntry"
                />
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-1">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Available Plugins Dialog -->
    <q-dialog v-model="showAvailablePluginsDialog">
      <q-card style="width: 900px; max-width: 90vw">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Available Plugins</div>
          <div class="text-caption">
            Browse and install plugins from the official repository
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-mb-md items-center">
            <div class="col">
              <div class="text-subtitle1">Plugin Repository</div>
            </div>
            <div class="col-auto">
              <q-btn color="secondary" icon="refresh" label="Refresh" size="sm" @click="refreshAvailablePlugins" :loading="availablePluginsLoading" />
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="availablePluginsLoading" class="row justify-center q-pa-md">
            <q-spinner color="primary" size="3em" />
          </div>

          <!-- Error state -->
          <div v-else-if="availablePluginsError" class="q-pa-md">
            <q-banner class="bg-negative text-white">
              <template v-slot:avatar>
                <q-icon name="error" />
              </template>
              {{ availablePluginsError }}
              <template v-slot:action>
                <q-btn flat label="Retry" @click="fetchAvailablePlugins()" />
              </template>
            </q-banner>
          </div>

          <!-- No available plugins -->
          <q-banner v-else-if="!hasAvailablePlugins" class="bg-grey-3 text-center q-pa-md">
            <q-icon name="info" size="2em" class="q-mb-sm text-grey-7" />
            <div>No plugins available in the repository.</div>
            <div class="q-mt-sm">
              <q-btn color="secondary" icon="refresh" label="Refresh" @click="refreshAvailablePlugins" />
            </div>
          </q-banner>

          <!-- List of available plugins -->
          <div v-else>
            <q-list bordered separator>
              <q-item
                  v-for="plugin in availablePlugins"
                  :key="`${plugin.name}-${plugin.version}`"
                  clickable
                  @click="prepareAvailablePlugin(plugin)"
              >
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ plugin.name }}</q-item-label>
                  <q-item-label caption>
                    <div class="row items-center">
                      <q-icon name="label" size="xs" class="q-mr-xs" />
                      Version: {{ plugin.version }}
                    </div>
                    <div class="row items-center">
                      <q-icon name="category" size="xs" class="q-mr-xs" />
                      Type: {{ plugin.plugin_type }}
                    </div>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="text-grey-8 text-caption q-mr-md text-right">
                    Updated: {{ formatDate(plugin.updated) }}
                  </div>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round color="positive" icon="add">
                    <q-tooltip>Install plugin</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="bg-grey-1">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.plugin-card {
  transition: all 0.3s ease;
}

.plugin-card:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
}
</style>