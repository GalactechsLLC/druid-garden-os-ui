/**
 * Space information for a disk or partition
 */
export interface SpaceInfo {
    total_space: number;
    used_space: number;
    free_space: number;
}

/**
 * Partition information for a disk device
 */
export interface Partition {
    /** Device path (e.g., /dev/sda1) */
    device: string;
    name?: string;
    number?: string;
    node?: string;
    /** Filesystem type (e.g., ext4, ntfs, fat32) */
    file_system?: string;
    uuid?: string;
    label?: string;
    /** Current mount point, null if not mounted */
    mount_path?: string | null;
    space_info: SpaceInfo;
    /** Loading state for UI operations */
    loading?: boolean;
}

/**
 * Disk device information and metadata
 */
export interface DiskInfo {
    /** Device path (e.g., /dev/sda) */
    device: string;
    name?: string;
    model?: string;
    vendor?: string | null;
    /** Total capacity in bytes */
    total: number;
    /** Used space in bytes */
    used?: number;
    path?: string;
    /** Disk type (e.g., SSD, HDD, NVMe) */
    disk_type?: string;
    /** I/O statistics in bytes */
    usage?: {
        recently_read: number;
        recently_writen: number;
        total_read: number;
        total_writen: number;
    };
    /** Mount point for entire disk, null if not mounted */
    mount_path?: string | null;
    file_system?: any;
    partitions?: Partition[];
}

/**
 * Request configuration for mounting a disk or partition
 */
export interface MountRequest {
    /** Device path to mount (e.g., /dev/sda1) */
    device_path: string;
    mount_path: string;
    /** Mount options (e.g., "ro,noexec") */
    options?: string;
    /** Mount by UUID instead of device path */
    by_uuid?: boolean;
    /** UUID to use when by_uuid is true */
    uuid?: string;
    /** Mount by filesystem label */
    by_label?: boolean;
    /** Label to use when by_label is true */
    label?: string;
    /** Add to fstab for automatic mounting */
    auto_mount?: boolean;
}