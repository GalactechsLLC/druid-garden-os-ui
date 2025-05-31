<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useFilesStore } from '@/stores/filesStore'
import type { FileEntry } from '@/types/files'
import {
  formatFileSize,
  formatDate,
  getItemIcon,
  getItemColor,
  getOperationIcon,
  getOperationColor,
  handleFileUpload as utilsHandleFileUpload
} from '@/utils/files'
import {useNotificationStore} from "@/stores/notificationStore.ts";
import Notification from "@/components/Notification.vue";

import {useDiskStore} from "@/stores/diskStore.ts";

const diskStore = useDiskStore()
const notificationStore = useNotificationStore()
const filesStore = useFilesStore()
const createFolderDialog = ref(false)
const newFolderName = ref('')
const createFileDialog = ref(false)
const newFileName = ref('')
const newFileContent = ref('')
const selectedFile = ref<File | null>(null);
const renameDialog = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const itemToRename = ref<FileEntry | null>(null)
const newItemName = ref('')
const fileContent = ref('')
const previewDialog = ref(false)
const previewItem = ref<FileEntry | null>(null)
const editMode = ref(false)
const confirmDeleteDialog = ref(false)
const itemsToDelete = ref<FileEntry[]>([])
const searchInput = ref('')
const fileInput = ref<FileEntry | null>(null)
const operationsTab = ref('operations')
const operationsDrawer = ref(false)
const rightClickMenu = ref({
  showing: false,
  x: 0,
  y: 0,
  item: null as FileEntry | null
})

const canNavigateUp = computed(() => {
  return filesStore.currentDirectory !== '/'
})
const hasClipboardItems = computed(() => {
  return filesStore.clipboardItems.items.length > 0 && filesStore.clipboardItems.operation !== null
})
const hasSearchResults = computed(() => {
  return filesStore.searchResults.length > 0 && filesStore.searchQuery !== ''
})
const displayedItems = computed(() => {
  if (hasSearchResults.value) {
    return filesStore.searchResults
  }
  return filesStore.filteredContents
})
const hasActiveOperations = computed(() => {
  return filesStore.hasActiveOperations
})

const clickTimer = ref<number | null>(null);
const clickDelay = 300;

const getFileName = (fullName: any) => {
  const lastDotIndex = fullName.lastIndexOf('.');
  return lastDotIndex > 0 ? fullName.substring(0, lastDotIndex) : fullName;
};

const getFileExtension = (fullName: any) => {
  const lastDotIndex = fullName.lastIndexOf('.');
  return lastDotIndex > 0 ? fullName.substring(lastDotIndex) : '';
};

function triggerFileInput() {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = (event) => handleFileUpload(event)
  input.click()
}
function handleItemClick(item: FileEntry, event: MouseEvent) {
  event.preventDefault();

  if (clickTimer.value !== null) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
    return;
  }

  clickTimer.value = window.setTimeout(() => {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    filesStore.selectItem(item, isMultiSelect, false);
    clickTimer.value = null;
  }, clickDelay);
}

async function handleItemDoubleClick(item: FileEntry) {
  console.log('Double click triggered for:', item.name);

  if (clickTimer.value !== null) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
  }

  const systemDirectories = ['bin', 'lib', 'lib64', 'sbin', 'dev', 'boot', 'etc', 'usr', 'proc', 'sys'];
  const itemName = item.name || '';
  const isSystemDirectory = systemDirectories.includes(itemName);

  if (item.entry_type === 'Directory' || isSystemDirectory) {
    filesStore.clearSelectedItems();

    try {
      if (isSystemDirectory && item.entry_type !== 'Directory') {
        notificationStore.error(`"${itemName}" is a system directory`);
        return;
      }

      await filesStore.navigateToDirectory(item.path);
    } catch (error) {
      console.error('Error navigating to directory:', error);
      notificationStore.error(`Unable to open directory: ${itemName}`);
    }
  } else {
    try {
      if (previewDialog.value) {
        console.log('Preview already open, skipping');
        return;
      }

      await openFilePreview(item);
    } catch (error) {
      console.error('Error caught in handleItemDoubleClick:', error);
    }
  }
}

function handleItemRightClick(item: FileEntry, event: MouseEvent) {
  event.preventDefault()
  if (!filesStore.selectedItems.some(i => i.path === item.path)) {
    filesStore.selectItem(item, false)
  }
  rightClickMenu.value = {
    showing: true,
    x: event.clientX,
    y: event.clientY,
    item
  }
}
function handleDocumentClick() {
  if (rightClickMenu.value.showing) {
    rightClickMenu.value.showing = false
  }
}

