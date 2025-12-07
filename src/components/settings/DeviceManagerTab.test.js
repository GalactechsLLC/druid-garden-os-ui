import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

// Mock stores
const mockDiskStore = {
    disks: [
        {
            device: '/dev/sda',
            model: 'Samsung SSD 970 EVO',
            total: 1000000000000, // 1TB
            partitions: [
                {
                    device: '/dev/sda1',
                    name: '/dev/sda1',
                    uuid: 'uuid-1234-5678',
                    label: 'System',
                    file_system: 'ext4',
                    mount_path: '/',
                    space_info: {
                        total_space: 500000000000,
                        used_space: 250000000000,
                        free_space: 250000000000
                    },
                    loading: false
                },
                {
                    device: '/dev/sda2',
                    name: '/dev/sda2',
                    uuid: 'uuid-abcd-efgh',
                    label: 'Data',
                    file_system: 'ntfs',
                    mount_path: null,
                    space_info: {
                        total_space: 500000000000,
                        used_space: 100000000000,
                        free_space: 400000000000
                    },
                    loading: false
                }
            ]
        }
    ],
    loading: false,
    error: null,
    fetchDisks: vi.fn().mockResolvedValue(undefined),
    mountDiskWithOptions: vi.fn().mockResolvedValue(undefined),
    unmountDisk: vi.fn().mockResolvedValue(undefined)
}

const mockConfigStore = {
    configs: [
        {
            key: 'labeled_drives',
            value: '{"uuid-1234-5678":"Custom System Drive","uuid-abcd-efgh":"My Data Drive"}',
            category: 'preferences'
        },
        {
            key: 'auto-mount-uuid-abcd-efgh',
            value: '/mnt/uuid-abcd-efgh',
            category: 'preferences'
        }
    ],
    labeledDrives: {
        'uuid-1234-5678': 'Custom System Drive',
        'uuid-abcd-efgh': 'My Data Drive'
    },
    fetchConfigs: vi.fn().mockResolvedValue(undefined),
    createConfig: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    deleteConfig: vi.fn().mockResolvedValue(undefined),
    getDriveLabel: vi.fn((uuid) => {
        const labels = {
            'uuid-1234-5678': 'Custom System Drive',
            'uuid-abcd-efgh': 'My Data Drive'
        }
        return labels[uuid] || null
    })
}

const mockNotificationStore = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
}

// Mock modules
vi.mock('@/stores/diskStore', () => ({
    useDiskStore: () => mockDiskStore
}))

vi.mock('@/stores/configStore', () => ({
    useConfigStore: () => mockConfigStore
}))

vi.mock('@/stores/notificationStore', () => ({
    useNotificationStore: () => mockNotificationStore
}))

vi.mock('@/utils/api', () => ({
    withApiLoading: vi.fn(async (loadingRef, operation, options) => {
        try {
            loadingRef.value = true
            const result = await operation()
            if (options?.showSuccessNotification) {
                mockNotificationStore.success(options.successMessage)
            }
            return result
        } catch (error) {
            if (options?.showErrorNotification) {
                mockNotificationStore.error(options.errorMessage)
            }
            throw error
        } finally {
            loadingRef.value = false
        }
    })
}))

vi.mock('@/utils/disk', () => ({
    formatSize: vi.fn((size) => `${(size / 1000000000).toFixed(1)}GB`),
    getDiskTypeDescription: vi.fn(() => 'SSD'),
    getFilesystemDescription: vi.fn((fs) => fs?.toUpperCase() || 'Unknown'),
    buildMountOptionsString: vi.fn(() => 'defaults'),
    isWindowsNativeFs: vi.fn((fs) => fs?.toLowerCase().includes('ntfs') || fs?.toLowerCase().includes('fat'))
}))

// Mock types module to prevent import errors
vi.mock('@/types/disk', () => ({
    MountRequest: {},
    Partition: {}
}))

// Import the component after mocks are set up
import DeviceManagerTab from '@/components/settings/DeviceManagerTab.vue'

// Get references to the mocked functions for testing
const mockWithApiLoading = vi.mocked((await import('@/utils/api')).withApiLoading)
const mockDiskUtils = await import('@/utils/disk')

