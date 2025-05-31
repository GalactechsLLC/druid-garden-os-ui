// Updated disk utility functions
import type { DiskInfo, Partition } from "@/types/disk";

// Format config label for display
export function formatConfigLabel(key: string): string {
    // Convert snake_case or camelCase to Title Case with spaces
    return key
        .replace(/([A-Z])/g, ' $1') // camelCase to space-separated
        .replace(/_/g, ' ') // snake_case to space-separated
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();
}

// Format JSON for editor
export function formatJSONEditor(jsonString: string): string {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
}

// Format file size in human-readable format
export function formatSize(size?: number): string {
    if (size === undefined || size === null || isNaN(size)) {
        return "Unknown";
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let index = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && index < units.length - 1) {
        formattedSize /= 1024;
        index++;
    }

    return `${formattedSize.toFixed(2)} ${units[index]}`;
}

// For backward compatibility
export function formatFileSize(size?: number): string {
    return formatSize(size);
}

// Get disk type description
export function getDiskTypeDescription(disk: DiskInfo): string {
    // Handle both Disk and DiskInfo types
    if ('model' in disk) {
        // It's a Disk object
        const model = disk.model || 'Unknown Device';
        const vendor = disk.vendor ? `${disk.vendor} ` : '';
        const type = disk.disk_type || 'Storage Device';
        return `${vendor}${model} (${type})`;
    } else {
        // It's a DiskInfo object
        const name = disk.name || 'Unknown Device';
        return `${name} (Storage Device)`;
    }
}

// Get filesystem description
export function getFilesystemDescription(fstype: string | null | undefined): string {
    if (!fstype) return "Unknown";

    const fs = fstype.toLowerCase();
    if (fs.includes('ntfs')) return "NTFS";
    if (fs.includes('fat32')) return "FAT32";
    if (fs.includes('fat16')) return "FAT16";
    if (fs.includes('fat')) return "FAT";
    if (fs.includes('exfat')) return "exFAT";
    if (fs.includes('ext4')) return "ext4";
    if (fs.includes('ext3')) return "ext3";
    if (fs.includes('ext2')) return "ext2";
    if (fs.includes('ext')) return "ext";
    if (fs.includes('btrfs')) return "Btrfs";
    if (fs.includes('f2fs')) return "F2FS";
    if (fs.includes('xfs')) return "XFS";
    if (fs.includes('zfs')) return "ZFS";
    if (fs.includes('apfs')) return "APFS";
    if (fs.includes('hfs')) return "HFS+";

    return fstype.toUpperCase();
}

// Check if partition is mountable
export function isMountablePartition(partition: Partial<Partition>): boolean {
    // A partition is mountable if it has a file system and is not already mounted
    return !!(
        (partition.file_system || partition.fstype) &&
        !(partition.mount_path || partition.mountpoint)
    );
}

// Build mount options string
export function buildMountOptionsString(
    options: string,
    readOnly: boolean,
    noexec: boolean,
    sync: boolean,
    setUid: boolean,
    uid: number,
    gid: number,
    partition: { file_system?: string | null; fstype?: string | null } | null
): string {
    // Start with the provided options or defaults
    let result = options || 'defaults';

    // Add standard flags
    if (readOnly) {
        result = addMountOption(result, 'ro');
    }
    if (noexec) {
        result = addMountOption(result, 'noexec');
    }
    if (sync) {
        result = addMountOption(result, 'sync');
    }

    // Add uid/gid options for appropriate filesystems
    if (setUid && partition) {
        const fs = (partition.file_system || partition.fstype || '').toLowerCase();
        if (fs.includes('fat') || fs.includes('ntfs') || fs.includes('exfat')) {
            result = addMountOption(result, `uid=${uid}`);
            result = addMountOption(result, `gid=${gid}`);
        }
    }

    return result;
}

// Helper for adding mount options
function addMountOption(options: string, newOption: string): string {
    if (options === 'defaults') {
        return newOption;
    }
    return `${options},${newOption}`;
}

// Check if filesystem is Windows-native
export function isWindowsNativeFs(fstype: string | null | undefined): boolean {
    if (!fstype) return false;
    const fs = fstype.toLowerCase();
    return fs.includes('ntfs') || fs.includes('fat') || fs.includes('exfat');
}

// Get suggested mount path
export function getSuggestedMountPath(partition: Partition): string {
    if (partition.uuid) {
        return `/mnt/${partition.uuid}`;
    } else {
        const deviceName = partition.device.replace('/dev/', '');
        return `/mnt/${deviceName}`;
    }
}

// Get WiFi signal icon based on signal strength
export function getWifiSignalIcon(signal: number): string {
    if (signal >= 80) return 'wifi';
    if (signal >= 60) return 'network_wifi_3_bar';
    if (signal >= 40) return 'network_wifi_2_bar';
    if (signal >= 20) return 'network_wifi_1_bar';
    return 'signal_wifi_0_bar';
}