import type {DiskInfo} from "@/types/disk.ts";
import type {MemoryInfo, MemorySegmentType, System} from "@/types/system.ts";
import {formatBytes} from "@/utils/format.ts";

/**
 * Detect CPU model based on system architecture
 * @param systemData - System information object containing architecture details
 * @returns Human-readable CPU model description
 */
export function detectCpuModel(systemData: System): string {
    if (systemData.arch.includes('arm')) {
        return 'ARM-based Processor';
    } else if (systemData.arch.includes('x86_64')) {
        return 'x86_64 Processor';
    } else {
        return `${systemData.arch} Processor`;
    }
}

/**
 * Detect the user that owns a process based on process characteristics
 * @param process - Process object with name and other properties
 * @returns Detected or assigned username for the process
 */
export function detectProcessUser(process: any): string {
    const commonUsers = ['root', 'user', 'www-data', 'nobody', 'system'];

    if (process.name.includes('systemd') || process.name.includes('kernel')) {
        return 'root';
    } else if (process.name.includes('nginx') || process.name.includes('apache')) {
        return 'www-data';
    } else if (process.name.includes('firefox') || process.name.includes('chrome')) {
        return 'user';
    }

    return commonUsers[Math.floor(Math.random() * commonUsers.length)];
}

/**
 * Format process runtime from start time to human-readable duration
 * @param startTime - Process start time in seconds since epoch
 * @returns Formatted runtime string in HH:MM:SS format
 */
export function formatProcessRuntime(startTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const uptime = now - startTime;

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Detect disk type based on device path and name patterns
 * @param disk - Disk information object
 * @returns Human-readable disk type description
 */
export function detectDiskType(disk: DiskInfo): string {
    const path = disk.device.toLowerCase();
    const name = disk.name?.toLowerCase() || "";

    if (path.includes('nvme') || name.includes('nvme')) return 'NVMe SSD';
    if (path.includes('ssd') || name.includes('ssd')) return 'SATA SSD';
    if (path.includes('sd') || name.includes('sd')) return 'SATA HDD';
    return 'Storage Device';
}

/**
 * Safely convert values to numbers with fallback default
 * @param value - Value to convert to number
 * @param defaultValue - Default value if conversion fails
 * @returns Converted number or default value
 */
export function safeNumber(value: any, defaultValue = 0): number {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value !== 'number') {
        const parsed = Number(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return isNaN(value) ? defaultValue : value;
}

/**
 * Format uptime in seconds to human-readable string
 * @param seconds - Uptime duration in seconds
 * @returns Formatted uptime string (e.g., "5d 12h 30m 45s")
 */
export function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * Calculate memory percentage for different memory segments
 * @param memoryInfo - Memory information object
 * @param type - Type of memory segment to calculate
 * @returns Percentage of total memory used by the specified segment
 */
export function calculateMemoryPercentage(memoryInfo: MemoryInfo | null, type: MemorySegmentType): number {
    if (!memoryInfo) return 0;

    const total = safeNumber(memoryInfo.total, 1);

    switch(type) {
        case 'used':
            return (safeNumber(memoryInfo.used, 0) / total) * 100;
        case 'available':
            const availableExcludingFree = Math.max(0, safeNumber(memoryInfo.available, 0) - safeNumber(memoryInfo.free, 0));
            return (availableExcludingFree / total) * 100;
        case 'free':
            return (safeNumber(memoryInfo.free, 0) / total) * 100;
        default:
            return 0;
    }
}

/**
 * Get the actual memory size for each segment
 * @param memoryInfo - Memory information object
 * @param type - Type of memory segment to get size for
 * @returns Memory size in bytes for the specified segment
 */
export function getMemorySegmentSize(memoryInfo: MemoryInfo | null, type: MemorySegmentType): number {
    if (!memoryInfo) return 0;

    switch(type) {
        case 'used':
            return safeNumber(memoryInfo.used, 0);
        case 'available':
            return Math.max(0, safeNumber(memoryInfo.available, 0) - safeNumber(memoryInfo.free, 0));
        case 'free':
            return safeNumber(memoryInfo.free, 0);
        default:
            return 0;
    }
}

/**
 * Format memory segment size to human-readable format
 * @param memoryInfo - Memory information object
 * @param type - Type of memory segment to format
 * @param decimals - Number of decimal places to display
 * @returns Formatted memory size string with appropriate units
 */
export function formatMemorySegment(memoryInfo: MemoryInfo | null, type: MemorySegmentType, decimals = 2): string {
    return formatBytes(getMemorySegmentSize(memoryInfo, type), decimals);
}

/**
 * Calculate the percentage of disk space used
 * @param used - Amount of disk space used in bytes
 * @param total - Total disk space in bytes
 * @returns Percentage of disk space used, rounded to nearest integer
 */
export function calculateDiskUsagePercentage(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
}