<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useNetworkStore} from '@/stores/networkStore';
import {useNotificationStore} from '@/stores/notificationStore';
import {withApiLoading} from '@/utils/api';
import type {HotspotSettings, NetworkDevice} from "@/types/network";

// Get the stores
const networkStore = useNetworkStore();
const notificationStore = useNotificationStore();

// Network status indicators
const isOnline = ref(false);
const checkingConnection = ref(false);

// For WiFi UI
const showPassword = ref(false);
const showWifiPassword = ref(false);
const hotspotSettings = ref<HotspotSettings>({
  ssid: 'MyHotspot',
  password: ''
});

const wifiDialogOpen = ref(false);
const selectedNetwork = ref<NetworkDevice | null>(null);
const wifiPassword = ref('');

const checkOnlineStatus = async () => {
  try {
    checkingConnection.value = true;
    isOnline.value = await networkStore.checkInternetConnection();
    checkingConnection.value = false;
  } catch (error) {
    console.error('Error checking internet connection:', error);
    isOnline.value = false;
    checkingConnection.value = false;
  }
};

const connectionStatus = computed(() => {
  return {
    text: isOnline.value ? 'Connected to Internet' : 'No Internet Connection',
    color: isOnline.value ? 'positive' : 'negative',
    icon: isOnline.value ? 'cloud_done' : 'cloud_off'
  };
});

const allInterfaces = computed(() => {
  return networkStore.networkInfoData || [];
});

const connectedInterfaces = computed(() => {
  return networkStore.networkInfoData.filter(networkInterface =>
      networkInterface.ip_addresses && networkInterface.ip_addresses.length > 0
  );
});

const isWifiConnected = computed(() => {
  return connectedInterfaces.value.some(networkInterface =>
      networkInterface.name.includes('wl') &&
      networkInterface.ip_addresses &&
      networkInterface.ip_addresses.length > 0
  );
});

const connectedWifiNetwork = computed(() => {
  if (!isWifiConnected.value) {
    return null;
  }

  const networkFromScan = networkStore.availableNetworks.find(network => network.connected);

  if (networkStore.hotspotEnabled) {
    return null;
  }

  return networkFromScan || null;
});

const connectedSSID = computed(() => {
  return connectedWifiNetwork.value?.ssid || null;
});

const filteredNetworks = computed(() => {
  const networks = networkStore.availableNetworks || [];

  const validNetworks = networks.filter(network => {
    if (!network.ssid || network.ssid.trim() === '') {
      return false;
    }
    if (networkStore.hotspotEnabled && network.ssid === hotspotSettings.value.ssid) {
      return false;
    }

    return true;
  });

  const networkMap = new Map();

  validNetworks.forEach(network => {
    const existing = networkMap.get(network.ssid);
    if (!existing || network.signal > existing.signal) {
      networkMap.set(network.ssid, network);
    }
  });

  return Array.from(networkMap.values()).sort((a, b) => b.signal - a.signal);
});

const scanNetworks = async (): Promise<void> => {
  const loadingState = { value: false };

  await withApiLoading(
      loadingState,
      async () => {
        const networks = await networkStore.scanNetworks();
        return networks;
      },
      {
        showSuccessNotification: true,
        successMessage: 'Networks scanned successfully',
        showErrorNotification: true,
        errorMessage: 'Failed to scan networks'
      }
  );
};

// Toggle hotspot
const toggleHotspot = async (enabled: boolean): Promise<void> => {
  if (enabled && !hotspotSettings.value.password) {
    notificationStore.warning('Please set a password for the hotspot', {
      caption: 'A secure password is required for hotspots'
    });
    return;
  }

  const loadingState = { value: false };

  await withApiLoading(
      loadingState,
      async () => {
        await networkStore.setHotspotEnabled(enabled, hotspotSettings.value);
        return true;
      },
      {
        showSuccessNotification: true,
        successMessage: enabled ? 'Hotspot enabled' : 'Hotspot disabled',
        showErrorNotification: true,
        errorMessage: `Failed to ${enabled ? 'enable' : 'disable'} hotspot`
      }
  );
};

// Save hotspot settings
const saveHotspotSettings = async (): Promise<void> => {
  const loadingState = { value: false };

  await withApiLoading(
      loadingState,
      async () => {
        await networkStore.updateHotspotSettings(hotspotSettings.value);
        return true;
      },
      {
        showSuccessNotification: true,
        successMessage: 'Hotspot settings saved successfully',
        showErrorNotification: true,
        errorMessage: 'Failed to save hotspot settings'
      }
  );
};

