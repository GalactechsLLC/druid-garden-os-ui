<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Notification from '@/components/Notification.vue';
import SystemPreferencesTab from '@/components/settings/SystemPreferencesTab.vue';
import NetworkTab from '@/components/settings/NetworkTab.vue';
import DeviceManagerTab from '@/components/settings/DeviceManagerTab.vue';

const mainTab = ref(localStorage.getItem('settingsTab') || 'system');

watch(mainTab, (newTab) => {
  localStorage.setItem('settingsTab', newTab);
});

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && ['system', 'network', 'devices'].includes(tabParam)) {
    mainTab.value = tabParam;
  }
});

const updateUrlTab = (tab: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url);
};
</script>

<template>
  <q-page padding>
    <div class="">
      <div class="row q-mb-md items-center">
        <h5 class="q-mt-none q-mb-xs">Settings</h5>
      </div>

      <q-tabs
          v-model="mainTab"
          align="left"
          narrow-indicator
          class="text-primary q-mb-md"
          dense
          @update:model-value="updateUrlTab"
      >
        <q-tab name="system" label="System Preferences" icon="settings" />
        <q-tab name="network" label="WiFi & Network" icon="wifi" />
        <q-tab name="devices" label="Storage Manager" icon="storage" />
      </q-tabs>

      <q-tab-panels v-model="mainTab" animated>
        <q-tab-panel name="system">
          <SystemPreferencesTab />
        </q-tab-panel>

        <q-tab-panel name="network">
          <NetworkTab />
        </q-tab-panel>

        <q-tab-panel name="devices">
          <DeviceManagerTab />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <Notification />
  </q-page>
</template>