async function openFilePreview(item: FileEntry) {
  console.log('Opening file preview for:', item.name);

  if (previewDialog.value) {
    console.log('Preview already in progress, returning');
    return null;
  }

  try {
    previewItem.value = item;
    editMode.value = false;

    const content = await filesStore.openFile(item);
    fileContent.value = content;
    previewDialog.value = true;
    return content;
  } catch (error) {
    console.error('Full error in openFilePreview:', error);

    const errorDetail = error instanceof Error ? error.message :
        (typeof error === 'string' ? error :
            (error && typeof error === 'object' ? JSON.stringify(error) : 'Unknown error'));

    console.log('Error detail:', errorDetail);

    let errorMessage = 'Failed to open file';

    if (errorDetail.includes('stream did not contain valid UTF-8')) {
      errorMessage = `"${item.name}" contains binary data and cannot be displayed as text`;
    } else if (errorDetail.includes('IsADirectory') || errorDetail.includes('Cannot open Directory as File')) {
      errorMessage = `"${item.name}" is a directory, not a file`;
    } else if (errorDetail.includes('system file')) {
      errorMessage = `Cannot open system file: ${item.name}`;
    } else if (errorDetail.includes('InvalidData')) {
      errorMessage = `Cannot display "${item.name}": invalid data format`;
    } else if (errorDetail.includes('500 Internal Server Error')) {
      errorMessage = `Server error while opening ${item.name}`;
    } else if (errorDetail.includes('403')) {
      errorMessage = `Permission denied for file: ${item.name}`;
    } else if (errorDetail.includes('404')) {
      errorMessage = `File not found: ${item.name}`;
    }

    notificationStore.error(errorMessage);

    return null;
  }
}
function toggleEditMode() {
  editMode.value = !editMode.value
}
async function saveEditedFile() {
  if (!previewItem.value) return
  try {
    await filesStore.saveFile(previewItem.value.path, fileContent.value)
    editMode.value = false
    notificationStore.notify('positive', 'File saved successfully',{})
  } catch (error) {
    notificationStore.notify('negative', `Failed to save file: ${error}`,{})
  }
}
function closePreview() {
  previewDialog.value = false
  previewItem.value = null
  fileContent.value = ''
  editMode.value = false
  filesStore.closeFile()
}
function openCreateFolderDialog() {
  createFolderDialog.value = true
  newFolderName.value = ''
}
function createFolder() {
  if (!newFolderName.value.trim()) {
    notificationStore.notify('negative', 'Folder name cannot be empty',{})
    return
  }
  filesStore.createDirectory(newFolderName.value.trim())
      .then(() => {
        notificationStore.notify('positive', `Folder "${newFolderName.value}" created successfully`,{})
        createFolderDialog.value = false
        newFolderName.value = ''
      })
      .catch(error => {
        notificationStore.notify('negative', `Failed to create folder: ${error}`,{})
      })
}
function openCreateFileDialog() {
  createFileDialog.value = true
  newFileName.value = ''
  newFileContent.value = ''
}
function createFile() {
  if (!newFileName.value.trim()) {
    notificationStore.notify('negative', 'File name cannot be empty',{})
    return
  }
  filesStore.createFile(newFileName.value.trim(), newFileContent.value)
      .then(() => {
        notificationStore.notify('positive', `File "${newFileName.value}" created successfully`,{})
        createFileDialog.value = false
        newFileName.value = ''
        newFileContent.value = ''
      })
      .catch(error => {
        notificationStore.notify('negative', `Failed to create file: ${error}`,{})
      })
}
function openRenameDialog(item: FileEntry) {
  itemToRename.value = item
  newItemName.value = item.name || ''
  renameDialog.value = true
}
function renameItem() {
  if (!itemToRename.value || !newItemName.value.trim()) {
    notificationStore.notify('negative', 'New name cannot be empty',{})
    return
  }
  filesStore.renameItem(itemToRename.value, newItemName.value.trim())
      .then(() => {
        notificationStore.notify('positive', `Renamed to "${newItemName.value}" successfully`,{})
        renameDialog.value = false
        itemToRename.value = null
        newItemName.value = ''
      })
      .catch(error => {
        notificationStore.notify('negative', `Failed to rename: ${error}`,{})
      })
}
function openDeleteDialog(items: FileEntry[]) {
  itemsToDelete.value = items
  confirmDeleteDialog.value = true
}
function deleteItems() {
  filesStore.deleteItems(itemsToDelete.value)
      .then(() => {
        notificationStore.notify('positive', `${itemsToDelete.value.length} item(s) deleted successfully`,{})
        confirmDeleteDialog.value = false
        itemsToDelete.value = []
      })
      .catch(error => {
        notificationStore.notify('negative', `Failed to delete items: ${error}`,{})
      })
}
function copyItems() {
  const selectedItems = filesStore.selectedItems
  if (selectedItems.length === 0) return
  filesStore.copyToClipboard(selectedItems)
  notificationStore.notify('positive', `${selectedItems.length} item(s) copied to clipboard`,{})
}
function cutItems() {
  const selectedItems = filesStore.selectedItems
  if (selectedItems.length === 0) return
  filesStore.cutToClipboard(selectedItems)
  notificationStore.notify('positive', `${selectedItems.length} item(s) cut to clipboard`,{})
}
// Paste items from clipboard
function pasteItems() {
  if (!hasClipboardItems.value) return
  filesStore.pasteFromClipboard()
      .then(() => {
        notificationStore.notify('positive', 'Items pasted successfully',{})
      })
      .catch(error => {
        notificationStore.notify('negative', `Failed to paste items: ${error}`,{})
      })
}
// Handle file upload
function handleFileUpload(event: Event) {
  utilsHandleFileUpload(
      event,
      filesStore.createFile.bind(filesStore),
      notificationStore.notify.bind(notificationStore)
  );
}

function addCurrentToBookmarks() {
  const path = filesStore.currentDirectory
  const name = path === '/' ? 'Root' : path.split('/').pop() || path
  if (filesStore.addBookmark(path, name)) {
    notificationStore.notify('positive', `Added "${name}" to bookmarks`,{})
  } else {
    notificationStore.notify('info', 'This location is already bookmarked',{})
  }
}

const editablePath = ref(filesStore.currentDirectory);
watch(() => filesStore.currentDirectory, (newPath) => {
  editablePath.value = newPath;
});

