<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDiskStore } from '@/stores/diskStore';
import { useConfigStore } from '@/stores/configStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { withApiLoading } from '@/utils/api';
import type { MountRequest, Partition } from '@/types/disk';
import * as DiskUtils from '@/utils/disk';

// Get the stores
const diskStore = useDiskStore();
const configStore = useConfigStore();
const notificationStore = useNotificationStore();

// Local implementation of isMountablePartition in case the import isn't working
function isMountablePartition(partition: Partition | null): boolean {
  if (!partition) return false;

  // If it has a mount_path, it's already mounted and NOT mountable
  if (partition.mount_path) return false;

  // If we get here, it's not mounted, so it SHOULD be mountable
  return true;
}

// Toggle for showing/hiding OS drives
const showOSDrives = ref(true);

// Function to check if a partition is an OS drive
const isOSDrive = (partition: Partition): boolean => {
  // Check if mounted at system directories
  if (partition.mount_path) {
    const systemMounts = ['/', '/boot', '/home', '/usr', '/var', '/tmp', '/opt'];
    return systemMounts.some(mount => partition.mount_path === mount || partition.mount_path?.startsWith(mount + '/'));
  }

  // Check common OS filesystem types and labels
  const osLabels = ['system', 'windows', 'boot', 'efi', 'recovery'];
  const label = partition.label?.toLowerCase() || '';

  return osLabels.some(osLabel => label.includes(osLabel)) ||
      partition.file_system?.toLowerCase().includes('efi') ||
      false;
};

// Auto-mount functionality
const autoMountTogglingPartitions = ref<Set<string>>(new Set());

// Check if a partition has auto-mount enabled
const isAutoMountEnabled = (partition: Partition): boolean => {
  if (!partition.uuid) return false;
  const key = `auto-mount-${partition.uuid}`;
  const config = configStore.configs.find(c => c.key === key);
  return !!config;
};

// Get the auto-mount path for a partition
const getAutoMountPath = (partition: Partition): string => {
  if (!partition.uuid) return '';
  const key = `auto-mount-${partition.uuid}`;
  const config = configStore.configs.find(c => c.key === key);
  return config?.value || '';
};

// Toggle auto-mount for a partition
const toggleAutoMount = async (partition: Partition): Promise<void> => {
  if (!partition.uuid) {
    notificationStore.error('Cannot enable auto-mount - partition has no UUID', {
      icon: 'error'
    });
    return;
  }

  const partitionId = partition.device;
  autoMountTogglingPartitions.value.add(partitionId);

  try {
    const key = `auto-mount-${partition.uuid}`;
    const isCurrentlyEnabled = isAutoMountEnabled(partition);

    if (isCurrentlyEnabled) {
      // Disable auto-mount by removing the config entry
      await configStore.deleteConfig(key);

      notificationStore.success(`Auto-mount disabled for ${getPartitionDisplayName(partition)}`, {
        icon: 'toggle_off'
      });
    } else {
      // Enable auto-mount by creating the config entry
      const defaultMountPath = `/mnt/${partition.uuid}`;

      await configStore.createConfig({
        key: key,
        value: defaultMountPath,
        category: 'preferences',
        system: 0,
        description: `Auto-mount configuration for partition ${partition.device}`,
        plugin: 'disk_manager',
        type: 'text'
      });

      notificationStore.success(`Auto-mount enabled for ${getPartitionDisplayName(partition)} at ${defaultMountPath}`, {
        icon: 'toggle_on'
      });
    }
  } catch (error) {
    console.error('Error toggling auto-mount:', error);
    notificationStore.error('Failed to update auto-mount setting', {
      icon: 'error'
    });
  } finally {
    autoMountTogglingPartitions.value.delete(partitionId);
  }
};

// Computed property to filter disks based on OS drive visibility
const filteredDisks = computed(() => {
  if (showOSDrives.value) {
    return diskStore.disks;
  }

  return diskStore.disks.map(disk => ({
    ...disk,
    partitions: disk.partitions?.filter(partition => !isOSDrive(partition)) || []
  })).filter(disk => disk.partitions.length > 0);
});

// For mount dialog
const mountDialogOpen = ref(false);
const selectedPartition = ref<Partition | null>(null);
const mountPath = ref('');
const mountingInProgress = ref(false);
const enableAutoMountOnMount = ref(false);