function createWrapper(propsData = {}, useShallow = false) {
    const mountFunction = useShallow ? shallowMount : mount

    const defaultOptions = {
        props: { ...propsData },
        global: {
            stubs: {
                'q-card': true,
                'q-card-section': true,
                'q-card-actions': true,
                'q-list': true,
                'q-item': true,
                'q-item-section': true,
                'q-item-label': true,
                'q-btn': {
                    template: '<button><slot></slot></button>',
                    props: ['loading', 'disable', 'color', 'label', 'flat', 'dense', 'round', 'icon'],
                    emits: ['click']
                },
                'q-toggle': {
                    template: '<div><slot></slot></div>',
                    props: ['modelValue', 'label', 'color', 'loading', 'disable'],
                    emits: ['update:modelValue']
                },
                'q-icon': true,
                'q-badge': true,
                'q-tooltip': true,
                'q-spinner': true,
                'q-separator': true,
                'q-space': true,
                'q-dialog': {
                    template: '<div><slot></slot></div>',
                    props: ['modelValue', 'persistent']
                },
                'q-input': {
                    template: '<input />',
                    props: ['modelValue', 'label', 'rules', 'hint', 'placeholder', 'maxlength', 'counter', 'clearable', 'autofocus'],
                    emits: ['update:modelValue', 'keyup']
                },
                'q-form': {
                    template: '<form><slot></slot></form>',
                    emits: ['submit']
                },
                'q-expansion-item': {
                    template: '<div><slot></slot></div>',
                    props: ['label', 'caption']
                },
                'q-linear-progress': true,
                'q-banner': true,
                'q-avatar': true,
                'q-chip': true
            }
        }
    }

    return mountFunction(DeviceManagerTab, defaultOptions)
}

// Sample partition data
const samplePartitions = {
    mounted: {
        device: '/dev/sda1',
        name: '/dev/sda1',
        uuid: 'uuid-1234-5678',
        label: 'System',
        file_system: 'ext4',
        mount_path: '/',
        space_info: {
            total_space: 500000000000,
            used_space: 250000000000,
            free_space: 250000000000
        },
        loading: false
    },
    unmounted: {
        device: '/dev/sda2',
        name: '/dev/sda2',
        uuid: 'uuid-abcd-efgh',
        label: 'Data',
        file_system: 'ntfs',
        mount_path: null,
        space_info: {
            total_space: 500000000000,
            used_space: 100000000000,
            free_space: 400000000000
        },
        loading: false
    }
}

