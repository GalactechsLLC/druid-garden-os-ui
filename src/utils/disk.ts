import type { DiskInfo } from "@/types/disk";

/**
 * Format a byte size into a human-readable string with appropriate units
 * @param size - Size in bytes
 * @returns Formatted size string (e.g., "1.50 GB") or "Unknown" if size is invalid
 */
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

/**
 * Get a human-readable description for a disk device
 * @param disk - Disk information object
 * @returns Formatted disk description including vendor, model, and type
 */
export function getDiskTypeDescription(disk: DiskInfo): string {
    if ('model' in disk) {
        const model = disk.model || 'Unknown Device';
        const vendor = disk.vendor ? `${disk.vendor} ` : '';
        const type = disk.disk_type || 'Storage Device';
        return `${vendor}${model} (${type})`;
    } else {
        const name = disk.name || 'Unknown Device';
        return `${name} (Storage Device)`;
    }
}

/**
 * Get a standardized filesystem type description
 * @param fstype - Raw filesystem type string
 * @returns Standardized filesystem name (e.g., "NTFS", "ext4") or "Unknown"
 */
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

/**
 * Build a mount options string based on various mount parameters
 * @param options - Base mount options string
 * @param readOnly - Whether to mount as read-only
 * @param noexec - Whether to disable execution of binaries
 * @param sync - Whether to use synchronous I/O
 * @param setUid - Whether to set UID/GID options
 * @param uid - User ID for ownership
 * @param gid - Group ID for ownership
 * @param partition - Partition information object with optional filesystem fields
 * @returns Complete mount options string
 */
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
    let result = options || 'defaults';

    if (readOnly) {
        result = addMountOption(result, 'ro');
    }
    if (noexec) {
        result = addMountOption(result, 'noexec');
    }
    if (sync) {
        result = addMountOption(result, 'sync');
    }

    if (setUid && partition) {
        const fs = (partition.file_system || partition.fstype || '').toLowerCase();
        if (fs.includes('fat') || fs.includes('ntfs') || fs.includes('exfat')) {
            result = addMountOption(result, `uid=${uid}`);
            result = addMountOption(result, `gid=${gid}`);
        }
    }

    return result;
}

/**
 * Add a new option to an existing mount options string
 * @param options - Existing mount options string
 * @param newOption - New option to add
 * @returns Updated mount options string
 */
function addMountOption(options: string, newOption: string): string {
    if (options === 'defaults') {
        return newOption;
    }
    return `${options},${newOption}`;
}

/**
 * Check if a filesystem type is native to Windows
 * @param fstype - Filesystem type string
 * @returns True if the filesystem is Windows-native (NTFS, FAT variants, exFAT)
 */
export function isWindowsNativeFs(fstype: string | null | undefined): boolean {
    if (!fstype) return false;
    const fs = fstype.toLowerCase();
    return fs.includes('ntfs') || fs.includes('fat') || fs.includes('exfat');
}