function navigateToPath() {
  if (editablePath.value.trim()) {
    const path = editablePath.value.startsWith('/')
        ? editablePath.value
        : '/' + editablePath.value;

    filesStore.clearSelectedItems();

    filesStore.navigateToDirectory(path.trim())
        .catch(error => {
          notificationStore.notify('negative', `Failed to navigate: ${error}`,{})
          editablePath.value = filesStore.currentDirectory;
        });
  } else {
    editablePath.value = filesStore.currentDirectory;
  }
}

function getDiskColor(usedSpace: number, totalSpace: number): string {
  if (!totalSpace) return 'grey'
  const percentage = Math.round((usedSpace / totalSpace) * 100)
  if (percentage >= 90) return 'negative'
  if (percentage >= 70) return 'warning'
  return 'positive'
}

// Helper function to calculate percentage
function calculatePercentage(usedSpace: number, totalSpace: number): number {
  if (!totalSpace) return 0
  return Math.round((usedSpace / totalSpace) * 100)
}

function getDiskDisplayName(disk: any): string {
  if (disk.label) return disk.label
  if (disk.model) return disk.model
  if (disk.name) return disk.name
  return disk.device || 'Unknown Disk'
}

const hasMountedPartitions = computed(() => {
  if (!diskStore.disks || diskStore.disks.length === 0) return false;

  return diskStore.disks.some(disk =>
      disk.partitions && disk.partitions.some(partition => partition.mount_path)
  );
});
// Initialize
onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)

  try {
    await diskStore.fetchDisks()
    console.log('Disks loaded:', diskStore.disks)
  } catch (error) {
    console.error('Failed to load disks:', error)
  }

  filesStore.fetchDiskStats()
})


watch(searchInput, (newValue) => {
  if (!newValue.trim()) {
    filesStore.clearSearch()
  }
})
</script>

<template>
  <q-page padding>
    <!-- Header with title and actions -->
    <div class="row q-mb-lg items-center justify-between">
      <div>
        <h5 class="q-mt-none q-mb-xs">File Manager</h5>
      </div>

      <div class="row q-gutter-sm">
        <q-toggle
            v-model="filesStore.showHiddenFiles"
            label="Show hidden"
            color="primary"
            dense
        />

        <q-btn-group outline>
          <q-btn
              icon="view_list"
              :color="filesStore.viewMode === 'list' ? 'primary' : 'grey'"
              @click="filesStore.changeViewMode('list')"
              :disable="filesStore.viewMode === 'list'"
          >
            <q-tooltip>List view</q-tooltip>
          </q-btn>
          <q-btn
              icon="grid_view"
              :color="filesStore.viewMode === 'grid' ? 'primary' : 'grey'"
              @click="filesStore.changeViewMode('grid')"
              :disable="filesStore.viewMode === 'grid'"
          >
            <q-tooltip>Grid view</q-tooltip>
          </q-btn>
        </q-btn-group>

        <q-btn
            color="primary"
            icon="refresh"
            @click="filesStore.fetchDirectoryContents()"
            :loading="filesStore.loading"
        >
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Main content section -->
    <div class="row q-col-gutter-md">
      <!-- Left sidebar with bookmarks -->
      <div class="col-12 col-md-3">
        <!-- Bookmarks card -->
        <q-card class="q-mb-md">
          <q-card-section class="bg-primary text-white">
            <div class="text-h6 row justify-between items-center">
              <div>Bookmarks</div>
              <q-btn
                  flat
                  round
                  dense
                  icon="bookmark_add"
                  @click="addCurrentToBookmarks"
              >
                <q-tooltip>Add current location</q-tooltip>
              </q-btn>
            </div>
          </q-card-section>

          <q-card-section>
            <q-list>
              <q-item
                  v-for="bookmark in filesStore.bookmarks"
                  :key="bookmark.path"
                  clickable
                  @click="filesStore.navigateToDirectory(bookmark.path)"
              >
                <q-item-section avatar>
                  <q-icon :name="bookmark.icon || 'bookmark'" :color="bookmark.color || 'primary'" />
                </q-item-section>
                <q-item-section>{{ bookmark.name }}</q-item-section>
                <q-item-section side>
                  <q-btn
                      flat
                      round
                      dense
                      icon="delete"
                      color="grey"
                      @click.stop="filesStore.removeBookmark(bookmark.path)"
                  >
                    <q-tooltip>Remove bookmark</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>

              <q-item v-if="filesStore.bookmarks.length === 0">
                <q-item-section class="text-grey text-center">
                  No bookmarks yet
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- Disk usage card -->
        <q-card class="usage">
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Mounted Disks</div>
          </q-card-section>

          <!-- Loading state -->
          <q-card-section v-if="diskStore.loading">
            <div class="text-center q-py-md">
              <q-spinner color="primary" size="2rem" />
              <div class="q-mt-sm">Loading disks...</div>
            </div>
          </q-card-section>

          <!-- Error state -->
          <q-card-section v-else-if="diskStore.error">
            <div class="text-center text-negative q-py-md">
              <q-icon name="error" size="2rem" />
              <div class="q-mt-sm">{{ diskStore.error }}</div>
              <q-btn flat color="primary" label="Retry" class="q-mt-sm" @click="diskStore.fetchDisks()" />
            </div>
          </q-card-section>

          <!-- No mounted disks state -->
          <q-card-section v-else-if="!hasMountedPartitions">
            <div class="text-center text-grey q-py-md">
              <q-icon name="storage" size="2rem" />
              <div class="q-mt-sm">No mounted disks found</div>
            </div>
          </q-card-section>

          <!-- Mounted disks list -->
          <q-card-section v-else>
            <!-- Only show disks with mounted partitions -->
            <div
                v-for="disk in diskStore.disks.filter(d => d.partitions?.some(p => p.mount_path))"
                :key="disk.device"
                class="q-mb-lg"
            >
              <!-- Disk header (simplified) -->
              <div class="q-mb-sm">
                <div class="text-subtitle1 text-weight-medium">
                  <q-icon name="storage" class="q-mr-xs" />
                  {{ getDiskDisplayName(disk) }}
                </div>
              </div>

              <!-- Only show mounted partitions -->
              <div
                  v-for="partition in disk.partitions?.filter(p => p.mount_path)"
                  :key="partition.device"
                  class="q-mb-md"
              >
                <div class="row items-center q-mb-xs">
                  <div class="col">
                    <q-item
                        clickable
                        dense
                        @click="partition.mount_path ? filesStore.navigateToDirectory(partition.mount_path) : null"
                    >
                      <q-item-section avatar>
                        <q-icon name="folder" color="primary" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ partition.label || partition.device.split('/').pop() || 'Partition' }}
                          <q-badge v-if="partition.file_system" color="blue-grey" class="q-ml-sm">{{ partition.file_system }}</q-badge>
                        </q-item-label>
                        <q-item-label caption>
                          {{ partition.mount_path }}
                        </q-item-label>
                      </q-item-section>

                      <q-item-section side v-if="partition.space_info && partition.space_info.total_space">
                        <q-badge
                            :color="getDiskColor(partition.space_info.used_space, partition.space_info.total_space)"
                        >
                          {{ calculatePercentage(partition.space_info.used_space, partition.space_info.total_space) }}%
                        </q-badge>
                      </q-item-section>
                    </q-item>
                  </div>
                </div>

                <template v-if="partition.space_info && partition.space_info.total_space">
                  <q-linear-progress
                      :value="partition.space_info.used_space / partition.space_info.total_space"
                      size="10px"
                      :color="getDiskColor(partition.space_info.used_space, partition.space_info.total_space)"
                      class="q-mb-xs"
                  />

                  <div class="row justify-between text-caption q-px-sm">
                    <div>{{ formatFileSize(partition.space_info.used_space) }} used</div>
                    <div>{{ formatFileSize(partition.space_info.total_space - partition.space_info.used_space) }} free</div>
                  </div>

                  <div class="text-center text-caption q-mt-xs">
                    Total: {{ formatFileSize(partition.space_info.total_space) }}
                  </div>
                </template>

                <q-separator
                    class="q-my-sm"
                    v-if="disk.partitions != undefined && disk.partitions.filter(p => p.mount_path)?.indexOf(partition) < disk.partitions.filter(p => p.mount_path)?.length - 1"
                />
              </div>

