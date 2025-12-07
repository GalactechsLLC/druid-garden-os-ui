import type { DiskInfo } from "@/types/disk";
import type { IpAddressData } from "@/types/network";

/**
 * Memory usage information in bytes
 */
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

/**
 * Types of memory segments for visualization
 */
export type MemorySegmentType = 'used' | 'available' | 'free';

/**
 * Individual CPU core information
 */
export interface CpuCore {
    core: number;
    /** Frequency in MHz */
    freq: number;
    /** Usage percentage (0-100) */
    usage: number;
}

/**
 * CPU information and statistics
 */
export interface CpuInfo {
    /** Overall CPU usage percentage (0-100) */
    global_usage: number;
    physical_count: number;
    thread_count: number;
    load_averages: number[];
    cpu_usage: CpuCore[];
}

/**
 * GPU device information and stats
 */
export interface GpuInfo {
    index: number;
    brand: string;
    name: string;
    /** Temperature in Celsius */
    temperature: number;
    /** Usage percentage (0-100) */
    gpu_usage: number;
    /** Memory usage percentage (0-100) */
    memory_usage: number;
    /** Fan speeds in RPM */
    fan_speeds: number[];
}

/**
 * Network interface information and statistics
 */
export interface NetworkInfo {
    /** Interface name (e.g., eth0, wlan0) */
    name: string;
    ip_addresses: IpAddressData[];
    mac_address: string;
    /** Total bytes uploaded */
    data_uploaded: number;
    /** Total bytes downloaded */
    data_downloaded: number;
}

/**
 * Running system process information
 */
export interface SystemProcess {
    pid: number;
    name: string;
    /** CPU usage percentage (0-100) */
    cpu: number;
    /** Memory usage in bytes */
    memory: number;
    /** Start time as Unix timestamp */
    started: number;
    user?: string;
    /** Formatted runtime string */
    runtime?: string;
}

/**
 * Basic system information
 */
export interface System {
    hostname: string;
    name: string;
    os_version: string;
    kernel: string;
    arch: string;
    /** Uptime in seconds */
    uptime: number;
    /** ISO date string of last update */
    last_update?: string;
    load_average?: number[];
    running_processes: SystemProcess[];
}

/**
 * Complete system information snapshot
 */
export interface CombinedSystemInfo {
    system: System;
    memory: MemoryInfo;
    disks: DiskInfo[];
    networks: NetworkInfo[];
    cpu: {
        /** Usage percentage (0-100) */
        usage: number;
        /** Temperature in Celsius */
        temperature: number;
        model: string;
        cores: number;
        threads: number;
        /** Base frequency in MHz */
        frequency: number;
    };
    gpus: GpuInfo[];
    events: any[];
    processes: SystemProcess[];
}