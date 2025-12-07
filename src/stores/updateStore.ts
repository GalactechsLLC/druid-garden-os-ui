import { defineStore } from 'pinia';
import { get, post } from "@/utils/api";
import type { UpdateInfo } from '@/types/update';

/**
 * System update management store
 */
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
         * Check server for available updates and update state accordingly
         * Prevents duplicate requests if already checking
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
                this.error = error instanceof Error ? error.message : 'Failed to check for updates';
            } finally {
                this.isCheckingForUpdates = false;
            }
        },

        /**
         * Initiate system update process
         * Automatically rechecks update status after completion
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

                // Server returns "true" string on successful update initiation
                if (response === "true") {
                    this.isUpdateAvailable = false;
                }
            } catch (error) {
                this.error = error instanceof Error ? error.message : 'Failed to start update';
            } finally {
                this.isUpdating = false;
                // Recheck status after update attempt
                setTimeout(() => this.checkForUpdates(), 5000);
            }
        },

        /**
         * Initialize store by checking for available updates
         */
        async initialize() {
            await this.checkForUpdates();
        }
    }
});