<!--              <q-separator-->
<!--                  class="q-my-md"-->
<!--                  v-if="diskStore.disks.filter(d => d.partitions.some(p => p.mount_path)).indexOf(disk) < diskStore.disks.filter(d => d.partitions.some(p => p.mount_path)).length - 1"-->
<!--              />-->
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Main file browser area -->
      <div class="col-12 col-md-9">
        <q-card class="file-browser">
          <q-card-section class="bg-primary text-white sticky-header">
            <div class="row justify-between items-center">
              <div class="row items-center no-wrap">
                <q-btn-group flat>
                  <q-btn
                      flat
                      round
                      dense
                      icon="arrow_back"
                      @click="filesStore.navigateBack()"
                      :disable="!filesStore.canGoBack"
                      color="white"
                  >
                    <q-tooltip>Back</q-tooltip>
                  </q-btn>
                  <q-btn
                      flat
                      round
                      dense
                      icon="arrow_forward"
                      @click="filesStore.navigateForward()"
                      :disable="!filesStore.canGoForward"
                      color="white"
                  >
                    <q-tooltip>Forward</q-tooltip>
                  </q-btn>
                  <q-btn
                      flat
                      round
                      dense
                      icon="arrow_upward"
                      @click="filesStore.navigateUp()"
                      :disable="!canNavigateUp"
                      color="white"
                  >
                    <q-tooltip>Up</q-tooltip>
                  </q-btn>
                  <q-btn
                      flat
                      round
                      dense
                      icon="home"
                      @click="filesStore.navigateToDirectory('/')"
                      color="white"
                  >
                    <q-tooltip>Home</q-tooltip>
                  </q-btn>
                </q-btn-group>

                <q-input
                    v-model="editablePath"
                    dense
                    outlined
                    class="path-input bg-input-white q-ml-sm"
                    @keyup.enter="navigateToPath"
                    @blur="navigateToPath"
                >
                  <template v-slot:prepend>
                    <q-icon name="folder" color="primary" />
                  </template>
                  <template v-slot:append>
                    <q-btn
                        flat
                        round
                        dense
                        icon="arrow_forward"
                        color="primary"
                        @click="navigateToPath"
                    >
                      <q-tooltip>Navigate</q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
              </div>

              <div class="row q-gutter-sm">
                <q-btn
                    flat
                    round
                    dense
                    icon="create_new_folder"
                    @click="openCreateFolderDialog"
                >
                  <q-tooltip>Create folder</q-tooltip>
                </q-btn>

                <q-btn
                    flat
                    round
                    dense
                    icon="note_add"
                    @click="openCreateFileDialog"
                >
                  <q-tooltip>Create file</q-tooltip>
                </q-btn>

                <q-file
                    v-model="selectedFile"
                    @update:model-value="handleFileUpload"
                    outlined
                    dense
                    standout
                    accept="*/*"
                    style="display: none"
                >
                  </q-file>


                  <q-btn
                      flat
                      round
                      dense
                      icon="upload_file"
                      @click="triggerFileInput"
                  >
                    <q-tooltip>Upload file</q-tooltip>
                  </q-btn>

                  <q-btn
                      flat
                      round
                      dense
                      icon="content_copy"
                      @click="copyItems"
                      :disable="filesStore.selectedItems.length === 0"
                  >
                    <q-tooltip>Copy</q-tooltip>
                  </q-btn>

                  <q-btn
                      flat
                      round
                      dense
                      icon="content_cut"
                      @click="cutItems"
                      :disable="filesStore.selectedItems.length === 0"
                  >
                    <q-tooltip>Cut</q-tooltip>
                  </q-btn>

                  <q-btn
                      flat
                      round
                      dense
                      icon="content_paste"
                      @click="pasteItems"
                      :disable="!hasClipboardItems"
                  >
                    <q-tooltip>Paste</q-tooltip>
                  </q-btn>

                  <q-btn
                      flat
                      round
                      dense
                      icon="delete"
                      @click="openDeleteDialog(filesStore.selectedItems)"
                      :disable="filesStore.selectedItems.length === 0"
                  >
                    <q-tooltip>Delete</q-tooltip>
                  </q-btn>

                  <q-badge v-if="hasActiveOperations" :label="filesStore.activeFileOperations.length.toString()" color="primary">
                    <q-btn
                        flat
                        round
                        dense
                        icon="pending_actions"
                        @click="operationsDrawer = true"
                    >
                      <q-tooltip>Active operations</q-tooltip>
                    </q-btn>
                  </q-badge>
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <!-- Loading spinner -->
          <q-inner-loading :showing="filesStore.loading">
            <q-spinner size="50px" color="primary" />
          </q-inner-loading>

          <!-- Error message -->
