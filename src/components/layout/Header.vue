<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';
import { useDiskStore } from '@/stores/diskStore';
import { useUpdateStore } from '@/stores/updateStore';

const router = useRouter();
const userStore = useUserStore();
const themeStore = useThemeStore();
const diskStore = useDiskStore();
const updateStore = useUpdateStore();
const tab = ref('home');
const showDiskNotification = ref(false);

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
          @click="updateStore.isUpdateAvailable ? updateStore.startUpdate() : updateStore.checkForUpdates()"
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
</template>

<style>
.dark-mode {
  background-color: var(--q-dark-page);
  color: white;
}
</style>