const connectToNetwork = (network: NetworkDevice): void => {
  if (network.ssid === connectedSSID.value && isWifiConnected.value && !networkStore.hotspotEnabled) {
    return;
  }
  if (networkStore.hotspotEnabled && network.ssid === hotspotSettings.value.ssid) {
    notificationStore.warning('Cannot connect to your own hotspot', {
      caption: 'Please disable the hotspot first to connect to other networks'
    });
    return;
  }

  selectedNetwork.value = network;
  wifiPassword.value = '';
  wifiDialogOpen.value = true;
};

const connectWifi = async (): Promise<void> => {
  if (!selectedNetwork.value) return;

  await withApiLoading(
      ref(networkStore.connecting),
      async () => {
        const success = await networkStore.connectToNetwork(
            selectedNetwork.value!.ssid,
            selectedNetwork.value!.secure ? wifiPassword.value : null
        );

        if (success) {
          wifiDialogOpen.value = false;
          await networkStore.fetchNetworkInfo();
          await networkStore.scanNetworks();
        } else {
          throw new Error('Failed to connect');
        }

        return success;
      },
      {
        showSuccessNotification: true,
        successMessage: `Connected to ${selectedNetwork.value.ssid}`,
        showErrorNotification: true,
        errorMessage: 'Failed to connect to network'
      }
  );
};

const restartHotspot = async (): Promise<void> => {
  const loadingState = { value: false };

  await withApiLoading(
      loadingState,
      async () => {
        await networkStore.restartHotspot();
        return true;
      },
      {
        showSuccessNotification: true,
        successMessage: 'Hotspot restarted successfully',
        showErrorNotification: true,
        errorMessage: 'Failed to restart hotspot'
      }
  );
};

const refreshNetworkData = async () => {
  await checkOnlineStatus();
  await networkStore.fetchNetworkInfo();
  await networkStore.scanNetworks();
};

onMounted(async () => {
  await networkStore.fetchNetworkStatus();
  await refreshNetworkData();

  hotspotSettings.value = { ...networkStore.hotspotSettings };

  setInterval(checkOnlineStatus, 60000);
});
</script>