<!--          <q-banner v-if="filesStore.error" class="bg-negative text-white">-->
<!--            {{ filesStore.error }}-->
<!--            <template v-slot:action>-->
<!--              <q-btn flat color="white" label="Retry" @click="filesStore.fetchDirectoryContents()" />-->
<!--            </template>-->
<!--          </q-banner>-->

          <!-- Search results notice -->
<!--          <q-banner v-if="hasSearchResults" class="bg-info text-white">-->
<!--            Showing {{ filesStore.searchResults.length }} results for "{{ filesStore.searchQuery }}"-->
<!--            <template v-slot:action>-->
<!--              <q-btn flat color="white" label="Clear" @click="clearSearch" />-->
<!--            </template>-->
<!--          </q-banner>-->

          <!-- Empty directory message -->
          <q-card-section v-if="displayedItems.length === 0 && !filesStore.loading">
            <div class="text-center q-pa-lg">
              <q-icon name="folder_open" size="4rem" color="grey-5" />
              <div class="text-h6 text-grey-7 q-mt-md">
                {{ hasSearchResults ? 'No search results found' : 'This folder is empty' }}
              </div>
              <div class="text-grey-6 q-mt-sm">
                {{ hasSearchResults
                  ? `Try a different search term`
                  : `Create a new file or folder, or upload content`}}
              </div>
              <div class="q-mt-md" v-if="!hasSearchResults">
                <q-btn color="primary" icon="create_new_folder" label="New Folder" @click="openCreateFolderDialog" class="q-mr-sm" />
                <q-btn color="secondary" icon="note_add" label="New File" @click="openCreateFileDialog" class="q-mr-sm" />
                <q-btn color="accent" icon="upload_file" label="Upload File" @click="triggerFileInput">
                </q-btn>
              </div>
            </div>
          </q-card-section>

          <!-- List view -->
          <q-card-section v-else-if="filesStore.viewMode === 'list' && displayedItems.length > 0">
            <q-table
                :rows="displayedItems"
                :columns="[
                { name: 'name', align: 'left', label: 'Name', field: 'name', sortable: true },
                { name: 'size', align: 'right', label: 'Size', field: 'size',
                  format: (val, row) => row.entry_type === 'Directory' ? '--' : formatFileSize(val),
                  sortable: true },
                { name: 'modified', align: 'right', label: 'Modified', field: 'modified',
                  format: val => formatDate(val), sortable: true },
                { name: 'permissions', align: 'center', label: 'Permissions', field: 'permissions' },
                { name: 'owner', align: 'center', label: 'Owner', field: 'owner' },
                { name: 'actions', align: 'right', label: 'Actions', field: 'actions' }
              ]"
                row-key="path"
                selection="multiple"
                v-model:selected="filesStore.selectedItems"
                :pagination="{ rowsPerPage: 0 }"
                :loading="filesStore.loading"
            >
              <template v-slot:body="props">
                <q-tr
                    :props="props"
                    :class="{'bg-blue-1': props.selected}"
                    @click="handleItemClick(props.row, $event)"
                    @dblclick="handleItemDoubleClick(props.row)"
                    @contextmenu="handleItemRightClick(props.row, $event)"
                >
                  <q-td auto-width>
                    <q-checkbox dense v-model="props.selected" />
                  </q-td>
                  <q-td key="name" :props="props">
                    <q-item>
                      <q-item-section avatar>
                        <q-icon :name="getItemIcon(props.row)" :color="getItemColor(props.row)" />
                      </q-item-section>
                      <q-item-section class="filename-truncate">
                        <span class="filename">{{ getFileName(props.row.name) }}</span><span class="extension">{{ getFileExtension(props.row.name) }}</span>
                        <q-badge v-if="props.row.isHidden" color="grey" text-color="white" label="hidden" />
                      </q-item-section>
                    </q-item>
                  </q-td>
                  <q-td key="size" :props="props">
                    {{ props.row.entry_type === 'Directory' ? '--' : formatFileSize(props.row.size) }}
                  </q-td>
                  <q-td key="modified" :props="props">
                    {{ formatDate(props.row.modified) }}
                  </q-td>
                  <q-td key="permissions" :props="props">
                    {{ props.row.permissions }}
                  </q-td>
                  <q-td key="owner" :props="props">
                    {{ props.row.owner }}
                  </q-td>
                  <q-td key="actions" :props="props">
                    <q-btn flat round dense icon="more_vert">
                      <q-menu>
                        <q-list style="min-width: 150px">
                          <q-item clickable v-close-popup @click="handleItemDoubleClick(props.row)">
                            <q-item-section avatar>
                              <q-icon :name="props.row.entry_type === 'Directory' ? 'folder_open' : 'visibility'" />
                            </q-item-section>
                            <q-item-section>{{ props.row.entry_type === 'Directory' ? 'Open' : 'View' }}</q-item-section>
                          </q-item>

                          <q-item v-if="props.row.entry_type === 'File'" clickable v-close-popup @click="toggleEditMode">
                            <q-item-section avatar>
                              <q-icon name="edit" />
                            </q-item-section>
                            <q-item-section>Edit</q-item-section>
                          </q-item>

                          <q-item clickable v-close-popup @click="openRenameDialog(props.row)">
                            <q-item-section avatar>
                              <q-icon name="drive_file_rename_outline" />
                            </q-item-section>
                            <q-item-section>Rename</q-item-section>
                          </q-item>

                          <q-separator />

                          <q-item clickable v-close-popup @click="filesStore.copyToClipboard([props.row])">
                            <q-item-section avatar>
                              <q-icon name="content_copy" />
                            </q-item-section>
                            <q-item-section>Copy</q-item-section>
                          </q-item>

                          <q-item clickable v-close-popup @click="filesStore.cutToClipboard([props.row])">
                            <q-item-section avatar>
                              <q-icon name="content_cut" />
                            </q-item-section>
                            <q-item-section>Cut</q-item-section>
                          </q-item>

                          <q-separator />

                          <q-item clickable v-close-popup @click="openDeleteDialog([props.row])">
                            <q-item-section avatar>
                              <q-icon name="delete" color="negative" />
                            </q-item-section>
                            <q-item-section class="text-negative">Delete</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </q-card-section>

          <!-- Grid view -->
          <q-card-section v-else-if="filesStore.viewMode === 'grid' && displayedItems.length > 0">
            <div class="row q-col-gutter-md">
              <div
                  v-for="item in displayedItems"
                  :key="item.path"
                  class="col-6 col-sm-4 col-md-3 col-lg-2"
              >
                <q-card
                    class="file-card"
                    :class="{'bg-blue-1': filesStore.selectedItems.some(i => i.path === item.path)}"
                    @click="handleItemClick(item, $event)"
                    @dblclick="handleItemDoubleClick(item)"
                    @contextmenu="handleItemRightClick(item, $event)"
                >
                  <q-card-section class="text-center">
                    <q-icon :name="getItemIcon(item)" :color="getItemColor(item)" size="3rem" />
                    <div class="text-subtitle2 q-mt-sm text-weight-medium text-center filename-truncate">
                      <span class="filename">{{ getFileName(item.name) }}</span><span class="extension">{{ getFileExtension(item.name) }}</span>
                      <q-badge v-if="item.isHidden" color="grey" text-color="white" label="hidden" />
                    </div>
                    <div class="text-caption text-grey q-mt-xs">
                      {{ item.entry_type === 'Directory' ? 'Folder' : formatFileSize(item.size) }}
                    </div>
                  </q-card-section>

                  <q-card-actions align="right">
                    <q-btn flat round dense icon="more_vert">
                      <q-menu>
                        <q-list style="min-width: 150px">
                          <q-item clickable v-close-popup @click="handleItemDoubleClick(item)">
                            <q-item-section avatar>
                              <q-icon :name="item.entry_type === 'Directory' ? 'folder_open' : 'visibility'" />
                            </q-item-section>
                            <q-item-section>{{ item.entry_type === 'Directory' ? 'Open' : 'View' }}</q-item-section>
                          </q-item>

                          <q-item v-if="item.entry_type === 'File'" clickable v-close-popup @click="toggleEditMode">
                            <q-item-section avatar>
                              <q-icon name="edit" />
                            </q-item-section>
                            <q-item-section>Edit</q-item-section>
                          </q-item>

                          <q-item clickable v-close-popup @click="openRenameDialog(item)">
                            <q-item-section avatar>
                              <q-icon name="drive_file_rename_outline" />
                            </q-item-section>
                            <q-item-section>Rename</q-item-section>
                          </q-item>

                          <q-separator />

                          <q-item clickable v-close-popup @click="filesStore.copyToClipboard([item])">
                            <q-item-section avatar>
                              <q-icon name="content_copy" />
                            </q-item-section>
                            <q-item-section>Copy</q-item-section>
                          </q-item>

                          <q-item clickable v-close-popup @click="filesStore.cutToClipboard([item])">
                            <q-item-section avatar>
                              <q-icon name="content_cut" />
                            </q-item-section>
                            <q-item-section>Cut</q-item-section>
                          </q-item>

                          <q-separator />

                          <q-item clickable v-close-popup @click="openDeleteDialog([item])">
                            <q-item-section avatar>
                              <q-icon name="delete" color="negative" />
                            </q-item-section>
                            <q-item-section class="text-negative">Delete</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </q-card-actions>
                </q-card>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Hidden file input for uploads -->
    <input type="file" ref="fileInput" @change="handleFileUpload" style="display: none" />

    <!-- Context menu -->
    <q-menu v-model="rightClickMenu.showing" :position="{ left: rightClickMenu.x, top: rightClickMenu.y }" context-menu>
      <q-list style="min-width: 150px" v-if="rightClickMenu.item">
        <q-item clickable v-close-popup @click="handleItemDoubleClick(rightClickMenu.item)">
          <q-item-section avatar>
            <q-icon :name="rightClickMenu.item.entry_type === 'Directory' ? 'folder_open' : 'visibility'" />
          </q-item-section>
          <q-item-section>{{ rightClickMenu.item.entry_type === 'Directory' ? 'Open' : 'View' }}</q-item-section>
        </q-item>

        <q-item v-if="rightClickMenu.item.entry_type === 'File'" clickable v-close-popup @click="openFilePreview(rightClickMenu.item)">
          <q-item-section avatar>
            <q-icon name="edit" />
          </q-item-section>
          <q-item-section>Edit</q-item-section>
        </q-item>

        <q-item clickable v-close-popup @click="openRenameDialog(rightClickMenu.item)">
          <q-item-section avatar>
            <q-icon name="drive_file_rename_outline" />
          </q-item-section>
          <q-item-section>Rename</q-item-section>
        </q-item>

        <q-separator />

        <q-item clickable v-close-popup @click="filesStore.copyToClipboard([rightClickMenu.item])">
          <q-item-section avatar>
            <q-icon name="content_copy" />
          </q-item-section>
          <q-item-section>Copy</q-item-section>
        </q-item>

        <q-item clickable v-close-popup @click="filesStore.cutToClipboard([rightClickMenu.item])">
          <q-item-section avatar>
            <q-icon name="content_cut" />
          </q-item-section>
          <q-item-section>Cut</q-item-section>
        </q-item>

        <q-separator />

        <q-item clickable v-close-popup @click="openDeleteDialog([rightClickMenu.item])">
          <q-item-section avatar>
            <q-icon name="delete" color="negative" />
          </q-item-section>
          <q-item-section class="text-negative">Delete</q-item-section>
        </q-item>
      </q-list>
    </q-menu>

    <!-- Operations drawer -->
    <q-drawer
        v-model="operationsDrawer"
        side="right"
        bordered
        :width="400"
        :breakpoint="600"
    >
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title>Operations</q-toolbar-title>
        <q-btn
            flat
            round
            dense
            icon="close"
            @click="operationsDrawer = false"
            v-close-popup
        />
      </q-toolbar>

      <q-tabs
          v-model="operationsTab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          narrow-indicator
      >
        <q-tab name="active" label="Active" :alert="filesStore.activeFileOperations.length > 0" />
        <q-tab name="completed" label="Completed" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="operationsTab" animated>
        <q-tab-panel name="active">
          <div class="text-h6 q-mb-md">Active Operations</div>

          <div v-if="filesStore.activeFileOperations.length === 0" class="text-center q-pa-lg">
            <q-icon name="done_all" size="4rem" color="positive" />
            <div class="text-h6 text-grey-7 q-mt-md">All operations completed</div>
          </div>

          <q-list v-else>
            <q-item
                v-for="operation in filesStore.activeFileOperations"
                :key="operation.id"
                class="q-py-md"
            >
              <q-item-section avatar>
                <q-icon :name="getOperationIcon(operation)" :color="getOperationColor(operation)" />
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ operation.type.charAt(0).toUpperCase() + operation.type.slice(1) }}</q-item-label>
                <q-item-label caption>
                  <div>{{ operation.source }}</div>
                  <div v-if="operation.destination">→ {{ operation.destination }}</div>
                </q-item-label>

                <q-linear-progress
                    :value="operation.progress / 100"
                    size="xs"
                    class="q-mt-xs"
                    :color="getOperationColor(operation)"
                />
              </q-item-section>

              <q-item-section side>
                <q-badge :color="getOperationColor(operation)">{{ operation.progress }}%</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <q-tab-panel name="completed">
          <div class="text-h6 q-mb-md">Completed Operations</div>

          <div v-if="filesStore.completedFileOperations.length === 0" class="text-center q-pa-lg">
            <q-icon name="history" size="4rem" color="grey-5" />
            <div class="text-h6 text-grey-7 q-mt-md">No completed operations</div>
          </div>

          <q-list v-else>
            <q-item
                v-for="operation in filesStore.completedFileOperations"
                :key="operation.id"
                class="q-py-md"
            >
              <q-item-section avatar>
                <q-icon :name="getOperationIcon(operation)" :color="getOperationColor(operation)" />
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ operation.type.charAt(0).toUpperCase() + operation.type.slice(1) }}</q-item-label>
                <q-item-label caption>
                  <div>{{ operation.source }}</div>
                  <div v-if="operation.destination">→ {{ operation.destination }}</div>
                  <div v-if="operation.error" class="text-negative">Error: {{ operation.error }}</div>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-badge :color="operation.status === 'completed' ? 'positive' : 'negative'">
                  {{ operation.status }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="q-pa-md">
            <q-btn
                color="grey"
                label="Clear History"
                @click="filesStore.clearOperationHistory()"
                class="full-width"
                v-if="filesStore.completedFileOperations.length > 0"
            />
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-drawer>

    <!-- Dialogs -->

    <!-- Create folder dialog -->
    <q-dialog v-model="createFolderDialog">
      <q-card style="min-width: 350px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Create New Folder</div>
        </q-card-section>

        <q-card-section>
          <q-input
              v-model="newFolderName"
              label="Folder Name"
              autofocus
              @keyup.enter="createFolder"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat label="Create" color="primary" @click="createFolder" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create file dialog -->
    <q-dialog v-model="createFileDialog">
      <q-card style="min-width: 500px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Create New File</div>
        </q-card-section>

        <q-card-section>
          <q-input
              v-model="newFileName"
              label="File Name"
              autofocus
          />

          <q-input
              v-model="newFileContent"
              label="File Content (optional)"
              type="textarea"
              rows="10"
              class="q-mt-md"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat label="Create" color="primary" @click="createFile" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Rename dialog -->
    <q-dialog v-model="renameDialog">
      <q-card style="min-width: 350px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Rename</div>
        </q-card-section>

        <q-card-section>
          <q-input
              v-model="newItemName"
              :label="`Rename ${itemToRename?.entry_type === 'Directory' ? 'Folder' : 'File'}`"
              autofocus
              @keyup.enter="renameItem"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat label="Rename" color="primary" @click="renameItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirmation dialog -->
    <q-dialog v-model="confirmDeleteDialog">
      <q-card style="min-width: 350px">
        <q-card-section class="bg-negative text-white">
          <div class="text-h6">Confirm Delete</div>
        </q-card-section>

        <q-card-section>
          <p>Are you sure you want to delete {{ itemsToDelete.length }} item(s)?</p>
          <p v-if="itemsToDelete.length <= 5">
            <span v-for="(item, index) in itemsToDelete" :key="item.path">
              {{ item.name }}{{ index < itemsToDelete.length - 1 ? ', ' : '' }}
            </span>
          </p>
          <p class="text-negative">This action cannot be undone.</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat label="Delete" color="negative" @click="deleteItems" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- File preview dialog -->
    <q-dialog v-model="previewDialog" maximized>
      <q-card>
        <q-bar class="bg-primary text-white">
          <div>{{ previewItem?.name }}</div>
          <q-space />
          <q-btn v-if="previewItem?.entry_type === 'File'" dense flat icon="edit" @click="toggleEditMode">
            <q-tooltip>Toggle Edit Mode</q-tooltip>
          </q-btn>
          <q-btn v-if="editMode" dense flat icon="save" @click="saveEditedFile">
            <q-tooltip>Save Changes</q-tooltip>
          </q-btn>
          <q-btn dense flat icon="close" @click="closePreview">
            <q-tooltip>Close</q-tooltip>
          </q-btn>
        </q-bar>

        <q-card-section class="scroll" style="max-height: 80vh">
          <!-- Text file preview/editor -->
          <div v-if="previewItem?.entry_type === 'File'">
            <div v-if="previewItem?.mimetype?.startsWith('image/')">
              <img :src="`data:${previewItem.mimetype};base64,${fileContent}`" style="max-width: 100%; max-height: 80vh;" />
            </div>
            <div v-else>
              <q-input
                  v-model="fileContent"
                  type="textarea"
                  :readonly="!editMode"
                  :label="editMode ? 'Editing' : 'Viewing'"
                  filled
                  autogrow
                  class="full-width"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" @click="closePreview" />
          <q-btn v-if="editMode" flat label="Save" color="positive" @click="saveEditedFile" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>

  <Notification></Notification>

  <!-- Hidden file input for uploads -->
  <input type="file" ref="fileInputRef" @change="handleFileUpload" style="display: none" />
</template>

<style scoped>
.file-browser {
  height: calc(100vh - 200px);
  overflow-y: auto;
}

.file-card {
  cursor: pointer;
  transition: all 0.2s ease;
  height: 100%;
}

.file-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* Truncate long filenames */
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* For the operations tab */
.operations-tab {
  height: 500px;
  overflow-y: auto;
}

.path-input {
  min-width: 400px;
  font-family: monospace;
}
.bg-input-white {
  background: #fff;
  border-radius: 4px;
}

.lh-32 {
  line-height: 25px;
  text-shadow:
      -1px -1px 0 rgba(0,0,0,.3),
      1px -1px 0 rgba(0,0,0,.3),
      -1px 1px 0 rgba(0,0,0,.3),
      1px 1px 0 rgba(0,0,0,.3);
}
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: white;
  padding-top: 16px;
  padding-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.usage .q-mb-lg {
  border-radius: 4px;
  box-shadow: 0 1px 5px #0003,0 2px 2px #00000024,0 3px 1px -2px #0000001f;
  padding: 12px 15px 1px;
}

.filename-truncate {
  max-width: 400px;
  display: inline-block;
}

.filename-truncate .filename {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 40px);
  display: inline-block;
  vertical-align: bottom;
}

.filename-truncate .extension {
  display: inline-block;
}

</style>