// For unmount confirm dialog
const unmountConfirmOpen = ref(false);
const partitionToUnmount = ref<Partition | null>(null);

// For info dialog
const infoDialogOpen = ref(false);
const partitionInfo = ref<Partition | null>(null);

// For label dialog
const labelDialogOpen = ref(false);
const partitionToLabel = ref<Partition | null>(null);
const newLabel = ref('');
const labelingInProgress = ref(false);

const mountOptions = ref('');
const mountReadOnly = ref(false);
const mountNoexec = ref(false);
const mountSync = ref(false);
const mountSetUid = ref(false);
const mountUid = ref(1000);
const mountGid = ref(1000);

const getPartitionDisplayName = (partition: Partition): string => {
  if (!partition.uuid) return partition.name || partition.device;

  const customLabel = configStore.getDriveLabel(partition.uuid);
  if (customLabel) return customLabel;

  if (partition.label) return partition.label;

  return partition.name || partition.device;
};

// Build mount options string
const buildMountOptionsString = (): string => {
  if (!selectedPartition.value) return 'defaults';

  return DiskUtils.buildMountOptionsString(
      mountOptions.value,
      mountReadOnly.value,
      mountNoexec.value,
      mountSync.value,
      mountSetUid.value,
      mountUid.value,
      mountGid.value,
      selectedPartition.value
  );
};

// Reset mount dialog options to defaults
const resetMountOptions = () => {
  mountOptions.value = '';
  mountReadOnly.value = false;
  mountNoexec.value = false;
  mountSync.value = false;
  mountSetUid.value = false;
  mountUid.value = 1000;
  mountGid.value = 1000;
  enableAutoMountOnMount.value = false;
};

// Show partition info dialog
const showPartitionInfo = (partition: Partition): void => {
  partitionInfo.value = partition;
  infoDialogOpen.value = true;
};

// Show unmount confirmation dialog
const confirmUnmount = (partition: Partition): void => {
  partitionToUnmount.value = partition;
  unmountConfirmOpen.value = true;
};

// Show label dialog
const showLabelDialog = (partition: Partition): void => {
  console.log('🏷️ Trying to label partition:', partition);

  if (!partition.uuid) {
    notificationStore.error(`Cannot label partition "${partition.name || partition.device}" - no UUID available`, {
      icon: 'error'
    });
    return;
  }

  partitionToLabel.value = partition;
  const existingLabel = configStore.getDriveLabel(partition.uuid);
  newLabel.value = existingLabel || '';
  labelDialogOpen.value = true;
};

// Save partition label
const savePartitionLabel = async (): Promise<void> => {
  // Add comprehensive null checks
  if (!partitionToLabel.value) {
    console.error('partitionToLabel.value is null');
    return;
  }

  if (!partitionToLabel.value.uuid) {
    console.error('partitionToLabel.value.uuid is null');
    notificationStore.error('Cannot save label - partition has no UUID', { icon: 'error' });
    return;
  }

  const uuid = partitionToLabel.value.uuid;
  // Handle null, undefined, or empty string as "delete the entry"
  const trimmedLabel = (newLabel.value || '').trim();

  try {
    await withApiLoading(
        labelingInProgress,
        async () => {
          // Get current labeled drives - add null check here too
          const currentLabeledDrives = configStore.labeledDrives;
          if (!currentLabeledDrives) {
            throw new Error('Failed to get current labeled drives');
          }

          const currentDrives = { ...currentLabeledDrives };

          if (trimmedLabel === '') {
            delete currentDrives[uuid];
          } else {
            currentDrives[uuid] = trimmedLabel;
          }

          const newValue = JSON.stringify(currentDrives);
          await configStore.updateConfig('labeled_drives', newValue);

          labelDialogOpen.value = false;

          const labelText = trimmedLabel === '' ? 'removed' : `set to "${trimmedLabel}"`;
          notificationStore.success(`Partition label ${labelText}`, {
            icon: 'label'
          });

          return true;
        },
        {
          showSuccessNotification: false,
          showErrorNotification: true,
          errorMessage: 'Failed to update partition label'
        }
    );
  } catch (error) {
    console.error('Error in savePartitionLabel:', error);
    notificationStore.error('Failed to save partition label', { icon: 'error' });
  }
};

