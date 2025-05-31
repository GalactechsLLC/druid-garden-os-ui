import { defineStore } from 'pinia';
import type { DiskInfo, MountRequest, Partition } from "@/types/disk";
import { get, post } from "@/utils/api";

export const useDiskStore = defineStore('disk', {
    state: () => ({
        loading: false,
        error: null as string | null,
        disks: [] as DiskInfo[]
    }),

    actions: {
        /**
         * Fetch all disks and their partitions
         */
        async fetchDisks() {
            this.loading = true;
            this.error = null;

            try {
                const disksData = await get<DiskInfo[]>('api/system/disks', {
                    errorMessage: 'Failed to fetch disks',
                    showErrorNotification: true
                });

                this.disks = Array.isArray(disksData) ? disksData.map((disk: DiskInfo) => {
                    const diskWithSize = {
                        ...disk,
                        size: disk.total,
                        used: disk.used,
                        path: disk.device
                    };

                    diskWithSize.partitions = disk.partitions?.map((partition: Partition) => ({
                        ...partition,
                        loading: false,
                        path: partition.device,
                        mountpoint: partition.mount_path,
                        fstype: partition.file_system,
                        size: partition.space_info?.total_space,
                    }));

                    return diskWithSize;
                }) : [];
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
                    p.mountpoint === mountPoint
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
        },

        /**
         * Check if a mount point exists
         */
        async checkMountPoint(mountPoint: string): Promise<boolean> {
            try {
                const response = await post('api/disks/check-mount', {
                    mount_path: mountPoint
                }, {
                    showErrorNotification: false,
                    silent: true
                });

                return response.exists || false;
            } catch (error) {
                console.error('Error checking mount point:', error);
                return false;
            }
        },

        /**
         * Create a mount point directory if it doesn't exist
         */
        async createMountPoint(mountPoint: string): Promise<boolean> {
            try {
                const response = await post('api/disks/create-mount-point', {
                    mount_path: mountPoint
                }, {
                    successMessage: `Mount point created at ${mountPoint}`,
                    errorMessage: 'Failed to create mount point',
                    showSuccessNotification: true,
                    showErrorNotification: true
                });

                return response.success || false;
            } catch (error) {
                console.error('Error creating mount point:', error);
                this.error = error instanceof Error ? error.message : 'Failed to create mount point';
                throw error;
            }
        }
    }
});