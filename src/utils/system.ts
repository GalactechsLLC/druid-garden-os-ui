
import type {DiskInfo} from "@/types/disk.ts";
import type {MemoryInfo, MemorySegmentType, System} from "@/types/system.ts";
import {formatBytes} from "@/utils/format.ts";

export function detectCpuModel(systemData: System): string {
    if (systemData.arch.includes('arm')) {
        return 'ARM-based Processor';
    } else if (systemData.arch.includes('x86_64')) {
        return 'x86_64 Processor';
    } else {
        return `${systemData.arch} Processor`;
    }
}

// Try to detect the user that owns a process
export function detectProcessUser(process: any): string {
    const commonUsers = ['root', 'user', 'www-data', 'nobody', 'system'];

    // Determine user based on process name patterns
    if (process.name.includes('systemd') || process.name.includes('kernel')) {
        return 'root';
    } else if (process.name.includes('nginx') || process.name.includes('apache')) {
        return 'www-data';
    } else if (process.name.includes('firefox') || process.name.includes('chrome')) {
        return 'user';
    }

    // Return a random common user for variety
    return commonUsers[Math.floor(Math.random() * commonUsers.length)];
}

// Format process runtime
export function formatProcessRuntime(startTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const uptime = now - startTime;

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Generate mock events for UI compatibility
export function generateMockEvents(): any[] {
    return [
        {
            id: '1',
            type: 'info',
            timestamp: new Date().toISOString(),
            message: 'System information loaded successfully',
            component: 'System'
        },
        {
            id: '2',
            type: 'warning',
            timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
            message: 'High CPU usage detected',
            component: 'CPU'
        },
        {
            id: '3',
            type: 'error',
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            message: 'Failed to mount external storage device',
            component: 'Storage'
        }
    ];
}

// Try to detect disk type based on path
export function detectDiskType(disk: DiskInfo): string {
    const path = disk.device.toLowerCase();
    const name = disk.name?.toLowerCase() || "";

    if (path.includes('nvme') || name.includes('nvme')) return 'NVMe SSD';
    if (path.includes('ssd') || name.includes('ssd')) return 'SATA SSD';
    if (path.includes('sd') || name.includes('sd')) return 'SATA HDD';
    return 'Storage Device';
}

// ---------- UTILITY FUNCTIONS ----------

/**
 * Helper function to safely convert values to numbers
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
 */
export function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * Calculate memory percentages for different memory segments
 */
export function calculateMemoryPercentage(memoryInfo: MemoryInfo | null, type: MemorySegmentType): number {
    if (!memoryInfo) return 0;

    const total = safeNumber(memoryInfo.total, 1);

    switch(type) {
        case 'used':
            return (safeNumber(memoryInfo.used, 0) / total) * 100;
        case 'available':
            // Available is what's available beyond free
            const availableExcludingFree = Math.max(0, safeNumber(memoryInfo.available, 0) - safeNumber(memoryInfo.free, 0));
            return (availableExcludingFree / total) * 100;
        case 'free':
            return (safeNumber(memoryInfo.free, 0) / total) * 100;
        default:
            return 0;
    }
}

/**
 * Get the actual memory size for each segment (used, available-only, free)
 */
export function getMemorySegmentSize(memoryInfo: MemoryInfo | null, type: MemorySegmentType): number {
    if (!memoryInfo) return 0;

    switch(type) {
        case 'used':
            return safeNumber(memoryInfo.used, 0);
        case 'available':
            // Available-only is available minus free
            return Math.max(0, safeNumber(memoryInfo.available, 0) - safeNumber(memoryInfo.free, 0));
        case 'free':
            return safeNumber(memoryInfo.free, 0);
        default:
            return 0;
    }
}

/**
 * Format memory segment size to human-readable format
 */
export function formatMemorySegment(memoryInfo: MemoryInfo | null, type: MemorySegmentType, decimals = 2): string {
    return formatBytes(getMemorySegmentSize(memoryInfo, type), decimals);
}

/**
 * Calculate the percentage of disk space used
 */
export function calculateDiskUsagePercentage(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
}