<template>
  <div>
    <div class="text-h6 q-mb-md">WiFi & Network</div>

    <!-- Internet Connection Status -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <q-icon :name="connectionStatus.icon" :color="connectionStatus.color" size="md" class="q-mr-md" />
          <div class="text-subtitle1">{{ connectionStatus.text }}</div>
          <q-space />
          <q-btn
              flat
              round
              color="primary"
              icon="refresh"
              @click="refreshNetworkData"
              :loading="checkingConnection || networkStore.loading"
          >
            <q-tooltip>Refresh Network Data</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- Network Interfaces -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Network Interfaces</div>

        <div v-if="allInterfaces.length > 0">
          <q-list separator>
            <q-item v-for="networkInterface in allInterfaces" :key="networkInterface.name">
              <q-item-section avatar>
                <q-icon
                    :name="networkInterface.name.includes('wl') ? 'wifi' : networkInterface.name.includes('eth') || networkInterface.name.includes('enp') ? 'settings_ethernet' : 'network_node'"
                    :color="networkInterface.ip_addresses && networkInterface.ip_addresses.length > 0 ? 'positive' : 'grey'"
                    size="md"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ networkInterface.name }}</q-item-label>
                <q-item-label caption>
                  {{ networkInterface.name.includes('wl') ? 'WiFi' : networkInterface.name.includes('eth') || networkInterface.name.includes('enp') ? 'Ethernet' : networkInterface.name === 'lo' ? 'Loopback' : 'Other' }}
                </q-item-label>
              </q-item-section>

              <q-item-section>
                <div v-if="networkInterface.ip_addresses && networkInterface.ip_addresses.length > 0">
                  <div v-for="ip in networkInterface.ip_addresses" :key="ip.address" class="text-caption">
                    {{ ip.address }}/{{ ip.net_mask }}
                    <div v-if="ip.gateway" class="text-grey-6">Gateway: {{ ip.gateway }}</div>
                  </div>
                </div>
                <div v-else class="text-grey-6">No IP Address</div>
              </q-item-section>

              <q-item-section side>
                <q-badge
                    :color="networkInterface.ip_addresses && networkInterface.ip_addresses.length > 0 ? 'positive' : 'grey'"
                    :label="networkInterface.ip_addresses && networkInterface.ip_addresses.length > 0 ? 'Connected' : 'Disconnected'"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div v-else-if="networkStore.loading" class="text-center q-py-md">
          <q-spinner color="primary" />
          <div class="q-mt-sm">Loading network interfaces...</div>
        </div>

        <div v-else class="text-center text-grey-7 q-py-md">
          No network interfaces found
        </div>
      </q-card-section>
    </q-card>

    <!-- WiFi Networks -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <div class="text-subtitle1">WiFi Networks</div>
          <q-space />
          <q-btn
              flat
              round
              color="primary"
              icon="refresh"
              @click="scanNetworks"
              :loading="networkStore.scanning"
          >
            <q-tooltip>Scan Networks</q-tooltip>
          </q-btn>
        </div>

        <q-list separator v-if="filteredNetworks.length > 0 || networkStore.scanning">
          <q-item
              v-for="network in filteredNetworks"
              :key="network.ssid"
              :clickable="network.ssid !== connectedSSID || networkStore.hotspotEnabled"
              @click="connectToNetwork(network)"
              :class="{ 'bg-positive text-white': network.ssid === connectedSSID && isWifiConnected && !networkStore.hotspotEnabled }"
          >
            <q-item-section avatar>
              <q-icon
                  :name="networkStore.getWifiSignalIcon(network.signal)"
                  :color="(network.ssid === connectedSSID && isWifiConnected && !networkStore.hotspotEnabled) ? 'white' : 'primary'"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ network.ssid }}</q-item-label>
              <q-item-label caption :class="{ 'text-grey-3': network.ssid === connectedSSID && isWifiConnected && !networkStore.hotspotEnabled }">
                Signal: {{ network.signal }}%{{ network.secure ? ' • Secure' : ' • Open' }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div v-if="network.ssid === connectedSSID && isWifiConnected && !networkStore.hotspotEnabled" class="row items-center">
                <q-icon name="check_circle" color="white" size="sm" class="q-mr-xs" />
                <span class="text-caption">Connected</span>
              </div>
              <q-btn
                  v-else
                  flat
                  dense
                  color="primary"
                  label="Connect"
                  @click.stop="connectToNetwork(network)"
              />
            </q-item-section>
          </q-item>

          <q-item v-if="networkStore.scanning">
            <q-item-section>
              <div class="text-center q-py-md">
                <q-spinner color="primary" />
                <div class="q-mt-sm">Scanning for networks...</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center text-grey-7 q-py-md">
          No networks found. Click refresh to scan.
        </div>
      </q-card-section>
    </q-card>

    <!-- Hotspot Settings -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-md">
          <div class="text-subtitle1">Hotspot</div>
          <q-space />
          <q-toggle
              v-model="networkStore.hotspotEnabled"
              label="Enabled"
              @update:model-value="toggleHotspot"
              :loading="networkStore.hotspotLoading"
          />
        </div>

        <q-form @submit="saveHotspotSettings" class="q-gutter-md">
          <q-input
              v-model="hotspotSettings.ssid"
              label="Hotspot Name (SSID)"
              :disable="networkStore.hotspotEnabled"
              :rules="[val => !!val || 'SSID is required']"
          />
          <q-input
              v-model="hotspotSettings.password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              :disable="networkStore.hotspotEnabled"
              :rules="[val => val.length >= 8 || 'Password must be at least 8 characters']"
          >
            <template v-slot:append>
              <q-icon
                  :name="showPassword ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <div class="row justify-end q-gutter-sm">
            <q-btn
                v-if="networkStore.hotspotEnabled"
                outline
                color="warning"
                icon="restart_alt"
                label="Restart Hotspot"
                @click="restartHotspot"
            />
            <q-btn
                color="primary"
                type="submit"
                label="Save Settings"
                :disable="networkStore.hotspotEnabled"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- WiFi Connection Dialog -->
    <q-dialog v-model="wifiDialogOpen" persistent>
      <q-card style="width: 400px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">Connect to {{ selectedNetwork?.ssid || 'WiFi Network' }}</div>
          <div v-if="selectedNetwork" class="text-caption q-mt-sm">
            Signal: {{ selectedNetwork.signal }}% • {{ selectedNetwork.secure ? 'Secure' : 'Open' }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="connectWifi">
            <q-input
                v-if="selectedNetwork?.secure"
                v-model="wifiPassword"
                label="Password"
                :type="showWifiPassword ? 'text' : 'password'"
                :rules="[val => val.length >= 8 || 'Password must be at least 8 characters']"
                autofocus
            >
              <template v-slot:append>
                <q-icon
                    :name="showWifiPassword ? 'visibility_off' : 'visibility'"
                    class="cursor-pointer"
                    @click="showWifiPassword = !showWifiPassword"
                />
              </template>
            </q-input>
            <div v-else class="text-body2 text-grey-6">
              This is an open network and does not require a password.
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative" v-close-popup />
          <q-btn flat label="Connect" color="primary" @click="connectWifi" :loading="networkStore.connecting" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.bg-positive.q-item {
  border-left: 4px solid var(--q-positive);
}
</style>