describe('DeviceManagerTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Reset store state
        mockDiskStore.disks = [
            {
                device: '/dev/sda',
                model: 'Samsung SSD 970 EVO',
                total: 1000000000000,
                partitions: [samplePartitions.mounted, samplePartitions.unmounted]
            }
        ]
        mockDiskStore.loading = false
        mockDiskStore.error = null

        // Reset mock implementations
        mockDiskStore.fetchDisks.mockResolvedValue(undefined)
        mockDiskStore.mountDiskWithOptions.mockResolvedValue(undefined)
        mockDiskStore.unmountDisk.mockResolvedValue(undefined)
        mockConfigStore.fetchConfigs.mockResolvedValue(undefined)
        mockConfigStore.createConfig.mockResolvedValue(undefined)
        mockConfigStore.updateConfig.mockResolvedValue(undefined)
        mockConfigStore.deleteConfig.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Initialization', () => {
        it('renders without crashing', () => {
            const wrapper = createWrapper()
            expect(wrapper.exists()).toBe(true)
        })

        it('initializes stores on mount', async () => {
            createWrapper()
            await nextTick()

            expect(mockDiskStore.fetchDisks).toHaveBeenCalled()
            expect(mockConfigStore.fetchConfigs).toHaveBeenCalled()
        })

        it('displays Storage Manager title', () => {
            const wrapper = createWrapper()
            expect(wrapper.text()).toContain('Storage Manager')
        })

        it('initializes with show OS drives enabled', () => {
            const wrapper = createWrapper()
            expect(wrapper.vm.showOSDrives).toBe(true)
        })
    })

    describe('Disk Display and Filtering', () => {
        it('displays all disks when show OS drives is enabled', async () => {
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.filteredDisks).toHaveLength(1)
            expect(wrapper.vm.filteredDisks[0].partitions).toHaveLength(2)
        })

        it('filters out OS drives when show OS drives is disabled', async () => {
            const wrapper = createWrapper()
            wrapper.vm.showOSDrives = false
            await nextTick()

            const filtered = wrapper.vm.filteredDisks
            expect(filtered).toHaveLength(1)
            // Should filter out the system partition (mounted at /)
            expect(filtered[0].partitions).toHaveLength(1)
            expect(filtered[0].partitions[0].device).toBe('/dev/sda2')
        })

        it('identifies OS drives correctly', () => {
            const wrapper = createWrapper()

            // System partition mounted at / should be OS drive
            expect(wrapper.vm.isOSDrive(samplePartitions.mounted)).toBe(true)

            // Data partition should not be OS drive
            expect(wrapper.vm.isOSDrive(samplePartitions.unmounted)).toBe(false)
        })

        it('handles empty disk list', async () => {
            mockDiskStore.disks = []
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.filteredDisks).toHaveLength(0)
        })
    })

    describe('Partition Display Names', () => {
        it('uses custom label when available', () => {
            const wrapper = createWrapper()

            const displayName = wrapper.vm.getPartitionDisplayName(samplePartitions.mounted)
            expect(displayName).toBe('Custom System Drive')
        })

        it('falls back to original label when no custom label', () => {
            mockConfigStore.getDriveLabel.mockReturnValue(null)
            const wrapper = createWrapper()

            const partition = { ...samplePartitions.unmounted, uuid: 'new-uuid' }
            const displayName = wrapper.vm.getPartitionDisplayName(partition)
            expect(displayName).toBe('Data')
        })

        it('uses device name when no label or custom label', () => {
            mockConfigStore.getDriveLabel.mockReturnValue(null)
            const wrapper = createWrapper()

            const partition = { device: '/dev/sdc1', name: '/dev/sdc1', uuid: null, label: null }
            const displayName = wrapper.vm.getPartitionDisplayName(partition)
            expect(displayName).toBe('/dev/sdc1')
        })
    })

    describe('Auto-mount Functionality', () => {
        it('correctly identifies auto-mount enabled partitions', () => {
            const wrapper = createWrapper()

            // Partition with auto-mount config should be enabled
            expect(wrapper.vm.isAutoMountEnabled(samplePartitions.unmounted)).toBe(true)

            // Partition without auto-mount config should be disabled
            expect(wrapper.vm.isAutoMountEnabled(samplePartitions.mounted)).toBe(false)
        })

        it('gets auto-mount path correctly', () => {
            const wrapper = createWrapper()

            const path = wrapper.vm.getAutoMountPath(samplePartitions.unmounted)
            expect(path).toBe('/mnt/uuid-abcd-efgh')
        })

        it('enables auto-mount successfully', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, uuid: 'new-uuid' }

            // Mock that auto-mount is currently disabled
            mockConfigStore.configs = mockConfigStore.configs.filter(c => !c.key.includes('new-uuid'))

            await wrapper.vm.toggleAutoMount(partition)

            expect(mockConfigStore.createConfig).toHaveBeenCalledWith({
                key: 'auto-mount-new-uuid',
                value: '/mnt/new-uuid',
                category: 'preferences',
                system: 0,
                description: 'Auto-mount configuration for partition /dev/sda2',
                plugin: 'disk_manager',
                type: 'text'
            })
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Auto-mount enabled for Data at /mnt/new-uuid',
                { icon: 'toggle_on' }
            )
        })

        it('disables auto-mount successfully', async () => {
            const wrapper = createWrapper()

            await wrapper.vm.toggleAutoMount(samplePartitions.unmounted)

            expect(mockConfigStore.deleteConfig).toHaveBeenCalledWith('auto-mount-uuid-abcd-efgh')
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Auto-mount disabled for My Data Drive',
                { icon: 'toggle_off' }
            )
        })

        it('handles auto-mount toggle for partition without UUID', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, uuid: null }

            await wrapper.vm.toggleAutoMount(partition)

            expect(mockConfigStore.createConfig).not.toHaveBeenCalled()
            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Cannot enable auto-mount - partition has no UUID',
                { icon: 'error' }
            )
        })

        it('handles auto-mount toggle errors', async () => {
            const wrapper = createWrapper()
            mockConfigStore.deleteConfig.mockRejectedValueOnce(new Error('Config error'))

            await wrapper.vm.toggleAutoMount(samplePartitions.unmounted)

            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Failed to update auto-mount setting',
                { icon: 'error' }
            )
        })
    })

    describe('Mount Dialog', () => {
        it('opens mount dialog with correct defaults', async () => {
            const wrapper = createWrapper()

            wrapper.vm.openMountDialog(samplePartitions.unmounted)
            await nextTick()

            expect(wrapper.vm.mountDialogOpen).toBe(true)
            expect(wrapper.vm.selectedPartition).toEqual(samplePartitions.unmounted)
            expect(wrapper.vm.mountPath).toBe('/mnt/uuid-abcd-efgh')
            expect(wrapper.vm.enableAutoMountOnMount).toBe(true) // Should match current auto-mount state
        })

        it('sets filesystem-specific mount options for NTFS', async () => {
            const wrapper = createWrapper()

            wrapper.vm.openMountDialog(samplePartitions.unmounted)
            await nextTick()

            expect(wrapper.vm.mountOptions).toBe('uid=1000,gid=1000,dmask=027,fmask=137')
            expect(wrapper.vm.mountSetUid).toBe(true)
        })

        it('sets default mount options for ext4', async () => {
            const wrapper = createWrapper()

            wrapper.vm.openMountDialog(samplePartitions.mounted)
            await nextTick()

            expect(wrapper.vm.mountOptions).toBe('defaults')
        })

        it('handles partition without UUID', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, uuid: null, name: '/dev/sdc1' }

            wrapper.vm.openMountDialog(partition)
            await nextTick()

            expect(wrapper.vm.mountPath).toBe('/mnt/sdc1')
        })
    })

    describe('Mount Operations', () => {
        it('mounts partition successfully', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedPartition = samplePartitions.unmounted
            wrapper.vm.mountPath = '/mnt/test'
            wrapper.vm.enableAutoMountOnMount = true
            await nextTick()

            await wrapper.vm.mountPartition()

            expect(mockDiskStore.mountDiskWithOptions).toHaveBeenCalledWith({
                device_path: '/dev/sda2',
                mount_path: '/mnt/test',
                auto_mount: true,
                by_uuid: true,
                uuid: 'uuid-abcd-efgh'
            })
            expect(wrapper.vm.mountDialogOpen).toBe(false)
            expect(mockDiskStore.fetchDisks).toHaveBeenCalled()
        })

        it('mounts partition with custom options', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedPartition = samplePartitions.unmounted
            wrapper.vm.mountPath = '/mnt/test'
            wrapper.vm.mountOptions = 'uid=1000,gid=1000'
            vi.mocked(mockDiskUtils.buildMountOptionsString).mockReturnValue('uid=1000,gid=1000')
            await nextTick()

            await wrapper.vm.mountPartition()

            expect(mockDiskStore.mountDiskWithOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: 'uid=1000,gid=1000'
                })
            )
        })

        it('handles mount without selected partition', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedPartition = null
            await nextTick()

            await wrapper.vm.mountPartition()

            expect(mockDiskStore.mountDiskWithOptions).not.toHaveBeenCalled()
        })
    })

    describe('Unmount Operations', () => {
        it('opens unmount confirmation dialog', async () => {
            const wrapper = createWrapper()

            wrapper.vm.confirmUnmount(samplePartitions.mounted)
            await nextTick()

            expect(wrapper.vm.unmountConfirmOpen).toBe(true)
            expect(wrapper.vm.partitionToUnmount).toEqual(samplePartitions.mounted)
        })

        it('unmounts partition successfully', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.mounted }

            await wrapper.vm.unmountPartition(partition)

            expect(mockDiskStore.unmountDisk).toHaveBeenCalledWith('/')
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Partition /dev/sda1 unmounted successfully',
                { icon: 'check_circle' }
            )
            expect(wrapper.vm.unmountConfirmOpen).toBe(false)
            expect(mockDiskStore.fetchDisks).toHaveBeenCalled()
        })

        it('handles unmount errors', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.mounted }
            mockDiskStore.unmountDisk.mockRejectedValueOnce(new Error('Unmount failed'))

            await wrapper.vm.unmountPartition(partition)

            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Failed to unmount: Unmount failed',
                { icon: 'error' }
            )
        })

        it('handles partition without mount path', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted }

            await wrapper.vm.unmountPartition(partition)

            expect(mockDiskStore.unmountDisk).not.toHaveBeenCalled()
        })

        it('manages loading state during unmount', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.mounted }

            const unmountPromise = wrapper.vm.unmountPartition(partition)
            expect(partition.loading).toBe(true)

            await unmountPromise
            expect(partition.loading).toBe(false)
        })
    })

    describe('Label Management', () => {
        it('opens label dialog with existing label', async () => {
            const wrapper = createWrapper()

            wrapper.vm.showLabelDialog(samplePartitions.unmounted)
            await nextTick()

            expect(wrapper.vm.labelDialogOpen).toBe(true)
            expect(wrapper.vm.partitionToLabel).toEqual(samplePartitions.unmounted)
            expect(wrapper.vm.newLabel).toBe('My Data Drive')
        })

        it('handles partition without UUID for labeling', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, uuid: null }

            wrapper.vm.showLabelDialog(partition)
            await nextTick()

            expect(wrapper.vm.labelDialogOpen).toBe(false)
            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Cannot label partition "/dev/sda2" - no UUID available',
                { icon: 'error' }
            )
        })

        it('saves partition label successfully', async () => {
            const wrapper = createWrapper()
            wrapper.vm.partitionToLabel = samplePartitions.unmounted
            wrapper.vm.newLabel = 'New Custom Label'
            await nextTick()

            await wrapper.vm.savePartitionLabel()

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith(
                'labeled_drives',
                '{"uuid-1234-5678":"Custom System Drive","uuid-abcd-efgh":"New Custom Label"}'
            )
            expect(wrapper.vm.labelDialogOpen).toBe(false)
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Partition label set to "New Custom Label"',
                { icon: 'label' }
            )
        })

        it('removes partition label when empty', async () => {
            const wrapper = createWrapper()
            wrapper.vm.partitionToLabel = samplePartitions.unmounted
            wrapper.vm.newLabel = ''
            await nextTick()

            await wrapper.vm.savePartitionLabel()

            expect(mockConfigStore.updateConfig).toHaveBeenCalledWith(
                'labeled_drives',
                '{"uuid-1234-5678":"Custom System Drive"}'
            )
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Partition label removed',
                { icon: 'label' }
            )
        })

        it('handles save label errors', async () => {
            const wrapper = createWrapper()
            wrapper.vm.partitionToLabel = samplePartitions.unmounted
            wrapper.vm.newLabel = 'New Label'
            mockConfigStore.updateConfig.mockRejectedValueOnce(new Error('Update failed'))
            await nextTick()

            await wrapper.vm.savePartitionLabel()

            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Failed to save partition label',
                { icon: 'error' }
            )
        })

        it('handles null partition for save label', async () => {
            const wrapper = createWrapper()
            wrapper.vm.partitionToLabel = null
            await nextTick()

            await wrapper.vm.savePartitionLabel()

            expect(mockConfigStore.updateConfig).not.toHaveBeenCalled()
        })
    })

    describe('Partition Info Dialog', () => {
        it('opens partition info dialog', async () => {
            const wrapper = createWrapper()

            wrapper.vm.showPartitionInfo(samplePartitions.mounted)
            await nextTick()

            expect(wrapper.vm.infoDialogOpen).toBe(true)
            expect(wrapper.vm.partitionInfo).toEqual(samplePartitions.mounted)
        })
    })

    describe('Mountable Partition Check', () => {
        it('identifies mountable partitions correctly', () => {
            const wrapper = createWrapper()

            // Unmounted partition should be mountable
            expect(wrapper.vm.isMountablePartition(samplePartitions.unmounted)).toBe(true)

            // Mounted partition should not be mountable
            expect(wrapper.vm.isMountablePartition(samplePartitions.mounted)).toBe(false)

            // Null partition should not be mountable
            expect(wrapper.vm.isMountablePartition(null)).toBe(false)
        })
    })

    describe('Refresh Functionality', () => {
        it('refreshes disks with notification', async () => {
            const wrapper = createWrapper()

            await wrapper.vm.fetchDisks(true)

            expect(mockDiskStore.fetchDisks).toHaveBeenCalled()
            expect(mockNotificationStore.success).toHaveBeenCalledWith(
                'Storage devices refreshed',
                { icon: 'refresh', timeout: 2000 }
            )
        })

        it('refreshes disks without notification', async () => {
            const wrapper = createWrapper()

            await wrapper.vm.fetchDisks(false)

            expect(mockDiskStore.fetchDisks).toHaveBeenCalled()
            expect(mockNotificationStore.success).not.toHaveBeenCalled()
        })

        it('handles refresh errors', async () => {
            const wrapper = createWrapper()
            mockDiskStore.fetchDisks.mockRejectedValueOnce(new Error('Fetch failed'))

            await wrapper.vm.fetchDisks(true)

            expect(mockNotificationStore.error).toHaveBeenCalledWith(
                'Failed to refresh storage devices',
                { icon: 'error' }
            )
        })
    })

    describe('Mount Options', () => {
        it('builds mount options string correctly', () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedPartition = samplePartitions.unmounted
            wrapper.vm.mountOptions = 'custom=option'
            vi.mocked(mockDiskUtils.buildMountOptionsString).mockReturnValue('custom=option,uid=1000')

            const options = wrapper.vm.buildMountOptionsString()

            expect(mockDiskUtils.buildMountOptionsString).toHaveBeenCalledWith(
                'custom=option',
                false, // mountReadOnly
                false, // mountNoexec
                false, // mountSync
                false, // mountSetUid
                1000,  // mountUid
                1000,  // mountGid
                samplePartitions.unmounted
            )
            expect(options).toBe('custom=option,uid=1000')
        })

        it('resets mount options to defaults', () => {
            const wrapper = createWrapper()
            wrapper.vm.mountOptions = 'custom=option'
            wrapper.vm.mountReadOnly = true
            wrapper.vm.mountNoexec = true
            wrapper.vm.mountSync = true
            wrapper.vm.mountSetUid = true
            wrapper.vm.mountUid = 2000
            wrapper.vm.mountGid = 2000
            wrapper.vm.enableAutoMountOnMount = true

            wrapper.vm.resetMountOptions()

            expect(wrapper.vm.mountOptions).toBe('')
            expect(wrapper.vm.mountReadOnly).toBe(false)
            expect(wrapper.vm.mountNoexec).toBe(false)
            expect(wrapper.vm.mountSync).toBe(false)
            expect(wrapper.vm.mountSetUid).toBe(false)
            expect(wrapper.vm.mountUid).toBe(1000)
            expect(wrapper.vm.mountGid).toBe(1000)
            expect(wrapper.vm.enableAutoMountOnMount).toBe(false)
        })
    })

    describe('Computed Properties', () => {
        it('computes labeled drives map correctly', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.labeledDrivesMap).toEqual({
                'uuid-1234-5678': 'Custom System Drive',
                'uuid-abcd-efgh': 'My Data Drive'
            })
        })

        it('handles invalid labeled drives JSON', () => {
            mockConfigStore.configs = [
                {
                    key: 'labeled_drives',
                    value: 'invalid-json',
                    category: 'preferences'
                }
            ]
            const wrapper = createWrapper()

            expect(wrapper.vm.labeledDrivesMap).toEqual({})
        })

        it('handles missing labeled drives config', () => {
            mockConfigStore.configs = []
            const wrapper = createWrapper()

            expect(wrapper.vm.labeledDrivesMap).toEqual({})
        })
    })

    describe('UI State Management', () => {
        it('manages mount dialog state', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.mountDialogOpen).toBe(false)
            expect(wrapper.vm.selectedPartition).toBeNull()
            expect(wrapper.vm.mountPath).toBe('')
            expect(wrapper.vm.mountingInProgress).toBe(false)
        })

        it('manages unmount dialog state', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.unmountConfirmOpen).toBe(false)
            expect(wrapper.vm.partitionToUnmount).toBeNull()
        })

        it('manages info dialog state', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.infoDialogOpen).toBe(false)
            expect(wrapper.vm.partitionInfo).toBeNull()
        })

        it('manages label dialog state', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.labelDialogOpen).toBe(false)
            expect(wrapper.vm.partitionToLabel).toBeNull()
            expect(wrapper.vm.newLabel).toBe('')
            expect(wrapper.vm.labelingInProgress).toBe(false)
        })

        it('manages auto-mount toggling state', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.autoMountTogglingPartitions).toBeInstanceOf(Set)
            expect(wrapper.vm.autoMountTogglingPartitions.size).toBe(0)
        })

        it('manages show OS drives toggle', async () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.showOSDrives).toBe(true)

            wrapper.vm.showOSDrives = false
            await nextTick()

            expect(wrapper.vm.showOSDrives).toBe(false)
        })
    })

    describe('Error Handling', () => {
        it('handles disk store errors gracefully', async () => {
            const wrapper = createWrapper()
            mockDiskStore.error = 'Failed to load disks'
            await nextTick()

            // Component should still render and function
            expect(wrapper.exists()).toBe(true)
        })

        it('handles missing space_info gracefully', () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, space_info: null }

            // Should not throw error when accessing partition without space_info
            const displayName = wrapper.vm.getPartitionDisplayName(partition)
            expect(displayName).toBeDefined()
        })

        it('handles partition with undefined properties', () => {
            const wrapper = createWrapper()
            const partition = {
                device: '/dev/sdc1',
                name: undefined,
                uuid: undefined,
                label: undefined,
                file_system: undefined,
                mount_path: undefined,
                space_info: undefined
            }

            expect(() => {
                wrapper.vm.getPartitionDisplayName(partition)
                wrapper.vm.isOSDrive(partition)
                wrapper.vm.isMountablePartition(partition)
                wrapper.vm.isAutoMountEnabled(partition)
            }).not.toThrow()
        })
    })

    describe('Integration Tests', () => {
        it('handles complete mount workflow', async () => {
            const wrapper = createWrapper()

            // Open mount dialog
            wrapper.vm.openMountDialog(samplePartitions.unmounted)
            await nextTick()

            expect(wrapper.vm.mountDialogOpen).toBe(true)
            expect(wrapper.vm.selectedPartition).toEqual(samplePartitions.unmounted)

            // Configure mount options
            wrapper.vm.mountPath = '/mnt/custom'
            wrapper.vm.enableAutoMountOnMount = true

            // Mount the partition
            await wrapper.vm.mountPartition()

            expect(mockDiskStore.mountDiskWithOptions).toHaveBeenCalled()
            expect(wrapper.vm.mountDialogOpen).toBe(false)
        })

        it('handles complete unmount workflow', async () => {
            const wrapper = createWrapper()

            // Open unmount confirmation
            wrapper.vm.confirmUnmount(samplePartitions.mounted)
            await nextTick()

            expect(wrapper.vm.unmountConfirmOpen).toBe(true)
            expect(wrapper.vm.partitionToUnmount).toEqual(samplePartitions.mounted)

            // Confirm unmount
            await wrapper.vm.unmountPartition(samplePartitions.mounted)

            expect(mockDiskStore.unmountDisk).toHaveBeenCalled()
            expect(wrapper.vm.unmountConfirmOpen).toBe(false)
        })

        it('handles complete label workflow', async () => {
            const wrapper = createWrapper()

            // Open label dialog
            wrapper.vm.showLabelDialog(samplePartitions.unmounted)
            await nextTick()

            expect(wrapper.vm.labelDialogOpen).toBe(true)
            expect(wrapper.vm.partitionToLabel).toEqual(samplePartitions.unmounted)

            // Set new label
            wrapper.vm.newLabel = 'New Test Label'

            // Save label
            await wrapper.vm.savePartitionLabel()

            expect(mockConfigStore.updateConfig).toHaveBeenCalled()
            expect(wrapper.vm.labelDialogOpen).toBe(false)
        })

        it('handles complete auto-mount workflow', async () => {
            const wrapper = createWrapper()
            const partition = { ...samplePartitions.unmounted, uuid: 'test-uuid' }

            // Initially disabled
            mockConfigStore.configs = []

            // Enable auto-mount
            await wrapper.vm.toggleAutoMount(partition)

            expect(mockConfigStore.createConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'auto-mount-test-uuid'
                })
            )

            // Mock that it's now enabled
            mockConfigStore.configs.push({
                key: 'auto-mount-test-uuid',
                value: '/mnt/test-uuid'
            })

            // Disable auto-mount
            await wrapper.vm.toggleAutoMount(partition)

            expect(mockConfigStore.deleteConfig).toHaveBeenCalledWith('auto-mount-test-uuid')
        })
    })

    describe('Template Structure Tests', () => {
        it('has required methods for template functionality', () => {
            const wrapper = createWrapper()

            // Mount/unmount functionality
            expect(wrapper.vm.openMountDialog).toBeDefined()
            expect(wrapper.vm.mountPartition).toBeDefined()
            expect(wrapper.vm.confirmUnmount).toBeDefined()
            expect(wrapper.vm.unmountPartition).toBeDefined()

            // Label functionality
            expect(wrapper.vm.showLabelDialog).toBeDefined()
            expect(wrapper.vm.savePartitionLabel).toBeDefined()

            // Info functionality
            expect(wrapper.vm.showPartitionInfo).toBeDefined()

            // Auto-mount functionality
            expect(wrapper.vm.toggleAutoMount).toBeDefined()
            expect(wrapper.vm.isAutoMountEnabled).toBeDefined()

            // Utility functions
            expect(wrapper.vm.getPartitionDisplayName).toBeDefined()
            expect(wrapper.vm.isOSDrive).toBeDefined()
            expect(wrapper.vm.isMountablePartition).toBeDefined()

            // Data refresh
            expect(wrapper.vm.fetchDisks).toBeDefined()
        })

        it('has required reactive data for template', () => {
            const wrapper = createWrapper()

            // Dialog states
            expect(wrapper.vm.mountDialogOpen).toBeDefined()
            expect(wrapper.vm.unmountConfirmOpen).toBeDefined()
            expect(wrapper.vm.infoDialogOpen).toBeDefined()
            expect(wrapper.vm.labelDialogOpen).toBeDefined()

            // Form data
            expect(wrapper.vm.mountPath).toBeDefined()
            expect(wrapper.vm.newLabel).toBeDefined()
            expect(wrapper.vm.mountOptions).toBeDefined()

            // Selected items
            expect(wrapper.vm.selectedPartition).toBeDefined()
            expect(wrapper.vm.partitionToUnmount).toBeDefined()
            expect(wrapper.vm.partitionInfo).toBeDefined()
            expect(wrapper.vm.partitionToLabel).toBeDefined()

            // Loading states
            expect(wrapper.vm.mountingInProgress).toBeDefined()
            expect(wrapper.vm.labelingInProgress).toBeDefined()
            expect(wrapper.vm.autoMountTogglingPartitions).toBeDefined()

            // Settings
            expect(wrapper.vm.showOSDrives).toBeDefined()
        })

        it('has required computed properties for template', () => {
            const wrapper = createWrapper()

            expect(wrapper.vm.filteredDisks).toBeDefined()
            expect(wrapper.vm.labeledDrivesMap).toBeDefined()
        })
    })

    describe('Edge Cases', () => {
        it('handles empty partition list', async () => {
            mockDiskStore.disks = [{
                device: '/dev/sda',
                model: 'Empty Drive',
                total: 1000000000,
                partitions: []
            }]
            const wrapper = createWrapper()
            await nextTick()

            expect(wrapper.vm.filteredDisks[0].partitions).toHaveLength(0)
        })

        it('handles partition without name property', () => {
            const wrapper = createWrapper()
            const partition = {
                device: '/dev/sdc1',
                uuid: 'test-uuid',
                file_system: 'ext4'
            }

            const displayName = wrapper.vm.getPartitionDisplayName(partition)
            expect(displayName).toBe('/dev/sdc1')
        })

        it('handles very long partition labels', () => {
            const wrapper = createWrapper()
            const longLabel = 'A'.repeat(100)
            const partition = {
                device: '/dev/sdc1',
                name: '/dev/sdc1',
                uuid: 'test-uuid',
                label: longLabel
            }

            mockConfigStore.getDriveLabel.mockReturnValue(null)
            const displayName = wrapper.vm.getPartitionDisplayName(partition)
            expect(displayName).toBe(longLabel)
        })

        it('handles special characters in mount paths', async () => {
            const wrapper = createWrapper()
            wrapper.vm.selectedPartition = samplePartitions.unmounted
            wrapper.vm.mountPath = '/mnt/special-chars_123'
            await nextTick()

            await wrapper.vm.mountPartition()

            expect(mockDiskStore.mountDiskWithOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    mount_path: '/mnt/special-chars_123'
                })
            )
        })
    })
})