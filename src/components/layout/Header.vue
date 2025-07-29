<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';
import { useDiskStore } from '@/stores/diskStore';
import { useUpdateStore } from '@/stores/updateStore';
import { post } from '@/utils/api';

const router = useRouter();
const userStore = useUserStore();
const themeStore = useThemeStore();
const diskStore = useDiskStore();
const updateStore = useUpdateStore();

const tab = ref('home');
const showDiskNotification = ref(false);
const showUpdateModal = ref(false);

// System power control states
const showRebootConfirm = ref(false);
const showShutdownConfirm = ref(false);
const systemActionLoading = ref(false);

const isLoggedIn = computed(() => userStore.isAuthenticated);

const isDarkMode = computed(() => themeStore.isDarkMode);

const hasNonSystemDisks = computed(() => {
  return diskStore.disks.some(disk =>
      disk.partitions?.some(partition => {
        const mountPath = partition.mount_path || partition.mountpoint;
        return mountPath && !['/home', '/boot', '/', '/var'].includes(mountPath);
      })
  );
});

const goToDeviceSettings = () => {
  router.push('/settings?tab=devices');
};

const goToUserPage = () => {
  router.push('/user');
};

const logout = async () => {
  try {
    userStore.logout();
    await router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

const login = () => {
  router.push('/login');
};

const checkDisks = async () => {
  if (isLoggedIn.value) {
    await diskStore.fetchDisks();
    updateNotification();
  }
};

const updateNotification = () => {
  showDiskNotification.value = isLoggedIn.value && !hasNonSystemDisks.value;
};

const handleUpdateClick = () => {
  if (updateStore.isUpdateAvailable) {
    showUpdateModal.value = true;
  } else {
    updateStore.checkForUpdates();
  }
};

const confirmUpdate = () => {
  showUpdateModal.value = false;
  updateStore.startUpdate();
};

const cancelUpdate = () => {
  showUpdateModal.value = false;
};

// System power control methods
const confirmReboot = async () => {
  systemActionLoading.value = true;

  try {
    await post('/system/reboot', {}, {
      successMessage: 'Reboot initiated - system will restart in a few seconds',
      errorMessage: 'Failed to reboot system',
      showSuccessNotification: true,
      showErrorNotification: true
    });

    showRebootConfirm.value = false;

  } catch (error) {
    console.error('Reboot failed:', error);
  } finally {
    systemActionLoading.value = false;
  }
};

const confirmShutdown = async () => {
  systemActionLoading.value = true;

  try {
    await post('/system/shutdown', {}, {
      successMessage: 'Shutdown initiated - system will power off in a few seconds',
      errorMessage: 'Failed to shutdown system',
      showSuccessNotification: true,
      showErrorNotification: true
    });

    showShutdownConfirm.value = false;

  } catch (error) {
    console.error('Shutdown failed:', error);
  } finally {
    systemActionLoading.value = false;
  }
};

// Watch for changes in authentication state
watch(() => isLoggedIn.value, async (newValue) => {
  if (newValue) {
    await checkDisks();
    await updateStore.initialize();
  } else {
    showDiskNotification.value = false;
  }
});

watch(() => diskStore.disks, () => {
  updateNotification();
}, { deep: true });

onMounted(async () => {
  await themeStore.initialize();
  userStore.refreshUserFromToken();

  if (isLoggedIn.value) {
    await checkDisks();
    await updateStore.initialize();
  }
});
</script>

<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <!-- Logo -->
      <q-toolbar-title>
        <div class="text-h6">DG XCH OS</div>
      </q-toolbar-title>

      <!-- Navigation -->
      <q-tabs v-model="tab" class="q-px-lg gt-sm">
        <q-route-tab name="home" to="/" label="Home" />
        <q-route-tab name="farmer" to="/farmer" label="Farmer" />
        <q-route-tab name="plugins" to="/plugins" label="Plugins" />
        <q-route-tab name="files" to="/files" label="Files" />
        <q-route-tab name="settings" to="/settings" label="Settings" />
      </q-tabs>

      <!-- Right side buttons -->
      <q-space />

      <!-- Disk Notification -->
      <q-btn
          v-if="showDiskNotification"
          outline
          color="warning"
          class="q-mr-sm"
          @click="goToDeviceSettings"
      >
        <q-icon name="warning" class="q-mr-xs" />
        Please mount a disk
      </q-btn>

      <!-- Version/Update Indicator -->
      <q-btn
          v-if="updateStore.currentVersion"
          :outline="updateStore.isUpdateAvailable"
          :color="updateStore.isUpdateAvailable ? 'negative' : 'positive'"
          class="q-mr-sm"
          @click="handleUpdateClick"
          :loading="updateStore.isCheckingForUpdates || updateStore.isUpdating"
      >
        <q-icon
            :name="updateStore.isUpdateAvailable ? 'system_update' : 'check_circle'"
            class="q-mr-xs"
        />
        <span v-if="updateStore.isUpdateAvailable">Update Available</span>
        <span v-else>{{ updateStore.formattedVersion }}</span>

        <q-tooltip>
          <div v-if="updateStore.isUpdateAvailable">
            <div>Current version: {{ updateStore.formattedVersion }}</div>
            <div>New version: {{ updateStore.formattedRemoteVersion }}</div>
            <div>Click to update</div>
          </div>
          <div v-else>System is up to date ({{ updateStore.formattedVersion }})</div>
        </q-tooltip>
      </q-btn>

      <q-btn flat round @click="themeStore.toggleDarkMode">
        <q-icon :name="isDarkMode ? 'light_mode' : 'dark_mode'" />
      </q-btn>

      <!-- User button with dropdown menu -->
      <q-btn flat round>
        <q-avatar size="26px">
          <q-icon name="person" size="22px" />
        </q-avatar>

        <q-menu>
          <q-list style="min-width: 150px">
            <q-item clickable @click="goToUserPage">
              <q-item-section avatar>
                <q-avatar size="26px">
                  <q-icon name="person" size="22px" />
                </q-avatar>
              </q-item-section>
              <q-item-section>Profile</q-item-section>
            </q-item>

            <q-separator />

            <q-item v-if="isLoggedIn" clickable @click="logout">
              <q-item-section avatar>
                <q-icon name="logout" />
              </q-item-section>
              <q-item-section>Logout</q-item-section>
            </q-item>

            <q-item v-else clickable @click="login">
              <q-item-section avatar>
                <q-icon name="login" />
              </q-item-section>
              <q-item-section>Login</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <!-- System Power Menu -->
      <q-btn flat round icon="more_vert">
        <q-menu>
          <q-list style="min-width: 150px">
            <q-item clickable @click="showRebootConfirm = true">
              <q-item-section avatar>
                <q-icon name="restart_alt" color="warning" />
              </q-item-section>
              <q-item-section>Reboot</q-item-section>
            </q-item>

            <q-item clickable @click="showShutdownConfirm = true">
              <q-item-section avatar>
                <q-icon name="power_settings_new" color="negative" />
              </q-item-section>
              <q-item-section>Shutdown</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <!-- Mobile menu -->
      <q-btn flat round class="lt-md" icon="menu">
        <q-menu>
          <q-list style="min-width: 200px">
            <q-item clickable v-close-popup to="/">
              <q-item-section avatar>
                <q-icon name="home" />
              </q-item-section>
              <q-item-section>Home</q-item-section>
            </q-item>

            <q-item clickable v-close-popup to="/farmer">
              <q-item-section avatar>
                <q-icon name="agriculture" />
              </q-item-section>
              <q-item-section>Farmer</q-item-section>
            </q-item>

            <q-item clickable v-close-popup to="/system">
              <q-item-section avatar>
                <q-icon name="computer" />
              </q-item-section>
              <q-item-section>System</q-item-section>
            </q-item>

            <q-item clickable v-close-popup to="/plugins">
              <q-item-section avatar>
                <q-icon name="extension" />
              </q-item-section>
              <q-item-section>Plugins</q-item-section>
            </q-item>

            <q-item clickable v-close-popup to="/files">
              <q-item-section avatar>
                <q-icon name="folder" />
              </q-item-section>
              <q-item-section>Files</q-item-section>
            </q-item>

            <q-item clickable v-close-popup to="/settings">
              <q-item-section avatar>
                <q-icon name="settings" />
              </q-item-section>
              <q-item-section>Settings</q-item-section>
            </q-item>

            <q-separator />

            <q-item clickable v-close-popup @click="goToUserPage">
              <q-item-section avatar>
                <q-icon name="person" />
              </q-item-section>
              <q-item-section>Profile</q-item-section>
            </q-item>

            <q-separator />

            <q-item v-if="isLoggedIn" clickable v-close-popup @click="logout">
              <q-item-section avatar>
                <q-icon name="logout" />
              </q-item-section>
              <q-item-section>Logout</q-item-section>
            </q-item>

            <q-item v-else clickable v-close-popup @click="login">
              <q-item-section avatar>
                <q-icon name="login" />
              </q-item-section>
              <q-item-section>Login</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-toolbar>
  </q-header>

  <!-- Reboot Confirmation Dialog -->
  <q-dialog v-model="showRebootConfirm" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="restart_alt" color="warning" text-color="white" />
        <span class="q-ml-sm text-h6">Reboot System</span>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">Are you sure you want to reboot the system?</div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          This will restart the device and temporarily interrupt all services.
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey-7" @click="showRebootConfirm = false" />
        <q-btn
            flat
            label="Reboot"
            color="warning"
            @click="confirmReboot"
            :loading="systemActionLoading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Shutdown Confirmation Dialog -->
  <q-dialog v-model="showShutdownConfirm" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="power_settings_new" color="negative" text-color="white" />
        <span class="q-ml-sm text-h6">Shutdown System</span>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">Are you sure you want to shutdown the system?</div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          This will turn off the device completely. You will need physical access to turn it back on.
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey-7" @click="showShutdownConfirm = false" />
        <q-btn
            flat
            label="Shutdown"
            color="negative"
            @click="confirmShutdown"
            :loading="systemActionLoading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Update Confirmation Modal -->
  <Teleport to="body">
    <div v-if="showUpdateModal" class="update-modal-overlay" @click="cancelUpdate">
      <div class="update-modal" @click.stop>
        <div class="update-modal-header">
          <h3>System Update Available</h3>
        </div>

        <div class="update-modal-content">
          <div class="version-info">
            <div class="version-row">
              <span class="version-label">Current version:</span>
              <span class="version-value">{{ updateStore.formattedVersion }}</span>
            </div>
            <div class="version-row">
              <span class="version-label">New version:</span>
              <span class="version-value new">{{ updateStore.formattedRemoteVersion }}</span>
            </div>
          </div>

          <div class="warning-box">
            <q-icon name="warning" size="24px" color="orange" />
            <p><strong>Important:</strong> Do not turn off the device during the update process.</p>
          </div>
        </div>

        <div class="update-modal-actions">
          <q-btn flat label="Cancel" @click="cancelUpdate" />
          <q-btn color="primary" label="Update Now" @click="confirmUpdate" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.dark-mode {
  background-color: var(--q-dark-page);
  color: white;
}

.update-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.update-modal {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 450px;
  width: 90%;
  animation: slideIn 0.3s ease-out;
}

.dark-mode .update-modal {
  background-color: #1e1e1e;
  color: white;
}

.update-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.dark-mode .update-modal-header {
  border-bottom-color: #424242;
}

.update-modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.update-modal-content {
  padding: 24px;
}

.version-info {
  background-color: #f5f5f5;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
}

.dark-mode .version-info {
  background-color: #2a2a2a;
}

.version-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.version-row:not(:last-child) {
  border-bottom: 1px solid #e0e0e0;
}

.dark-mode .version-row:not(:last-child) {
  border-bottom-color: #424242;
}

.version-label {
  font-weight: 500;
  color: #666;
}

.dark-mode .version-label {
  color: #aaa;
}

.version-value {
  font-family: monospace;
  font-size: 14px;
}

.version-value.new {
  color: #4caf50;
  font-weight: 600;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background-color: #fff3e0;
  border: 1px solid #ffcc80;
  border-radius: 6px;
  padding: 16px;
}

.dark-mode .warning-box {
  background-color: rgba(255, 152, 0, 0.1);
  border-color: rgba(255, 152, 0, 0.3);
}

.warning-box p {
  margin: 0;
  flex: 1;
  line-height: 1.5;
}

.update-modal-actions {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dark-mode .update-modal-actions {
  border-top-color: #424242;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>