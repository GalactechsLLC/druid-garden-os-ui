
export interface SpaceInfo {
    total_space: number;
    used_space: number;
    free_space: number;
}

// For /api/system/disks endpoint responses
export interface Partition {
    name: string;
    node: string;
    number?: string;
    device: string;
    file_system: string | null;
    space_info: SpaceInfo;
    mount_path: string | null;
    loading?: boolean;
    label?: string;
    uuid?: string;
    mountpoint?: string | null; // Used in unmountDisk function
    fstype?: string | null; // Used for filesystem detection
    size?: number; // Convenience property for size information
}

export interface DiskInfo {
    dev_path: string;
    mount_path: string;
    name: string;
    vendor?: string;
    model?: string;
    disk_type?: string;
    total: number;
    used: number;
    usage: {
        recently_read: number;
        recently_writen: number;
        total_read: number;
        total_writen: number;
    };
    device?: string;
    partitions?: Partition[];
}

export interface MountRequest {
    device_path: string;
    mount_path: string;
    options?: string;
    by_uuid?: boolean;
    by_label?: boolean;
    uuid?: string;
    label?: string;
    read_only?: boolean;
}

export interface StorageDevice {
    device: string;
    mountPoint: string;
    fstype: string;
    total: number;
    used: number;
    available: number;
    usage: number;
    type: string;
}

export interface StorageInfo {
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    usagePercentage: number;
    devices: StorageDevice[];
}