const openMountDialog = (partition: Partition): void => {
  selectedPartition.value = partition;

  if (partition.uuid) {
    mountPath.value = `/mnt/${partition.uuid}`;
  } else {
    // Use partition name if available, fallback to device path
    const deviceName = (partition.name || partition.device).replace('/dev/', '');
    mountPath.value = `/mnt/${deviceName}`;
  }

  resetMountOptions();

  // Set auto-mount checkbox to current state
  enableAutoMountOnMount.value = isAutoMountEnabled(partition);

  const fstype = partition.file_system?.toLowerCase() || '';

  // Handle ExFAT specifically (common in the new format)
  if (fstype.includes('exfat')) {
    mountOptions.value = 'uid=1000,gid=1000,utf8=1';
    mountSetUid.value = true;
  } else if (fstype.includes('ntfs')) {
    mountOptions.value = 'uid=1000,gid=1000,dmask=027,fmask=137';
    mountSetUid.value = true;
  } else if (fstype.includes('fat')) {
    mountOptions.value = 'uid=1000,gid=1000,utf8=1';
    mountSetUid.value = true;
  } else {
    mountOptions.value = 'defaults';
  }

  mountDialogOpen.value = true;
};

const mountPartition = async (): Promise<void> => {
  if (!selectedPartition.value || !mountPath.value) return;

  await withApiLoading(
      mountingInProgress,
      async () => {
        const mountRequest: MountRequest = {
          device_path: selectedPartition.value!.device,
          mount_path: mountPath.value,
          auto_mount: enableAutoMountOnMount.value
        };

        const optionsString = buildMountOptionsString();
        if (optionsString !== 'defaults') {
          mountRequest.options = optionsString;
        }

        if (selectedPartition.value!.uuid) {
          mountRequest.by_uuid = true;
          mountRequest.uuid = selectedPartition.value!.uuid;
        }

        // Call the mount function
        await diskStore.mountDiskWithOptions(mountRequest);

        // Close dialog and refresh
        mountDialogOpen.value = false;
        await fetchDisks(false);

        return true;
      },
      {
        showSuccessNotification: true,
        successMessage: `Partition ${selectedPartition.value.device} mounted at ${mountPath.value}${enableAutoMountOnMount.value ? ' with auto-mount enabled' : ''}`,
        showErrorNotification: true,
        errorMessage: 'Failed to mount partition'
      }
  );
};

const unmountPartition = async (partition: Partition): Promise<void> => {
  if (!partition.mount_path) return;

  unmountConfirmOpen.value = false;

  if (partition.loading === undefined) {
    partition.loading = true;
  } else {
    partition.loading = true;
  }

  try {
    await diskStore.unmountDisk(partition.mount_path);

    notificationStore.success(`Partition ${partition.device} unmounted successfully`, {
      icon: 'check_circle'
    });

    // Refresh to update UI
    await fetchDisks(false);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    notificationStore.error(`Failed to unmount: ${errorMessage}`, {
      icon: 'error'
    });
  } finally {
    partition.loading = false;
  }
};

const fetchDisks = async (show_notif: boolean): Promise<void> => {
  try {
    diskStore.error = null;

    await diskStore.fetchDisks();

    // Add debug logging to see the processed data
    console.log('🔍 Fetched disks:', diskStore.disks);
    if (diskStore.disks.length > 0) {
      console.log('🔍 First disk partitions:', diskStore.disks[0].partitions);
    }

    if(show_notif) {
      notificationStore.success('Storage devices refreshed', {
        icon: 'refresh',
        timeout: 2000
      });
    }
  } catch (error) {
    console.error('Error fetching disks:', error);

    notificationStore.error('Failed to refresh storage devices', {
      icon: 'error'
    });
  }
};

onMounted(async () => {
  await Promise.all([
    fetchDisks(false),
    configStore.fetchConfigs()
  ]);
});
</script>

