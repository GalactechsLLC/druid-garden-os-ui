import { defineStore } from 'pinia';
import type { DiskInfo, MountRequest, Partition } from "@/types/disk";
import { get, post, del } from "@/utils/api";

export const useDiskStore = defineStore('disk', {
    state: () => ({
        loading: false,
        error: null as string | null,
        disks: [] as DiskInfo[]
    }),

    actions: {
        /**
         * Extract filesystem type and UUID from the new format
         */
        parseFileSystem(fileSystemObj: any): { type: string | null, uuid: string | null } {
            if (!fileSystemObj || typeof fileSystemObj !== 'object') {
                return { type: null, uuid: null };
            }
            const entries = Object.entries(fileSystemObj);
            if (entries.length > 0) {
                const [fsType, uuid] = entries[0];
                return {
                    type: fsType,
                    uuid: uuid === "00000000-0000-0000-0000-000000000000" ? null : uuid as string
                };
            }

            return { type: null, uuid: null };
        },

        /**
         * Fetch all disks and their partitions
         */
        async fetchDisks() {
            this.loading = true;
            this.error = null;

            try {
                const disksData = await get<any[]>('api/system/disks', {
                    errorMessage: 'Failed to fetch disks',
                    showErrorNotification: true
                });

                this.disks = Array.isArray(disksData) ? disksData.map((disk: any) => {
                    const diskWithSize: DiskInfo = {
                        device: disk.dev_path || disk.name,
                        name: disk.name,
                        model: disk.model || 'Unknown Device',
                        vendor: disk.vendor,
                        total: disk.total || 0,
                        used: disk.used || 0,
                        path: disk.dev_path || disk.name,
                        disk_type: disk.disk_type,
                        usage: disk.usage,
                        mount_path: disk.mount_path,
                        file_system: disk.file_system,
                        partitions: []
                    };

                    // Process partitions with new format
                    diskWithSize.partitions = disk.partitions?.map((partition: any) => {
                        const fsInfo = this.parseFileSystem(partition.file_system);

                        const processedPartition: Partition = {
                            device: partition.device,
                            name: partition.name,
                            number: partition.number,
                            node: partition.node,
                            file_system: fsInfo.type || undefined,
                            uuid: fsInfo.uuid || undefined,
                            label: partition.label || undefined,
                            mount_path: partition.mount_path,
                            space_info: partition.space_info ? {
                                total_space: partition.space_info.total_space || 0,
                                used_space: partition.space_info.used_space || 0,
                                free_space: partition.space_info.free_space || 0
                            } : {
                                total_space: 0,
                                used_space: 0,
                                free_space: 0
                            },
                            loading: false,
                        };

                        return processedPartition;
                    }) || [];

                    return diskWithSize;
                }) : [];

                console.log('📀 Processed disks:', this.disks);
            } catch (error) {
                console.error('Error fetching disks:', error);
                this.error = error instanceof Error ? error.message : 'Failed to fetch disks';
                this.disks = [];
            } finally {
                this.loading = false;
            }
        },

        /**
         * Mount a disk partition (simple version)
         */
        async mountDisk(devicePath: string, mountPath: string) {
            return this.mountDiskWithOptions({
                device_path: devicePath,
                mount_path: mountPath
            });
        },

        /**
         * Mount a disk partition with advanced options
         */
        async mountDiskWithOptions(request: MountRequest) {
            this.error = null;

            const disk = this.disks.find(d =>
                d.partitions?.some(p => p.device === request.device_path)
            );

            if (!disk) {
                this.error = `Device ${request.device_path} not found`;
                throw new Error(this.error);
            }

            const partition = disk.partitions?.find(p =>
                p.device === request.device_path
            );

            if (!partition) {
                this.error = `Partition ${request.device_path} not found`;
                throw new Error(this.error);
            }

            partition.loading = true;

            try {
                if (request.by_uuid && !request.uuid && partition.uuid) {
                    request.uuid = partition.uuid;
                }

                if (request.by_label && !request.label && partition.label) {
                    request.label = partition.label;
                }

                console.log('🔧 Mounting with request:', request);

                await post('api/disks/mount', request, {
                    successMessage: `Disk mounted at ${request.mount_path}`,
                    errorMessage: 'Failed to mount disk',
                    showSuccessNotification: true,
                    showErrorNotification: true
                });
            } catch (error) {
                console.error('Error mounting disk:', error);
                this.error = error instanceof Error ? error.message : 'Failed to mount disk';
                throw error;
            } finally {
                if (partition) {
                    partition.loading = false;
                }
            }
        },

        /**
         * Unmount a disk partition
         */
        async unmountDisk(mountPoint: string) {
            this.error = null;

            let foundPartition: Partition | null = null;

            for (const disk of this.disks) {
                const partition = disk.partitions?.find(p =>
                    p.mount_path === mountPoint
                );

                if (partition) {
                    foundPartition = partition;
                    break;
                }
            }

            if (!foundPartition) {
                this.error = `Mount point ${mountPoint} not found`;
                throw new Error(this.error);
            }

            foundPartition.loading = true;

            try {
                await post('api/disks/unmount', {
                    mount_path: mountPoint
                }, {
                    successMessage: `Disk unmounted from ${mountPoint}`,
                    errorMessage: 'Failed to unmount disk',
                    showSuccessNotification: true,
                    showErrorNotification: true
                });
            } catch (error) {
                console.error('Error unmounting disk:', error);
                this.error = error instanceof Error ? error.message : 'Failed to unmount disk';
                throw error;
            } finally {
                if (foundPartition) {
                    foundPartition.loading = false;
                }
            }
        }

    }
});