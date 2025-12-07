<template>
  <div class="farmer-config-popup">
    <q-dialog v-model="showModal" maximized persistent>
      <q-card class="config-modal">
        <q-bar class="bg-primary text-white">
          <div class="text-h6">Farmer Configuration</div>
          <q-space />
          <q-btn dense flat icon="close" @click="cancelModal" :disable="saving">
            <q-tooltip>Close</q-tooltip>
          </q-btn>
        </q-bar>

        <q-card-section>
          <q-stepper
              v-model="step"
              ref="stepper"
              header-nav
              color="primary"
              animated
              flat
              :contracted="$q.screen.lt.md"
          >
            <q-step :name="1" title="Authentication" icon="lock" :done="step > 1">
              <!-- Existing config editor if config exists -->
              <div v-if="hasExistingConfig" class="existing-config-editor q-pa-md">
                <div class="text-h6 q-mb-md">Edit Existing Configuration</div>
                <div class="text-body2 q-mb-md text-blue-8">
                  <q-icon name="info" class="q-mr-sm" />
                  An existing farmer configuration was found in the database. You can edit it directly below.
                </div>

                <q-input
                    v-model="existingConfigJson"
                    type="textarea"
                    outlined
                    autogrow
                    class="json-textarea"
                    placeholder="Edit your JSON configuration here..."
                    rows="20"
                    :disable="saving"
                />

                <div class="row q-gutter-sm q-mt-lg">
                  <q-btn
                      color="primary"
                      label="Save and Test Configuration"
                      icon="save"
                      :loading="saving"
                      @click="saveExistingConfigAndTest"
                      :disable="saving || !existingConfigJson.trim()"
                  />
                  <q-btn
                      outline
                      color="grey"
                      label="Start Fresh Setup"
                      @click="startFreshSetup"
                      :disable="saving"
                  />
                </div>
              </div>

              <!-- Original authentication methods (shown when no config exists in database or user chooses fresh setup) -->
              <div v-else class="auth-methods q-pa-md">
                <div class="q-mb-md">
                  <div class="text-h6">Choose an authentication method</div>
                  <div class="text-caption text-grey-6">
                    (note: Evergreen users should scan for legacy config after mounting drives)
                  </div>
                </div>

                <q-tabs
                    v-model="authMethod"
                    class="text-primary q-mb-lg"
                    align="left"
                    indicator-color="primary"
                    active-color="primary"
                    dense
                >
                  <q-tab name="mnemonic" label="Mnemonic (24 words)" />
                  <q-tab name="scan" label="Scan for Legacy Config" />
                  <q-tab name="yaml" label="YAML Config" />
                </q-tabs>

                <q-tab-panels v-model="authMethod" animated>
                  <!-- Mnemonic Authentication -->
                  <q-tab-panel name="mnemonic">
                    <div class="text-h6 q-mb-md">Enter your 24-word mnemonic</div>
                    <div class="text-body2 q-mb-md text-orange-8">
                      <q-icon name="info" class="q-mr-sm" />
                      This process may take some time. Please be patient while we set up your configuration.
                    </div>
                    <q-input
                        v-model="mnemonicInput"
                        type="textarea"
                        outlined
                        autogrow
                        placeholder="Enter your 24-word mnemonic phrase..."
                        hint="This is your 24-word recovery phrase"
                        :rules="[val => val && val.trim().split(/\s+/).length === 24 || 'Please enter all 24 words']"
                        :disable="saving"
                    />
                  </q-tab-panel>

                  <!-- Scan for Legacy Config -->
                  <q-tab-panel name="scan">
                    <div class="text-h6 q-mb-md">Scan for Legacy Configuration</div>
                    <div class="text-body1 q-mb-md">
                      Scan mounted drives for legacy Chia configuration files (preload.pconf).
                    </div>

                    <div class="text-body2 q-mb-md text-orange-8">
                      <q-icon name="schedule" class="q-mr-sm" />
                      Drive scanning may take several minutes depending on the number of mounted drives. Please be patient.
                    </div>

                    <div class="scan-info-container q-mb-md">
                      <q-card flat bordered class="q-pa-md">
                        <div class="text-subtitle2">How This Works</div>
                        <p>This scan will:</p>
                        <ul>
                          <li>Check all mounted drives for <code>preload.pconf</code> files</li>
                          <li>Import launcher IDs and mnemonics from these files</li>
                          <li>Skip configs that are already in your current configuration</li>
                          <li>Add any new configurations to your farmer setup</li>
                        </ul>
                      </q-card>
                    </div>

                    <div class="scan-actions q-mb-md">
                      <q-btn
                          color="primary"
                          icon="search"
                          label="Scan Drives for Config"
                          @click="scanForLegacyConfig"
                          :loading="scanning"
                          :disable="saving || scanning"
                      />
                    </div>

                    <div v-if="scanResults.length > 0" class="scan-results q-mt-md">
                      <div class="text-subtitle2">Found Configurations</div>
                      <q-list bordered separator>
                        <q-item v-for="(result, index) in scanResults" :key="index">
                          <q-item-section>
                            <q-item-label>Launcher ID: {{ result.launcherId }}</q-item-label>
                            <q-item-label caption>Found on: {{ result.mountPath }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </div>

                    <div v-if="scanComplete && scanResults.length === 0" class="q-mt-md">
                      <q-banner class="bg-grey-3">
                        <template v-slot:avatar>
                          <q-icon name="info" color="primary" />
                        </template>
                        No legacy configuration files found on mounted drives.
                      </q-banner>
                    </div>
                  </q-tab-panel>

                  <!-- YAML Config Import -->
                  <q-tab-panel name="yaml">
                    <div class="text-h6 q-mb-md">Import YAML Configuration</div>

                    <q-tabs v-model="yamlImportMethod" class="q-mb-md">
                      <q-tab name="paste" label="Paste YAML" />
                      <q-tab name="upload" label="Upload File" />
                    </q-tabs>

                    <q-tab-panels v-model="yamlImportMethod" animated>
                      <!-- Paste YAML -->
                      <q-tab-panel name="paste">
                        <q-input
                            v-model="yamlConfig"
                            type="textarea"
                            outlined
                            autogrow
                            class="yaml-textarea"
                            placeholder="Paste your YAML configuration here..."
                            rows="12"
                            :disable="saving"
                        />
                      </q-tab-panel>

                      <!-- Upload YAML File -->
                      <q-tab-panel name="upload">
                        <q-file
                            v-model="yamlFile"
                            outlined
                            label="YAML Configuration File"
                            hint="Upload your existing farmer configuration file"
                            accept=".yaml,.yml,.json"
                            :disable="saving"
                        >
                          <template v-slot:prepend>
                            <q-icon name="attach_file" />
                          </template>
                        </q-file>

                        <div v-if="yamlFile" class="yaml-preview q-mt-md">
                          <div class="text-subtitle2">File Preview</div>
                          <q-card flat bordered class="q-pa-md">
                            <pre class="yaml-content">{{ yamlFilePreview }}</pre>
                          </q-card>
                        </div>
                      </q-tab-panel>
                    </q-tab-panels>

                    <!-- Import and Continue Button for YAML -->
                    <div class="row q-gutter-sm q-mt-lg">
                      <q-btn
                          color="primary"
                          label="Import and Continue"
                          :loading="saving"
                          @click="importYamlAndContinue"
                          :disable="saving || !canAuthenticate"
                      />
                    </div>
                  </q-tab-panel>
                </q-tab-panels>

                <div class="q-mt-lg" v-if="authMethod !== 'yaml'">
                  <q-btn
                      color="primary"
                      label="Continue"
                      :loading="saving"
                      @click="authenticate"
                      :disable="!canAuthenticate"
                  />
                </div>
              </div>
            </q-step>

            <q-step :name="2" title="Payout Settings" icon="payments" :done="step > 2">
              <div class="payout-settings q-pa-md">
                <div class="text-h6 q-mb-md">Set your payout address</div>
                <div class="row q-col-gutter-md">
                  <div class="col-12">
                    <q-input
                        v-model="payoutAddress"
                        outlined
                        label="Payout Address"
                        placeholder="xch..."
                        hint="The address where your farming rewards will be sent"
                        :rules="[val => !!val || 'Payout address is required']"
                        :disable="saving"
                    />
                  </div>
                </div>

                <div class="row q-gutter-sm q-mt-lg">
                  <q-btn
                      outline
                      color="grey"
                      label="Back"
                      icon="arrow_back"
                      @click="step = 1"
                      :disable="saving"
                  />
                  <q-btn
                      color="primary"
                      label="Continue"
                      icon-right="arrow_forward"
                      @click="savePayoutAddress"
                      :disable="!payoutAddress || saving"
                  />
                </div>
              </div>
            </q-step>

            <q-step :name="3" title="Connection Settings" icon="settings" :done="step > 3">
              <div class="connection-settings q-pa-md">
                <div class="text-h6 q-mb-md">Configure Fullnode Connection</div>
                <div class="row q-col-gutter-md">
                  <div class="col-12">
                    <div class="row q-col-gutter-sm">
                      <div class="col-12 col-md-6">
                        <q-input
                            label="WebSocket Host"
                            v-model="farmerConfig.fullnode_ws_host"
                            outlined
                            hint="Domain for WebSocket connection"
                            placeholder="druid.garden"
                            :disable="saving"
                        />
                      </div>
                      <div class="col-12 col-md-6">
                        <q-input
                            label="WebSocket Port"
                            v-model.number="farmerConfig.fullnode_ws_port"
                            type="number"
                            outlined
                            hint="Default: 443"
                            :disable="saving"
                        />
                      </div>
                      <div class="col-12 col-md-6">
                        <q-input
                            label="RPC Host"
                            v-model="farmerConfig.fullnode_rpc_host"
                            outlined
                            hint="Domain for RPC connection"
                            placeholder="druid.garden"
                            :disable="saving"
                        />
                      </div>
                      <div class="col-12 col-md-6">
                        <q-input
                            label="RPC Port"
                            v-model.number="farmerConfig.fullnode_rpc_port"
                            type="number"
                            outlined
                            hint="Default: 443"
                            :disable="saving"
                        />
                      </div>
                      <div class="col-12">
                        <q-btn
                            color="primary"
                            label="Set to druid.garden"
                            @click="setDefaultNode"
                            class="q-mr-sm"
                            :disable="saving"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="col-12">
                    <div class="text-h6 q-mt-md q-mb-sm">Plot Directories</div>
                    <div v-for="(dir, index) in plotDirectories" :key="index" class="row q-col-gutter-sm q-mb-sm">
                      <div class="col">
                        <q-input
                            v-model="plotDirectories[index]"
                            outlined
                            dense
                            label="Directory Path"
                            :disable="saving"
                        />
                      </div>
                      <div class="col-auto">
                        <q-btn
                            color="negative"
                            icon="delete"
                            flat
                            dense
                            @click="removePlotDirectory(index)"
                            :disable="saving || plotDirectories.length <= 1"
                        />
                      </div>
                    </div>
                    <q-btn
                        color="positive"
                        icon="add"
                        label="Add Plot Directory"
                        class="q-mt-sm"
                        @click="addPlotDirectory"
                        :disable="saving"
                    />
                  </div>

                  <div class="col-12">
                    <div class="text-h6 q-mt-md q-mb-sm">Recompute Settings</div>

                    <div class="row q-col-gutter-sm">
                      <div class="col-12 col-md-6">
                        <q-input
                            label="Recompute Host"
                            v-model="recomputeHost"
                            outlined
                            :disable="saving"
                        />
                      </div>

                      <div class="col-12 col-md-6">
                        <q-input
                            label="Recompute Port"
                            v-model.number="recomputePort"
                            type="number"
                            outlined
                            placeholder="0"
                            :disable="saving"
                        />
                      </div>

                      <!-- LEFT SIDE TEXT -->
                      <div class="col-12 col-md-6 q-mt-md">
                        <div class="text-bold">
                          Connect your farm to
                          <a href="https://recompute.io" target="_blank">recompute.io</a>
                        </div>

                        <div class="q-mt-xs">
                          Sign up and add your public farmer key to your account to get started.
                        </div>

                        <!-- COPYABLE KEY FIELD -->
                        <q-input
                            class="q-mt-sm"
                            label="Public Farmer Key"
                            v-model="publicFarmerKey"
                            outlined
                            readonly
                            dense
                            :disable="saving"
                        >
                          <template v-slot:append>
                            <q-btn
                                flat
                                round
                                icon="content_copy"
                                @click="copyFarmerKey"
                            />
                          </template>
                        </q-input>
                      </div>

                      <!-- BUTTON ON THE RIGHT -->
                      <div class="col-12 col-md-6 q-mt-md flex items-start justify-end">
                        <q-btn
                            color="primary"
                            label="Use Recompute.io"
                            @click="setDefaultRecompute"
                            :disable="saving"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="row q-gutter-sm q-mt-lg">
                  <q-btn
                      outline
                      color="grey"
                      label="Back"
                      icon="arrow_back"
                      @click="step = 2"
                      :disable="saving"
                  />
                  <q-btn
                      color="primary"
                      label="Continue"
                      icon-right="arrow_forward"
                      @click="saveConnectionSettings"
                      :disable="saving"
                  />
                </div>
              </div>
            </q-step>

            <q-step :name="4" title="Save and Test" icon="check_circle">
              <div class="test-connection q-pa-md">
                <div class="text-h6 q-mb-md">Save and test your farmer connection</div>
                <p>
                  Save your farmer configuration and test the connection to make sure everything is working properly.
                </p>

                <div class="q-pa-md">
                  <q-btn
                      color="primary"
                      label="Save and Test Connection"
                      icon="save"
                      :loading="saving"
                      @click="saveAndTestConnection"
                      :disable="saving"
                  />
                </div>

                <div class="row q-gutter-sm q-mt-lg">
                  <q-btn
                      outline
                      color="grey"
                      label="Back"
                      icon="arrow_back"
                      @click="step = 3"
                      :disable="saving"
                  />
                  <q-btn
                      color="primary"
                      label="Close"
                      icon-right="close"
                      @click="cancelModal"
                      :disable="saving"
                  />
                </div>
              </div>
            </q-step>
          </q-stepper>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { parseDocument } from 'yaml';
import { useFarmerStore } from '@/stores/farmerStore';
import { useConfigStore } from '@/stores/configStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { FarmerConfig } from '@/types/farmer';
import {
  generateConfigFromMnemonic,
  scanForLegacyConfigs,
} from '@/services/farmer';

const emit = defineEmits(['update:modelValue', 'import-success', 'import-error']);

const farmerStore = useFarmerStore();
const configStore = useConfigStore();
const notificationStore = useNotificationStore();

const showModal = ref(false);
const error = ref('');
const saving = ref(false);

const step = ref(1);
const stepper = ref(null);

const authMethod = ref('yaml');
const mnemonicInput = ref('');

const hasExistingConfig = ref(false);
const existingConfigJson = ref('');
const showFreshSetup = ref(false);

const scanning = ref(false);
const scanComplete = ref(false);
const scanResults = ref<Array<{launcherId: string, mountPath: string, isNew: boolean}>>([]);

const yamlImportMethod = ref('paste');
const yamlConfig = ref('');
const yamlFile = ref<File | null>(null);
const yamlFilePreview = ref('');

const payoutAddress = ref('');

const plotDirectories = ref<string[]>(['/mnt']);

const recomputeHost = ref('');
const recomputePort = ref(0);

const publicFarmerKey = ref("");

async function copyFarmerKey() {
  if (!publicFarmerKey.value || !publicFarmerKey.value.trim()) {
    notificationStore.info('No public farmer key available to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(publicFarmerKey.value.trim());
    notificationStore.success('Public farmer key copied to clipboard.');
  } catch (err) {
    console.error('Failed to copy farmer key:', err);
    notificationStore.error('Failed to copy public farmer key to clipboard.');
  }
}

function createDefaultConfig(): FarmerConfig {
  return {
    selected_network: 'mainnet',
    ssl_root_path: null,
    fullnode_ws_host: '',
    fullnode_ws_port: 443,
    fullnode_rpc_host: '',
    fullnode_rpc_port: 443,
    payout_address: '',
    farmer_info: [],
    pool_info: [],
    harvester_configs: {
      druid_garden: null,
      custom_config: {
        plot_directories: ['/mnt'],
        parallel_read: true,
        plot_search_depth: 2,
        max_cpu_cores: -1,
        max_cuda_devices: -1,
        max_opencl_devices: -1,
        cuda_device_list: [],
        opencl_device_list: [],
        recompute_host: '',
        recompute_port: 0
      }
    },
    metrics: {
      enabled: true,
      port: 9090
    }
  } as any;
}

const farmerConfig = ref<FarmerConfig>(createDefaultConfig());

function ensureCustomConfig(config: any) {
  if (!config.harvester_configs) {
    config.harvester_configs = {};
  }
  if (!config.harvester_configs.custom_config) {
    config.harvester_configs.custom_config = {
      plot_directories: ['/mnt'],
      parallel_read: true,
      plot_search_depth: 2,
      max_cpu_cores: 0,
      max_cuda_devices: 0,
      max_opencl_devices: 0,
      cuda_device_list: [],
      opencl_device_list: [],
      recompute_host: '',
      recompute_port: 0
    };
  }
  if (!config.harvester_configs.custom_config.plot_directories ||
      config.harvester_configs.custom_config.plot_directories.length === 0) {
    config.harvester_configs.custom_config.plot_directories = ['/mnt'];
  }
  return config;
}

const initializeFarmerConfig = async () => {
  try {
    await configStore.fetchConfigs();
    const farmerConfigEntry = configStore.configs.find(entry => entry.key === 'farmer_config');

    if (farmerConfigEntry && farmerConfigEntry.value) {
      console.log('Found farmer config in database:', farmerConfigEntry.value);

      let actualConfig = JSON.parse(farmerConfigEntry.value);
      console.log('Parsed actual config:', actualConfig);

      actualConfig = ensureCustomConfig(actualConfig);

      if (actualConfig.harvester_configs?.gigahorse && !actualConfig.harvester_configs?.custom_config) {
        actualConfig.harvester_configs.custom_config = { ...actualConfig.harvester_configs.gigahorse };
        delete actualConfig.harvester_configs.gigahorse;
      }
      const dirs = actualConfig.harvester_configs?.custom_config?.plot_directories || ['/mnt'];
      plotDirectories.value = [...dirs];

      recomputeHost.value = actualConfig.harvester_configs?.custom_config?.recompute_host || '';
      recomputePort.value = actualConfig.harvester_configs?.custom_config?.recompute_port || 0;

      payoutAddress.value = actualConfig.payout_address || '';
      if (payoutAddress.value === 'mainnet') {
        payoutAddress.value = '';
      }

      farmerConfig.value = actualConfig;

      return true;
    } else {
      console.log('No farmer config found in database, using defaults');
      farmerConfig.value = createDefaultConfig();
      plotDirectories.value = ['/mnt'];
      recomputeHost.value = '';
      recomputePort.value = 0;
      payoutAddress.value = '';

      return false;
    }
  } catch (err) {
    console.error('Failed to load config from database:', err);
    farmerConfig.value = createDefaultConfig();
    plotDirectories.value = ['/mnt'];
    return false;
  }
};

// Helper function to refresh farmer store state after config changes
const refreshFarmerState = async () => {
  try {
    await farmerStore.checkFarmerStatus();
    await farmerStore.updateConfigTestResult();
    console.log('Farmer state refreshed after config update');
  } catch (err) {
    console.error('Failed to refresh farmer state:', err);
  }
};

watch(yamlFile, async (newFile) => {
  if (newFile) {
    try {
      const content = await readFileContent(newFile);
      yamlFilePreview.value = content;
    } catch (err) {
      error.value = 'Error reading file';
      yamlFilePreview.value = '';
    }
  } else {
    yamlFilePreview.value = '';
  }
});

watch(() => farmerConfig.value.harvester_configs?.custom_config?.plot_directories, (newDirs) => {
  if (newDirs && Array.isArray(newDirs)) {
    plotDirectories.value = [...newDirs];
  }
}, { deep: true });

const canAuthenticate = computed(() => {
  if (hasExistingConfig.value && !showFreshSetup.value) {
    return !!existingConfigJson.value.trim();
  }

  if (authMethod.value === 'mnemonic') {
    return mnemonicInput.value && mnemonicInput.value.trim().split(/\s+/).length === 24;
  } else if (authMethod.value === 'scan') {
    return scanComplete.value && scanResults.value;
  } else if (authMethod.value === 'yaml') {
    if (yamlImportMethod.value === 'paste') {
      return !!yamlConfig.value.trim();
    } else {
      return !!yamlFile.value;
    }
  }
  return false;
});

onMounted(async () => {
  console.log('FarmerConfig component mounted successfully!');
  await checkForExistingConfig();
});

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}

async function parseJsonConfig(content: string): Promise<any> {
  try {
    let parsedConfig = JSON.parse(content);

    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw new Error('Invalid JSON configuration format');
    }

    parsedConfig = ensureCustomConfig(parsedConfig);

    if (parsedConfig.pool_info && Array.isArray(parsedConfig.pool_info)) {
      parsedConfig.pool_info.forEach((poolInfo: any) => {
        if (poolInfo.owner_public_key && typeof poolInfo.owner_public_key === 'string') {
          poolInfo.owner_public_key = poolInfo.owner_public_key.replace(/\\\s*\n\s*/g, '').trim();
        }
      });
    }

    return parsedConfig;
  } catch (err) {
    throw new Error(`JSON parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function parseYamlConfig(content: string): Promise<any> {
  try {
    const doc = parseDocument(content, { schema: 'json' });
    let parsedConfig = doc.toJS();

    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw new Error('Invalid YAML configuration format');
    }

    parsedConfig = ensureCustomConfig(parsedConfig);

    if (parsedConfig.pool_info && Array.isArray(parsedConfig.pool_info)) {
      parsedConfig.pool_info.forEach((poolInfo: any) => {
        if (poolInfo.owner_public_key && typeof poolInfo.owner_public_key === 'string') {
          poolInfo.owner_public_key = poolInfo.owner_public_key.replace(/\\\s*\n\s*/g, '').trim();
        }
      });
    }

    return parsedConfig;
  } catch (err) {
    throw new Error(`YAML parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function checkForExistingConfig() {
  console.log('Checking for existing config...');

  const hasDbConfig = await initializeFarmerConfig();

  if (hasDbConfig) {
    hasExistingConfig.value = true;
    showFreshSetup.value = false;

    payoutAddress.value = farmerConfig.value.payout_address || '';

    try {
      existingConfigJson.value = JSON.stringify(farmerConfig.value, null, 2);
      console.log('Found existing config in database, showing JSON edit mode');
    } catch (err) {
      console.error('Error converting config to JSON:', err);
      existingConfigJson.value = JSON.stringify(farmerConfig.value, null, 2);
    }
  } else {
    hasExistingConfig.value = false;
    showFreshSetup.value = true;
    payoutAddress.value = '';
    console.log('No config found in database, showing fresh setup');
  }
}

async function saveExistingConfigAndTest() {
  error.value = '';
  saving.value = true;

  try {
    let parsedConfig = await parseJsonConfig(existingConfigJson.value);
    parsedConfig = ensureCustomConfig(parsedConfig);

    // Update config silently - no notifications from this call
    await farmerStore.updateConfig(parsedConfig);

    // Refresh farmer state to update UI reactivity
    await refreshFarmerState();

    const testResponse = await farmerStore.testFarmerConfig();

    const isSuccessful = typeof testResponse === 'boolean' ? testResponse :
        (testResponse && typeof testResponse === 'object' && true && 'success' in testResponse) ?
            (testResponse as any).success : false;

    if (isSuccessful) {
      // Check if the config has a valid payout address
      const configPayoutAddress = parsedConfig.payout_address || '';
      const hasValidPayoutAddress = configPayoutAddress &&
          configPayoutAddress.trim() !== '' &&
          configPayoutAddress !== 'mainnet';

      if (!hasValidPayoutAddress) {
        // If no valid payout address, show notification and go to payout step
        notificationStore.info('Configuration saved and tested successfully. Please configure your payout address.');
        payoutAddress.value = '';
        step.value = 2;
        return; // Don't close the modal, proceed to payout setup
      }

      // Single success notification - this is the ONLY notification that should show
      notificationStore.success('Farmer configuration saved and tested successfully');
      showModal.value = false;
      emit('import-success', 'Farmer configuration saved and tested successfully');
      resetForm();
    } else {
      const message = typeof testResponse === 'object' && testResponse && 'message' in testResponse
          ? (testResponse as any).message
          : 'Connection test failed. Please check your configuration.';
      notificationStore.error(message);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid configuration';
    error.value = errorMessage;
    notificationStore.error(errorMessage);
  } finally {
    saving.value = false;
  }
}

function startFreshSetup() {
  hasExistingConfig.value = false;
  showFreshSetup.value = true;
  farmerConfig.value = createDefaultConfig();
  plotDirectories.value = ['/mnt'];
  recomputeHost.value = '';
  recomputePort.value = 0;
  payoutAddress.value = '';
}

async function scanForLegacyConfig() {
  scanning.value = true;
  scanComplete.value = false;
  scanResults.value = [];

  try {
    const data = await scanForLegacyConfigs();

    console.log('Scan API response:', data);

    if (data) {
      let mergedConfig = { ...farmerConfig.value, ...data };
      mergedConfig = ensureCustomConfig(mergedConfig);

      farmerConfig.value = mergedConfig;

      if (mergedConfig.harvester_configs?.custom_config?.plot_directories) {
        plotDirectories.value = [...mergedConfig.harvester_configs.custom_config.plot_directories];
      }

      if (data.farmer_info && Array.isArray(data.farmer_info)) {
        scanResults.value = data.farmer_info.map((info: any) => ({
          launcherId: info.launcher_id || 'Unknown',
          mountPath: info.mount_path || 'System drive',
          isNew: info.is_new || false
        }));
      }

      // Single success notification handled by the service
    }

    scanComplete.value = true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to scan for legacy configurations';
    error.value = errorMessage;
    // Error notification handled by the service
  } finally {
    scanning.value = false;
  }
}

async function authenticate() {
  error.value = '';
  saving.value = true;

  try {
    if (authMethod.value === 'mnemonic') {
      try {
        const setupResult = await generateConfigFromMnemonic(mnemonicInput.value);
        console.log('Setup with mnemonic result:', setupResult);

        if (!setupResult.success) {
          throw new Error(setupResult.message || 'Failed to setup with mnemonic');
        }

        let resultConfig = setupResult.config;
        if (!resultConfig) {
          throw new Error('No configuration returned from mnemonic generation');
        }

        resultConfig = ensureCustomConfig(resultConfig);
        farmerConfig.value = resultConfig;

        if (resultConfig && resultConfig.harvester_configs?.custom_config?.plot_directories) {
          plotDirectories.value = [...resultConfig.harvester_configs.custom_config.plot_directories];
        }
        if (farmerConfig.value.payout_address) {
          payoutAddress.value = farmerConfig.value.payout_address;
        }

        // Refresh farmer state
        await refreshFarmerState();

        // Check if we have a valid payout address
        const hasValidPayoutAddress = payoutAddress.value &&
            payoutAddress.value.trim() !== '' &&
            payoutAddress.value !== 'mainnet';

        if (hasValidPayoutAddress) {
          // Skip to connection settings if payout is already configured
          step.value = 3;
          notificationStore.info('Mnemonic setup completed. Payout address found, proceeding to connection settings.');
        } else {
          // Go to payout settings if no valid payout address
          step.value = 2;
          notificationStore.info('Mnemonic setup completed. Please configure your payout address.');
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Invalid mnemonic configuration';
        notificationStore.error(error.value);
        saving.value = false;
        return;
      }
    } else if (authMethod.value === 'scan') {
      try {
        if (!scanComplete.value) {
          await scanForLegacyConfig();
        }

        if (farmerConfig.value.payout_address) {
          payoutAddress.value = farmerConfig.value.payout_address;
        }

        // Refresh farmer state
        await refreshFarmerState();

        // Check if we have a valid payout address
        const hasValidPayoutAddress = payoutAddress.value &&
            payoutAddress.value.trim() !== '' &&
            payoutAddress.value !== 'mainnet';

        if (hasValidPayoutAddress) {
          // Skip to connection settings if payout is already configured
          step.value = 3;
          notificationStore.info('Configuration scan completed. Payout address found, proceeding to connection settings.');
        } else {
          // Go to payout settings if no valid payout address
          step.value = 2;
          notificationStore.info('Configuration scan completed. Please configure your payout address.');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error during scan process';
        error.value = errorMessage;
        notificationStore.error(errorMessage);
        saving.value = false;
        return;
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during authentication';
    error.value = errorMessage;
    notificationStore.error(errorMessage);
  } finally {
    saving.value = false;
  }
}

async function importYamlAndContinue() {
  error.value = '';
  saving.value = true;

  try {
    let configContent = '';
    if (yamlImportMethod.value === 'paste') {
      configContent = yamlConfig.value;
    } else if (yamlFile.value) {
      configContent = await readFileContent(yamlFile.value);
    }

    if (!configContent) {
      throw new Error('No configuration provided');
    }

    let parsedConfig = await parseYamlConfig(configContent);
    parsedConfig = ensureCustomConfig(parsedConfig);

    await farmerStore.updateConfig(parsedConfig);

    // Single success notification
    notificationStore.success('YAML configuration imported successfully');

    farmerConfig.value = parsedConfig;

    if (parsedConfig.harvester_configs?.custom_config?.plot_directories) {
      plotDirectories.value = [...parsedConfig.harvester_configs.custom_config.plot_directories];
    }

    recomputeHost.value = parsedConfig.harvester_configs?.custom_config?.recompute_host || '';
    recomputePort.value = parsedConfig.harvester_configs?.custom_config?.recompute_port || 0;

    payoutAddress.value = parsedConfig.payout_address || '';

    console.log('YAML import - final farmerConfig:', farmerConfig.value);

    // Refresh farmer state
    await refreshFarmerState();

    // Check if we have a valid payout address
    const hasValidPayoutAddress = payoutAddress.value &&
        payoutAddress.value.trim() !== '' &&
        payoutAddress.value !== 'mainnet';

    if (hasValidPayoutAddress) {
      // Skip to connection settings if payout is already configured
      step.value = 3;
      notificationStore.info('YAML import completed. Payout address found, proceeding to connection settings.');
    } else {
      // Go to payout settings if no valid payout address
      step.value = 2;
      notificationStore.info('YAML import completed. Please configure your payout address.');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid YAML configuration';
    error.value = errorMessage;
    notificationStore.error(errorMessage);
  } finally {
    saving.value = false;
  }
}

function savePayoutAddress() {
  farmerConfig.value.payout_address = payoutAddress.value;
  farmerConfig.value.pool_info.forEach((poolInfo) => {poolInfo.payout_instructions = payoutAddress.value;})
  step.value = 3;
}

function setDefaultNode() {
  farmerConfig.value.fullnode_ws_host = 'druid.garden';
  farmerConfig.value.fullnode_ws_port = 443;
  farmerConfig.value.fullnode_rpc_host = 'druid.garden';
  farmerConfig.value.fullnode_rpc_port = 443;
}

function setDefaultRecompute() {
  recomputeHost.value = 'proxy.recompute.io';
  recomputePort.value = 11988;
}

function addPlotDirectory() {
  plotDirectories.value.push('/mnt');
}

function removePlotDirectory(index: number) {
  if (plotDirectories.value.length > 1) {
    plotDirectories.value.splice(index, 1);
  }
}

function saveConnectionSettings() {
  // Update the farmerConfig with current plot directories
  if (farmerConfig.value.harvester_configs?.custom_config) {
    farmerConfig.value.harvester_configs.custom_config.plot_directories = [...plotDirectories.value];
  }
  step.value = 4;
}

async function saveAndTestConnection() {
  error.value = '';
  saving.value = true;

  try {
    if (farmerConfig.value.harvester_configs?.custom_config) {
      farmerConfig.value.harvester_configs.custom_config.plot_directories = [...plotDirectories.value];
      farmerConfig.value.harvester_configs.custom_config.recompute_host = recomputeHost.value;
      farmerConfig.value.harvester_configs.custom_config.recompute_port = recomputePort.value;
    }

    // Update config silently - no notifications from this call
    await farmerStore.updateConfig(farmerConfig.value);

    // Refresh farmer state to update UI reactivity
    await refreshFarmerState();

    const testResponse = await farmerStore.testFarmerConfig();

    const isSuccessful = typeof testResponse === 'boolean' ? testResponse :
        (testResponse && typeof testResponse === 'object' && 'success' in testResponse) ?
            testResponse.success : false;

    if (isSuccessful) {
      // Single success notification - this is the ONLY notification that should show
      notificationStore.success('Farmer configuration saved and tested successfully');
      showModal.value = false;
      emit('import-success', 'Farmer configuration saved and tested successfully');
      resetForm();
    } else {
      const message = typeof testResponse === 'object' && testResponse && 'message' in testResponse
          ? (testResponse as any).message
          : 'Connection test failed. Please check your configuration.';
      notificationStore.error(message);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
    error.value = errorMessage;
    notificationStore.error(errorMessage);
  } finally {
    saving.value = false;
  }
}

function cancelModal() {
  if (saving.value) return;
  showModal.value = false;
  resetForm();
}

function resetForm() {
  step.value = 1;
  mnemonicInput.value = '';
  scanning.value = false;
  scanComplete.value = false;
  scanResults.value = [];
  yamlConfig.value = '';
  yamlFile.value = null;
  yamlFilePreview.value = '';
  payoutAddress.value = '';
  error.value = '';
  showFreshSetup.value = false;
  existingConfigJson.value = '';
  recomputeHost.value = '';
  recomputePort.value = 0;
  plotDirectories.value = ['/mnt'];

  farmerConfig.value = createDefaultConfig();
}

defineExpose({
  open: async () => {
    try {
      showModal.value = true;
      await checkForExistingConfig();
    } catch (err) {
      console.error('Error opening farmer config:', err);
      showModal.value = true;
    }
  },
  close: cancelModal
});
</script>

<style scoped>
.farmer-config-popup {
  position: relative;
}

.config-modal {
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
}

.json-textarea {
  font-family: monospace;
}

.yaml-textarea {
  font-family: monospace;
}

.yaml-preview {
  border-radius: 4px;
  overflow: hidden;
}

.yaml-content {
  font-family: monospace;
  font-size: 12px;
  margin: 0;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
}

.scan-info-container {
  margin-bottom: 20px;
}

.scan-actions {
  margin: 20px 0;
}

.scan-results {
  max-width: 600px;
}

.scan-results pre {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
}

.existing-config-editor {
  max-width: 100%;
}

.existing-config-editor .json-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}
</style>