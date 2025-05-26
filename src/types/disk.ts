
export interface SpaceInfo {
    total_space: number;
    used_space: number;
    free_space: number;
}

// For /api/disks/list endpoint responses
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
    path?: string; // For reference to device path
    size?: number; // Convenience property for size information
}

export interface Disk {
    name: string;
    node: string;
    disk_type: string;
    device: string;
    file_system: string | null;
    space_info: SpaceInfo;
    mount_path: string | null;
    model: string;
    vendor: string | null;
    partitions: Partition[];
    path?: string;
    type?: string;
    size?: number;
    used?: number;
}

// For /api/system/disks endpoint responses
export interface DiskInfo {
    path: string;
    name: string;
    total: number;
    used: number;
    usage: {
        recently_read: number;
        recently_writen: number;
        total_read: number;
        total_writen: number;
    };
    device?: string;
    size?: number;
    partitions?: {
        device: string;
        size: number;
        filesystem: string;
        mountpoint?: string;
        label?: string;
        uuid?: string;
    }[];
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
