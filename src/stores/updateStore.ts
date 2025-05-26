// src/stores/updateStore.ts
import { defineStore } from 'pinia';
import { get, post } from "@/utils/api";

interface UpdateInfo {
    local_version: string;
    remote_version: string;
    has_update: boolean;
}

export const useUpdateStore = defineStore('update', {
    state: () => ({
        currentVersion: '',
        remoteVersion: '',
        isUpdateAvailable: false,
        isCheckingForUpdates: false,
        isUpdating: false,
        lastChecked: null as Date | null,
        error: null as string | null
    }),

    getters: {
        updateStatus: (state) => {
            if (state.isUpdating) return 'updating';
            if (state.isUpdateAvailable) return 'available';
            if (state.currentVersion) return 'upToDate';
            return 'unknown';
        },
        formattedVersion: (state) => {
            return state.currentVersion ? `v${state.currentVersion}` : '';
        },
        formattedRemoteVersion: (state) => {
            return state.remoteVersion ? `v${state.remoteVersion}` : '';
        }
    },

    actions: {
        /**
         * Check if updates are available
         */
        async checkForUpdates() {
            if (this.isCheckingForUpdates) return;

            this.isCheckingForUpdates = true;
            this.error = null;

            try {
                const response = await get<UpdateInfo>('system/updates', {
                    errorMessage: 'Failed to check for updates',
                    showErrorNotification: false,
                    silent: true
                });

                if (response) {
                    this.currentVersion = response.local_version;
                    this.remoteVersion = response.remote_version;
                    this.isUpdateAvailable = response.has_update;

                    this.lastChecked = new Date();
                }
            } catch (error) {
                console.error('Error checking for updates:', error);
                this.error = error instanceof Error ? error.message : 'Failed to check for updates';
            } finally {
                this.isCheckingForUpdates = false;
            }
        },

        /**
         * Start the system update process
         */
        async startUpdate() {
            if (this.isUpdating || !this.isUpdateAvailable) return;

            this.isUpdating = true;
            this.error = null;

            try {
                const response = await post('system/updates', {}, {
                    successMessage: `Update to ${this.formattedRemoteVersion} started successfully`,
                    errorMessage: 'Failed to start update',
                    showSuccessNotification: true,
                    showErrorNotification: true
                });

                if (response === "true") {
                    this.isUpdateAvailable = false;
                }
            } catch (error) {
                console.error('Error starting update:', error);
                this.error = error instanceof Error ? error.message : 'Failed to start update';
            } finally {
                this.isUpdating = false;

                setTimeout(() => this.checkForUpdates(), 5000);
            }
        },

        /**
         * Initialize the update store
         */
        async initialize() {
            await this.checkForUpdates();
        }
    }
});