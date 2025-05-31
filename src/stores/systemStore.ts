import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { get } from '@/utils/api';
import type { System, CombinedSystemInfo, CpuInfo, GpuInfo, MemoryInfo } from "@/types/system";
import type { DiskInfo, StorageDevice, StorageInfo } from "@/types/disk";

import { calculatePercentage, formatBytes, formatPercentage, getUsageColor } from "@/utils/format";
import {
    calculateDiskUsagePercentage, calculateMemoryPercentage, detectCpuModel,
    detectDiskType,
    detectProcessUser, formatMemorySegment, formatProcessRuntime, formatUptime,
    generateMockEvents, getMemorySegmentSize, safeNumber
} from "@/utils/system";
import * as DiskUtils from '@/utils/disk';
import { useNetworkStore } from '@/stores/networkStore';

export const useSystemInfoStore = defineStore('systemInfo', () => {
    const systemInfo = ref<CombinedSystemInfo | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const lastUpdated = ref<Date | null>(null);

    const networkStore = useNetworkStore();

    async function fetchSystemInfo() {
        try {
            loading.value = true;
            error.value = null;

            const endpoints = {
                systemInfo: 'api/system/info',
                cpuInfo: 'api/system/cpu',
                memoryInfo: 'api/system/memory',
                disksInfo: 'api/system/disks',
                gpusInfo: 'api/system/gpus'
            };

            const systemResults = await get<System>(endpoints.systemInfo, { silent: true });
            const cpuResults = await get<CpuInfo>(endpoints.cpuInfo, { silent: true });
            const memoryResults = await get<MemoryInfo>(endpoints.memoryInfo, { silent: true });
            const disksResults = await get<DiskInfo[]>(endpoints.disksInfo, { silent: true });
            const gpusResults = await get<GpuInfo[]>(endpoints.gpusInfo, { silent: true });

            await networkStore.fetchNetworkInfo();

            const enhancedProcesses = systemResults.running_processes.map(process => ({
                ...process,
                user: detectProcessUser(process),
                runtime: formatProcessRuntime(process.started)
            }));

            const storageDevices: StorageDevice[] = disksResults.map(disk => ({
                device: disk.name,
                mountPoint: disk.mount_path,
                fstype: disk.name.includes('sd') ? 'ext4' : 'xfs',
                total: disk.total,
                used: disk.used || 0,
                available: disk.total - (disk.used || 0),
                usage: calculateDiskUsagePercentage(disk.used || 0, disk.total),
                type: detectDiskType(disk)
            }));

            systemInfo.value = {
                system: {
                    ...systemResults,
                    load_average: cpuResults.load_averages || [0, 0, 0],
                    last_update: systemResults.last_update || new Date(Date.now() - 172800000).toISOString()
                },
                memory: {
                    ...memoryResults
                },
                disks: disksResults,
                networks: networkStore.networkInfoData,
                storage: storageDevices,
                cpu: {
                    usage: parseFloat(cpuResults.global_usage.toString()),
                    temperature: 45 + Math.random() * 15,
                    model: detectCpuModel(systemResults),
                    cores: cpuResults.physical_count,
                    threads: cpuResults.thread_count,
                    frequency: cpuResults.cpu_usage.reduce((sum, cpu) => sum + cpu.freq, 0) / cpuResults.cpu_usage.length
                },
                gpus: gpusResults.length > 0 ? gpusResults : [{
                    index: 0,
                    brand: 'GPU Information Not Available',
                    name: 'GPU Information Not Available',
                    fan_speeds: [],
                    gpu_usage: 0,
                    memory_usage: 0,
                    temperature: 0
                }],
                events: generateMockEvents(),
                processes: enhancedProcesses,
            };

            // Update completion status
            lastUpdated.value = new Date();
            loading.value = false;

            return systemInfo.value;
        } catch (err) {
            console.error('Failed to fetch system info:', err);
            error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            loading.value = false;
            throw err;
        }
    }


    const cpuUsage = computed(() => {
        return safeNumber(systemInfo.value?.cpu.usage, 0) / 100;
    });

    const memoryUsage = computed(() => {
        if (!systemInfo.value?.memory) return 0;
        return calculatePercentage(
            systemInfo.value.memory.used,
            systemInfo.value.memory.total
        );
    });

    const formattedDisks = computed(() => {
        if (!systemInfo.value?.disks) return [];

        return systemInfo.value.disks.map(disk => ({
            ...disk,
            type: detectDiskType(disk),
            usage_percentage: calculatePercentage(disk.used || 0, disk.total)
        }));
    });

    const systemOverview = computed(() => {
        if (!systemInfo.value) {
            return {
                hostname: 'Loading...',
                osInfo: 'Loading...',
                kernel: 'Loading...',
                uptime: 'Loading...',
                arch: 'Loading...'
            };
        }

        const { system } = systemInfo.value;

        return {
            hostname: system.hostname,
            osInfo: system.name + ' ' + system.os_version,
            kernel: system.kernel,
            uptime: formatUptime(system.uptime),
            arch: system.arch
        };
    });

    const storageInfo = computed((): StorageInfo => {
        if (!systemInfo.value?.disks) {
            return {
                totalSpace: 0,
                usedSpace: 0,
                freeSpace: 0,
                usagePercentage: 0,
                devices: []
            };
        }

        const disks = systemInfo.value.disks;
        const totalSpace = disks.reduce((acc, disk) => acc + disk.total, 0);
        const usedSpace = disks.reduce((acc, disk) => acc + (disk.used || 0), 0);
        const freeSpace = totalSpace - usedSpace;
        const usagePercentage = (usedSpace / totalSpace) * 100;

        return {
            totalSpace,
            usedSpace,
            freeSpace,
            usagePercentage,
            devices: systemInfo.value.storage
        };
    });

    return {
        systemInfo,
        loading,
        error,
        lastUpdated,
        cpuUsage,
        memoryUsage,
        formattedDisks,
        systemOverview,
        storageInfo,
        fetchSystemInfo,
        formatBytes,
        formatUptime,
        safeNumber,
        calculateMemoryPercentage,
        getMemorySegmentSize,
        formatMemorySegment,
        formatPercentage,
        calculatePercentage,
        getUsageColor,
        DiskUtils
    };
});