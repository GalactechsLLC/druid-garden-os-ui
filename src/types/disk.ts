export interface SpaceInfo {
    total_space: number;
    used_space: number;
    free_space: number;
}

export interface Partition {
    device: string;
    name?: string;
    number?: string;
    node?: string;
    file_system?: string;
    uuid?: string;
    label?: string;
    mount_path?: string | null;
    space_info: SpaceInfo; // Made required, always provide default values
    loading?: boolean;

    // Legacy compatibility fields
    path?: string;
    mountpoint?: string | null;
    fstype?: string | null;
    size?: number;
}

export interface DiskInfo {
    device: string;
    name?: string;
    model?: string;
    vendor?: string | null;
    total: number;
    used?: number;
    path?: string;
    disk_type?: string;
    usage?: {
        recently_read: number;
        recently_writen: number;
        total_read: number;
        total_writen: number;
    };
    mount_path?: string | null;
    file_system?: any;
    partitions?: Partition[];
}

export interface MountRequest {
    device_path: string;
    mount_path: string;
    options?: string;
    by_uuid?: boolean;
    uuid?: string;
    by_label?: boolean;
    label?: string;
    auto_mount?: boolean;
}
