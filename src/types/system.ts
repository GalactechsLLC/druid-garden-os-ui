import type { DiskInfo, StorageDevice } from "@/types/disk";
import type { IpAddressData } from "@/types/network";

export interface MemoryInfo {
    total: number;
    used: number;
    free: number;
    available: number;
    swap_total?: number;
    swap_used?: number;
    swap_free?: number;

    total_swap?: number;
    used_swap?: number;
    free_swap?: number;
    cached?: number;
    buffers?: number;
}

export type MemorySegmentType = 'used' | 'available' | 'free';

export interface CpuCore {
    core: number;
    freq: number;
    usage: number;
}

export interface CpuInfo {
    global_usage: number;
    physical_count: number;
    thread_count: number;
    load_averages: number[];
    cpu_usage: CpuCore[];
}

export interface GpuInfo {
    index: number;
    brand: string;
    name: string;
    temperature: number;
    gpu_usage: number;
    memory_usage: number;
    fan_speeds: number[];
}

export interface NetworkInfo {
    name: string;
    ip_addresses: IpAddressData[];
    mac_address: string;
    data_uploaded: number;
    data_downloaded: number;
}

export interface SystemProcess {
    pid: number;
    name: string;
    cpu: number;
    memory: number;
    started: number;
    user?: string;
    runtime?: string;
}

export interface System {
    hostname: string;
    name: string;
    os_version: string;
    kernel: string;
    arch: string;
    uptime: number;
    last_update?: string;
    load_average?: number[];
    running_processes: SystemProcess[];
}

export interface CombinedSystemInfo {
    system: System;
    memory: MemoryInfo;
    disks: DiskInfo[];
    networks: NetworkInfo[];
    storage: StorageDevice[];
    cpu: {
        usage: number;
        temperature: number;
        model: string;
        cores: number;
        threads: number;
        frequency: number;
    };
    gpus: GpuInfo[];
    events: any[];
    processes: SystemProcess[];
}