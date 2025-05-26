import { useNotificationStore } from '@/stores/notificationStore';
import { withApiLoading } from '@/utils/api';

/**
 * Format config key to display label
 */
export const formatConfigLabel = (key: string): string => {
    // Convert system.theme to Theme, etc.
    const parts = key.split('.');
    return parts[parts.length - 1]
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get icon name based on WiFi signal strength
 */
export const getWifiSignalIcon = (signal: number): string => {
    if (signal >= 80) return 'wifi';
    if (signal >= 60) return 'signal_wifi_4_bar';
    if (signal >= 40) return 'signal_wifi_3_bar';
    if (signal >= 20) return 'signal_wifi_2_bar';
    return 'signal_wifi_1_bar';
};

/**
 * Format bookmarks JSON with proper indentation
 */
export const formatBookmarksJSON = (bookmarksValue: string | number | null | undefined): string => {
    try {
        if (bookmarksValue !== null && bookmarksValue !== undefined) {
            // Parse and reformat with proper indentation
            const parsed = JSON.parse(String(bookmarksValue));
            return JSON.stringify(parsed, null, 2);
        }
        return '';
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Invalid JSON format');
    }
};

/**
 * Save bookmarks configuration
 */
export const saveBookmarks = async (
    key: string,
    value: any,
    last_value: string,
    updateConfigFn: (key: string, value: any, last_value: string) => Promise<void>
): Promise<void> => {
    const notificationStore = useNotificationStore();

    try {
        // Validate JSON format
        JSON.parse(value);

        // Save to config
        await updateConfigFn(key, value, last_value);

        // Show success notification
        notificationStore.success('Bookmarks saved successfully');
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Invalid JSON format');
    }
};

/**
 * Get suggested mount path based on partition properties
 */
export const getSuggestedMountPath = (partition: {
    path: string;
    fstype?: string;
    uuid?: string;
    label?: string;
}): string => {
    // Use UUID if available (preferable for persistent mounts)
    if (partition.uuid) {
        return `/mnt/by-uuid/${partition.uuid}`;
    }

    // Extract device name from path (e.g., "sda1" from "/dev/sda1")
    const deviceName = partition.path.split('/').pop() || 'unknown';

    // Check if this is a common filesystem type
    const isFat = partition.fstype?.toLowerCase().includes('fat') || false;
    const isNtfs = partition.fstype?.toLowerCase().includes('ntfs') || false;
    const isExt = partition.fstype?.toLowerCase().includes('ext') || false;
    const isSwap = partition.fstype?.toLowerCase().includes('swap') || false;

    // Don't suggest mount paths for swap partitions
    if (isSwap) {
        return '';
    }

    // Use filesystem-specific mount directories
    if (isFat) {
        return `/mnt/removable/${deviceName}`;
    } else if (isNtfs) {
        return `/mnt/windows/${deviceName}`;
    } else if (isExt) {
        return `/mnt/linux/${deviceName}`;
    }

    // Check if the partition has a label to use
    if (partition.label && partition.label.trim() !== '') {
        // Sanitize label to be a valid directory name
        const sanitizedLabel = partition.label
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');
        return `/mnt/media/${sanitizedLabel}`;
    }

    // Default to a generic mount point
    return `/mnt/${deviceName}`;
};

/**
 * Format file size with specific decimals
 */
export const formatFileSize = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Get descriptive type for disk based on path, model and size
 */
export const getDiskTypeDescription = (disk: { path: string; model?: string; size: number }): string => {
    const path = disk.path?.toLowerCase() || '';
    const model = disk.model?.toLowerCase() || '';
    const size = disk.size;

    // Check for NVMe drives
    if (path.includes('nvme') || model.includes('nvme')) {
        return 'NVMe SSD';
    }

    // Check for SSD indicators
    if (path.includes('ssd') || model.includes('ssd') ||
        model.includes('solid') || model.includes('flash')) {
        return 'SATA SSD';
    }

    // Check for common external media
    if (path.includes('sd') && size < 64 * 1024 * 1024 * 1024) {
        return 'SD Card';
    }

    if (path.includes('usb') || path.includes('removable')) {
        return 'USB Drive';
    }

    // Default to HDD for larger devices
    if (size > 100 * 1024 * 1024 * 1024) {
        return 'Hard Disk Drive';
    }

    return 'Storage Device';
};

/**
 * Get color based on disk usage percentage
 */
export const getDiskUsageColor = (usagePercentage: number): string => {
    if (usagePercentage >= 90) return 'negative';
    if (usagePercentage >= 75) return 'warning';
    return 'positive';
};

/**
 * Get human-readable description of filesystem type
 */
export const getFilesystemDescription = (fstype: string): string => {
    if (!fstype) return '';

    const fs = fstype.toLowerCase();

    if (fs.includes('fat')) return 'FAT';
    if (fs.includes('ntfs')) return 'NTFS';
    if (fs.includes('exfat')) return 'exFAT';
    if (fs.includes('ext4')) return 'ext4';
    if (fs.includes('ext3')) return 'ext3';
    if (fs.includes('ext2')) return 'ext2';
    if (fs.includes('xfs')) return 'XFS';
    if (fs.includes('btrfs')) return 'Btrfs';
    if (fs.includes('zfs')) return 'ZFS';
    if (fs.includes('apfs')) return 'APFS';
    if (fs.includes('hfs')) return 'HFS+';

    // Return original if no match found
    return fstype;
};

/**
 * Check if filesystem is a Linux native filesystem
 */
export const isLinuxNativeFs = (fstype: string): boolean => {
    const fs = fstype.toLowerCase();
    return fs.includes('ext') || fs.includes('xfs') || fs.includes('btrfs') || fs.includes('zfs');
};

/**
 * Check if filesystem is a Windows native filesystem
 */
export const isWindowsNativeFs = (fstype: string): boolean => {
    const fs = fstype.toLowerCase();
    return fs.includes('ntfs') || fs.includes('fat') || fs.includes('exfat');
};

/**
 * Check if a partition is mountable
 */
export const isMountablePartition = (partition: { fstype?: string }): boolean => {
    if (!partition.fstype) return false;

    const fs = partition.fstype.toLowerCase();

    // Skip swap partitions
    if (fs.includes('swap')) return false;

    // Skip raw LVM partitions
    if (fs.includes('lvm')) return false;

    // Skip LUKS partitions (encrypted)
    if (fs.includes('luks') || fs.includes('crypto')) return false;

    return true;
};

/**
 * Get default mount options for a filesystem
 */
export const getMountOptions = (partition: { fstype?: string }): string => {
    const fs = partition.fstype?.toLowerCase() || '';

    if (fs.includes('ntfs')) {
        return 'uid=1000,gid=1000,dmask=027,fmask=137';
    }

    if (fs.includes('fat')) {
        return 'uid=1000,gid=1000,utf8=1';
    }

    if (fs.includes('ext')) {
        return 'defaults';
    }

    return 'defaults';
};

/**
 * Refresh stores based on selected tab
 */
export const refreshAll = async (
    mainTab: string,
    configStoreFetch: () => Promise<any>,
    networkStoreFetch: () => Promise<any>,
    networkStoreScan: () => Promise<any>,
    wifiEnabled: boolean,
    diskStoreFetch: () => Promise<any>,
    isRefreshing: { value: boolean }
): Promise<void> => {
    await withApiLoading(
        isRefreshing,
        async () => {
            // Refresh all stores based on selected tab
            if (mainTab === 'system') {
                await configStoreFetch();
            } else if (mainTab === 'network') {
                await networkStoreFetch();
                if (wifiEnabled) {
                    await networkStoreScan();
                }
            } else if (mainTab === 'devices') {
                await diskStoreFetch();
            }
            return true;
        },
        {
            showSuccessNotification: true,
            successMessage: 'Settings refreshed',
            showErrorNotification: true,
            errorMessage: 'Failed to refresh settings'
        }
    );
};

/**
 * Update configuration value
 */
export const updateConfig = async (
    key: string,
    value: any,
    last_value: string,
    configStoreUpdate: (key: string, value: any, last_value: string) => Promise<any>,
    isRefreshing: { value: boolean }
): Promise<void> => {
    await withApiLoading(
        isRefreshing,
        async () => {
            await configStoreUpdate(key, value, last_value);
            return true;
        },
        {
            showSuccessNotification: true,
            successMessage: `Setting "${formatConfigLabel(key)}" updated successfully`,
            showErrorNotification: true,
            errorMessage: `Failed to update "${formatConfigLabel(key)}"`
        }
    );
};

/**
 * Refresh disks with loading indicator
 */
export const refreshDisks = async (
    diskStoreFetch: () => Promise<any>,
    isRefreshing: { value: boolean }
): Promise<void> => {
    await withApiLoading(
        isRefreshing,
        async () => {
            await diskStoreFetch();
            return true;
        },
        {
            showSuccessNotification: false,
            showErrorNotification: true,
            errorMessage: 'Failed to load storage devices'
        }
    );
};

/**
 * Format JSON editor content
 */
export const formatJSONEditor = (json: string): string => {
    // Parse and reformat with proper indentation
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
};

/**
 * Build complete mount options string
 */
export const buildMountOptionsString = (
    mountOptions: string,
    mountReadOnly: boolean,
    mountNoexec: boolean,
    mountSync: boolean,
    mountSetUid: boolean,
    mountUid: number,
    mountGid: number,
    selectedPartition: { fstype?: string } | null
): string => {
    let options = mountOptions;

    // Add standard options if selected
    const standardOptions: string[] = [];

    if (mountReadOnly) standardOptions.push('ro');
    if (mountNoexec) standardOptions.push('noexec');
    if (mountSync) standardOptions.push('sync');

    // If uid/gid is set for Windows filesystems
    if (mountSetUid && selectedPartition && isWindowsNativeFs(selectedPartition.fstype || "")) {
        standardOptions.push(`uid=${mountUid}`);
        standardOptions.push(`gid=${mountGid}`);
    }

    // Combine all options
    if (standardOptions.length > 0) {
        if (options && options !== 'defaults') {
            options += ',' + standardOptions.join(',');
        } else {
            options = standardOptions.join(',');
        }
    }

    // If no options were added, use defaults
    return options || 'defaults';
};