<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h6 q-mb-md">Storage Manager</div>
      <div class="row items-center q-gutter-sm">
        <q-toggle
            v-model="showOSDrives"
            label="Show OS Drives"
            color="primary"
            class="text-caption"
        />
        <q-btn
            round
            dense
            flat
            color="primary"
            icon="refresh"
            @click="fetchDisks(true)"
            :loading="diskStore.loading"
            :disable="diskStore.loading"
            title="Reload Devices"
        >
          <q-tooltip>Reload Devices</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Disk list -->
    <div v-if="filteredDisks.length > 0" :class="{'device-list': true, 'loading-list': diskStore.loading}">
      <q-card v-for="disk in filteredDisks" :key="disk.device" class="q-mb-md disk-card">
        <q-card-section>
          <div class="row items-center">
            <!-- Use appropriate icon based on disk type -->
            <q-icon :name="disk.device?.includes('nvme') ? 'memory' : 'storage'" size="md" class="q-mr-md" />
            <div class="col">
              <div class="text-subtitle1">{{ disk.model || 'Unknown Device' }}</div>
              <div class="text-caption">
                {{ DiskUtils.formatSize(disk.total) }} • {{ DiskUtils.getDiskTypeDescription(disk) }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle2">Partitions</div>
            <q-space />
            <q-badge color="grey-7" v-if="disk.partitions?.length">
              {{ disk.partitions.length }} partition{{ disk.partitions.length !== 1 ? 's' : '' }}
            </q-badge>
          </div>

          <div v-if="disk.partitions && disk.partitions.length > 0">
            <q-list separator>
              <q-item
                  v-for="partition in disk.partitions"
                  :key="partition.device"
                  :class="{
                  'partition-item--mounted': partition.mount_path,
                  'partition-item--unmounted': !partition.mount_path,
                  'partition-item--os': isOSDrive(partition),
                  'partition-item--auto-mount': isAutoMountEnabled(partition),
                  'partition-item': true
                }"
              >
                <q-item-section avatar>
                  <q-icon :name="partition.mount_path ? 'link' : 'link_off'" />
                  <q-icon
                      v-if="isOSDrive(partition)"
                      name="computer"
                      size="xs"
                      color="orange"
                      class="absolute"
                      style="top: 28px; right: 10px;"
                  >
                    <q-tooltip>OS Drive</q-tooltip>
                  </q-icon>
                  <q-icon
                      v-if="isAutoMountEnabled(partition)"
                      name="sync"
                      size="xs"
                      color="green"
                      class="absolute"
                      style="top: 28px; right: 25px;"
                  >
                    <q-tooltip>Auto-mount enabled</q-tooltip>
                  </q-icon>
                </q-item-section>

                <q-item-section>
                  <q-item-label>
                    <span class="text-weight-medium">{{ getPartitionDisplayName(partition) }}</span>
                    <q-badge v-if="partition.file_system" color="blue-grey-7" class="q-ml-sm">
                      {{ DiskUtils.getFilesystemDescription(partition.file_system) }}
                    </q-badge>
                    <q-icon
                        v-if="partition.uuid && configStore.getDriveLabel(partition.uuid)"
                        name="label"
                        size="xs"
                        color="primary"
                        class="q-ml-xs"
                    >
                      <q-tooltip>Custom Label</q-tooltip>
                    </q-icon>
                    <q-badge v-if="isAutoMountEnabled(partition)" color="green" class="q-ml-sm">
                      Auto-mount
                    </q-badge>
                  </q-item-label>

                  <q-item-label caption>
                    {{ partition.device }}
                    <span v-if="partition.name && partition.name !== partition.device"> ({{ partition.name }})</span>
                    {{ partition.space_info ? ' • ' + DiskUtils.formatSize(partition.space_info.total_space) : ' • Unknown size' }}
                    <template v-if="partition.mount_path">
                      • Mounted at: <span class="text-primary">{{ partition.mount_path }}</span>
                    </template>
                    <template v-else>
                      • Not mounted
                    </template>
                    <template v-if="isAutoMountEnabled(partition)">
                      • Auto-mount: <span class="text-green">{{ getAutoMountPath(partition) }}</span>
                    </template>
                  </q-item-label>

                  <q-item-label v-if="partition.label || partition.uuid" caption>
                    <template v-if="partition.label && !configStore.getDriveLabel(partition.uuid || '')">
                      Label: {{ partition.label }}
                    </template>
                    <template v-if="partition.uuid">
                      {{ (partition.label && !configStore.getDriveLabel(partition.uuid)) ? ' • ' : '' }}UUID: {{ partition.uuid }}
                    </template>
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="row items-center q-gutter-xs">
                    <!-- Auto-mount toggle -->
                    <q-toggle
                        v-if="partition.uuid && !isOSDrive(partition)"
                        :model-value="isAutoMountEnabled(partition)"
                        @update:model-value="toggleAutoMount(partition)"
                        :loading="autoMountTogglingPartitions.has(partition.device)"
                        :disable="autoMountTogglingPartitions.has(partition.device)"
                        color="green"
                        size="sm"
                        dense
                    >
                      <q-tooltip>{{ isAutoMountEnabled(partition) ? 'Disable' : 'Enable' }} auto-mount</q-tooltip>
                    </q-toggle>

                    <q-btn
                        v-if="partition.mount_path"
                        color="negative"
                        label="Unmount"
                        flat
                        dense
                        @click="confirmUnmount(partition)"
                        :loading="partition.loading"
                    />
                    <q-btn
                        v-else-if="isMountablePartition(partition)"
                        color="primary"
                        label="Mount"
                        flat
                        dense
                        @click="openMountDialog(partition)"
                        :loading="partition.loading"
                    />
                    <q-btn
                        color="info"
                        label="Info"
                        flat
                        dense
                        @click="showPartitionInfo(partition)"
                    />
                    <q-btn
                        v-if="partition.uuid"
                        color="secondary"
                        icon="label"
                        flat
                        dense
                        @click="showLabelDialog(partition)"
                        title="Set Custom Label"
                    >
                      <q-tooltip>Set Custom Label</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <div v-else class="text-grey-7 q-pa-md text-center">
            {{ showOSDrives ? 'No partitions found' : 'No non-OS partitions found' }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-else-if="diskStore.loading" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
      <div class="q-mt-md">Loading storage devices...</div>
    </div>
    <div v-else class="text-center q-pa-xl text-grey-7">
      {{ showOSDrives ? 'No storage devices detected' : 'No non-OS storage devices detected' }}
    </div>

    <!-- Label Dialog -->
    <q-dialog v-model="labelDialogOpen" persistent>
      <q-card style="width: 450px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">
            <q-icon name="label" class="q-mr-sm" />
            Set Custom Label
          </div>
          <div v-if="partitionToLabel" class="text-caption q-mt-sm text-grey-7">
            <strong>Device:</strong> {{ partitionToLabel.device }}
            <br v-if="partitionToLabel.uuid" />
            <span v-if="partitionToLabel.uuid"><strong>UUID:</strong> {{ partitionToLabel.uuid }}</span>
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
              v-model="newLabel"
              label="Custom Label"
              hint="Enter a custom name for this partition"
              placeholder="e.g., Work Drive, Media Storage, Backup..."
              maxlength="50"
              counter
              clearable
              autofocus
              @keyup.enter="savePartitionLabel"
          >
            <template v-slot:prepend>
              <q-icon name="edit" />
            </template>
          </q-input>

          <div v-if="partitionToLabel && partitionToLabel.label" class="q-mt-md">
            <q-chip
                icon="info"
                color="blue-grey-2"
                text-color="blue-grey-8"
                class="q-mb-xs"
            >
              Original label: {{ partitionToLabel.label }}
            </q-chip>
          </div>

          <div class="q-mt-md text-caption text-grey-6">
            <q-icon name="info" size="xs" class="q-mr-xs" />
            Leave empty to remove the custom label and use the original name
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn
              flat
              label="Cancel"
              color="grey-7"
              v-close-popup
              class="q-mr-sm"
          />
          <q-btn
              unelevated
              label="Save Label"
              color="primary"
              @click="savePartitionLabel"
              :loading="labelingInProgress"
              icon="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Mount Dialog -->
    <q-dialog v-model="mountDialogOpen" persistent>
      <q-card style="width: 500px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">Mount {{ selectedPartition ? getPartitionDisplayName(selectedPartition) : 'Partition' }}</div>
          <div v-if="selectedPartition" class="text-caption q-mt-sm">
            {{ selectedPartition.space_info ? DiskUtils.formatSize(selectedPartition.space_info.total_space) : 'Unknown size' }} •
            {{ DiskUtils.getFilesystemDescription(selectedPartition.file_system) }}
            <span v-if="selectedPartition.label"> • {{ selectedPartition.label }}</span>
            <span v-if="selectedPartition.uuid"> • Mount using UUID: {{ selectedPartition.uuid }}</span>
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="mountPartition">
            <div class="row q-col-gutter-md">
              <div class="col-12">
                <q-input
                    v-model="mountPath"
                    label="Mount Point"
                    :rules="[val => !!val || 'Mount point is required']"
                    hint="Directory where the partition will be mounted"
                />
              </div>

              <div class="col-12" v-if="selectedPartition && selectedPartition.uuid">
                <q-toggle
                    v-model="enableAutoMountOnMount"
                    label="Enable auto-mount"
                    color="green"
                />
                <div class="text-caption text-grey-6 q-mt-xs">
                  If enabled, this partition will be automatically mounted at this location on system startup
                </div>
              </div>

              <div class="col-12">
                <q-expansion-item
                    switch-toggle-side
                    expand-separator
                    label="Advanced Options"
                    caption="Filesystem-specific mount options"
                >
                  <q-card>
                    <q-card-section>
                      <q-input
                          v-model="mountOptions"
                          label="Mount Options"
                          hint="Comma-separated list of mount options"
                      />

                      <div class="q-mt-md">
                        <q-toggle v-model="mountReadOnly" label="Read-only" />
                      </div>

                      <div class="q-mt-sm">
                        <q-toggle v-model="mountNoexec" label="No executable files" />
                      </div>

                      <div class="q-mt-sm">
                        <q-toggle v-model="mountSync" label="Synchronous writes" />
                      </div>

                      <div
                          v-if="selectedPartition && DiskUtils.isWindowsNativeFs(selectedPartition.file_system)"
                          class="q-mt-sm"
                      >
                        <q-toggle v-model="mountSetUid" label="Set owner UID/GID" />

                        <div v-if="mountSetUid" class="row q-col-gutter-md q-mt-sm">
                          <div class="col-6">
                            <q-input v-model.number="mountUid" type="number" label="User ID" min="0" max="65535" />
                          </div>
                          <div class="col-6">
                            <q-input v-model.number="mountGid" type="number" label="Group ID" min="0" max="65535" />
                          </div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </q-expansion-item>
              </div>
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative" v-close-popup />
          <q-btn flat label="Mount" color="primary" @click="mountPartition" :loading="mountingInProgress" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Partition Info Dialog -->
    <q-dialog v-model="infoDialogOpen">
      <q-card style="width: 600px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">Partition Information</div>
        </q-card-section>

        <q-card-section v-if="partitionInfo">
          <q-list dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>Display Name</q-item-label>
                <q-item-label>{{ getPartitionDisplayName(partitionInfo) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.name && partitionInfo.name !== partitionInfo.device">
              <q-item-section>
                <q-item-label caption>Partition Name</q-item-label>
                <q-item-label>{{ partitionInfo.name }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label caption>Device</q-item-label>
                <q-item-label>{{ partitionInfo.device }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.file_system">
              <q-item-section>
                <q-item-label caption>File System</q-item-label>
                <q-item-label>{{ DiskUtils.getFilesystemDescription(partitionInfo.file_system) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.mount_path">
              <q-item-section>
                <q-item-label caption>Mount Point</q-item-label>
                <q-item-label>{{ partitionInfo.mount_path }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.uuid && isAutoMountEnabled(partitionInfo)">
              <q-item-section>
                <q-item-label caption>Auto-mount Path</q-item-label>
                <q-item-label class="text-green">{{ getAutoMountPath(partitionInfo) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.space_info">
              <q-item-section>
                <q-item-label caption>Total Space</q-item-label>
                <q-item-label>{{ DiskUtils.formatSize(partitionInfo.space_info.total_space) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.space_info">
              <q-item-section>
                <q-item-label caption>Used Space</q-item-label>
                <q-item-label>{{ DiskUtils.formatSize(partitionInfo.space_info.used_space) }}
                  ({{ ((partitionInfo.space_info.used_space / partitionInfo.space_info.total_space) * 100).toFixed(2) }}%)
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.space_info">
              <q-item-section>
                <q-item-label caption>Free Space</q-item-label>
                <q-item-label>{{ DiskUtils.formatSize(partitionInfo.space_info.free_space) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.uuid && configStore.getDriveLabel(partitionInfo.uuid)">
              <q-item-section>
                <q-item-label caption>Custom Label</q-item-label>
                <q-item-label>{{ configStore.getDriveLabel(partitionInfo.uuid) }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.label">
              <q-item-section>
                <q-item-label caption>Original Label</q-item-label>
                <q-item-label>{{ partitionInfo.label }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="partitionInfo.uuid">
              <q-item-section>
                <q-item-label caption>UUID</q-item-label>
                <q-item-label>{{ partitionInfo.uuid }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div v-if="partitionInfo.space_info" class="q-mt-md">
            <div class="text-subtitle2 q-mb-xs">Disk Usage</div>
            <q-linear-progress
                size="25px"
                :value="partitionInfo.space_info.used_space / partitionInfo.space_info.total_space"
                :color="
                (partitionInfo.space_info.used_space / partitionInfo.space_info.total_space) > 0.9 ? 'negative' :
                (partitionInfo.space_info.used_space / partitionInfo.space_info.total_space) > 0.7 ? 'warning' :
                'positive'
              "
            >
              <div class="absolute-full flex flex-center">
                <q-badge color="white" text-color="black" :label="`${((partitionInfo.space_info.used_space / partitionInfo.space_info.total_space) * 100).toFixed(2)}%`" />
              </div>
            </q-linear-progress>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
          <q-btn
              v-if="partitionInfo && partitionInfo.uuid"
              flat
              label="Edit Label"
              color="secondary"
              icon="label"
              @click="() => {
              infoDialogOpen = false;
              if (partitionInfo) showLabelDialog(partitionInfo);
            }"
          />
          <q-btn
              v-if="partitionInfo && partitionInfo.uuid && !isOSDrive(partitionInfo)"
              flat
              :label="isAutoMountEnabled(partitionInfo) ? 'Disable Auto-mount' : 'Enable Auto-mount'"
              :color="isAutoMountEnabled(partitionInfo) ? 'negative' : 'positive'"
              :icon="isAutoMountEnabled(partitionInfo) ? 'toggle_off' : 'toggle_on'"
              @click="() => {
              infoDialogOpen = false;
              if (partitionInfo) toggleAutoMount(partitionInfo);
            }"
          />
          <q-btn
              v-if="partitionInfo && !partitionInfo.mount_path && isMountablePartition(partitionInfo)"
              flat
              label="Mount"
              color="primary"
              @click="() => {
              infoDialogOpen = false;
              if (partitionInfo) openMountDialog(partitionInfo);
            }"
          />
          <q-btn
              v-if="partitionInfo && partitionInfo.mount_path"
              flat
              label="Unmount"
              color="negative"
              @click="() => {
              infoDialogOpen = false;
              if (partitionInfo) confirmUnmount(partitionInfo);
            }"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Unmount Confirmation Dialog -->
    <q-dialog v-model="unmountConfirmOpen" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="warning" text-color="white" />
          <span class="q-ml-sm">Are you sure you want to unmount this partition?</span>
        </q-card-section>

        <q-card-section v-if="partitionToUnmount">
          <div><strong>Display Name:</strong> {{ getPartitionDisplayName(partitionToUnmount) }}</div>
          <div><strong>Device:</strong> {{ partitionToUnmount.device }}</div>
          <div v-if="partitionToUnmount.file_system">
            <strong>Filesystem:</strong> {{ DiskUtils.getFilesystemDescription(partitionToUnmount.file_system) }}
          </div>
          <div v-if="partitionToUnmount.mount_path">
            <strong>Mount Point:</strong> {{ partitionToUnmount.mount_path }}
          </div>
          <div v-if="partitionToUnmount.uuid && isAutoMountEnabled(partitionToUnmount)">
            <strong>Auto-mount:</strong> <span class="text-green">Enabled ({{ getAutoMountPath(partitionToUnmount) }})</span>
          </div>

          <q-banner class="q-mt-md bg-warning text-white">
            <template v-slot:avatar>
              <q-icon name="info" />
            </template>
            Unmounting a partition may interrupt any running processes accessing files on this partition. Make sure all files are closed before proceeding.
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn
              flat
              label="Unmount"
              color="negative"
              :loading="partitionToUnmount?.loading"
              @click="partitionToUnmount && unmountPartition(partitionToUnmount)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.partition-item--mounted {
  background-color: rgba(33, 186, 69, 0.04);
}

.partition-item--unmounted {
  background-color: rgba(0, 0, 0, 0.01);
}

.partition-item--os {
  border-left: 3px solid #ff9800;
}

.partition-item--auto-mount {
  border-right: 3px solid #4caf50;
}

.partition-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.device-list {
  transition: opacity 0.3s ease;
}

.loading-list {
  opacity: 0.6;
  pointer-events: none;
}

.device-list .partition-item {
  padding: 10px 40px 10px 30px;
}

@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
</style>