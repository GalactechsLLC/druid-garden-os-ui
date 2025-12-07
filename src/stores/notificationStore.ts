import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { nanoid } from 'nanoid';
import { defaultIcons, defaultTimeouts } from "@/types/notification";
import type { Notification, NotificationType, NotificationOptions} from "@/types/notification";

/**
 * Notification system store managing active notifications and history
 */
export const useNotificationStore = defineStore('notification', () => {
    const notifications = ref<Notification[]>([]);
    const maxHistory = ref(50);
    const activeNotifications = ref<Notification[]>([]);

    /**
     * Create and display a notification with auto-dismiss and history tracking
     * @param type - Notification type for styling and default behavior
     * @param message - Main notification message
     * @param options - Additional configuration options
     * @returns Unique notification ID for programmatic dismissal
     */
    function notify(
        type: NotificationType,
        message: string,
        options: NotificationOptions = {}
    ): string {
        const id = nanoid();

        const notification: Notification = {
            id,
            type,
            message,
            icon: options.icon || defaultIcons[type],
            timeout: options.timeout !== undefined ? options.timeout : defaultTimeouts[type],
            closable: options.closable !== undefined ? options.closable : true,
            actions: options.actions || [],
            onDismiss: options.onDismiss || null,
            caption: options.caption,
            details: options.details,
            timestamp: Date.now(),
            visible: true
        };

        activeNotifications.value = [notification, ...activeNotifications.value];
        addToHistory(notification);

        // Auto-dismiss if timeout is set
        if (notification.timeout && notification.timeout > 0) {
            setTimeout(() => {
                dismiss(id);
            }, notification.timeout);
        }

        return id;
    }

    /**
     * Convenience method for success notifications
     */
    function success(message: string, options: NotificationOptions = {}): string {
        return notify('positive', message, options);
    }

    /**
     * Convenience method for error notifications
     */
    function error(message: string, options: NotificationOptions = {}): string {
        return notify('negative', message, options);
    }

    /**
     * Convenience method for warning notifications
     */
    function warning(message: string, options: NotificationOptions = {}): string {
        return notify('warning', message, options);
    }

    /**
     * Convenience method for info notifications
     */
    function info(message: string, options: NotificationOptions = {}): string {
        return notify('info', message, options);
    }

    /**
     * Display API error with enhanced formatting and endpoint details
     * Automatically extracts error information and provides persistent display
     */
    function apiError(error: any, fallbackMessage = 'An error occurred while communicating with the server'): string {
        const errorMessage = error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : fallbackMessage;

        let details = '';

        if (error instanceof Error && (error as any).endpoint) {
            details = `Endpoint: ${(error as any).endpoint}`;
        }

        return error(errorMessage, {
            details,
            timeout: 0, // Persistent until manually dismissed
            closable: true
        });
    }

    /**
     * Remove notification with fade-out animation
     * Calls onDismiss callback if provided
     */
    function dismiss(id: string): void {
        try {
            const activeIndex = activeNotifications.value.findIndex(n => n.id === id);
            if (activeIndex >= 0) {
                activeNotifications.value[activeIndex].visible = false;

                // Remove after animation completes
                setTimeout(() => {
                    activeNotifications.value = activeNotifications.value.filter(n => n.id !== id);
                }, 300);
            }

            const notification = notifications.value.find(n => n.id === id);
            if (notification?.onDismiss && typeof notification.onDismiss === 'function') {
                notification.onDismiss();
            }
        } catch (e) {
            // Silently handle dismissal errors
        }
    }

    /**
     * Clear all active notifications with staggered animation
     */
    function clearAll(): void {
        activeNotifications.value.forEach(notification => {
            notification.visible = false;
        });

        setTimeout(() => {
            activeNotifications.value = [];
        }, 300);
    }

    /**
     * Add notification to persistent history with size limit
     */
    function addToHistory(notification: Notification): void {
        notifications.value = [notification, ...notifications.value].slice(0, maxHistory.value);
    }

    /**
     * Get notifications sorted by timestamp (newest first)
     */
    const recentNotifications = computed(() => {
        return [...notifications.value].sort((a, b) => b.timestamp - a.timestamp);
    });

    /**
     * Count notifications by type for dashboard metrics
     */
    const notificationCounts = computed(() => {
        return {
            positive: notifications.value.filter(n => n.type === 'positive').length,
            negative: notifications.value.filter(n => n.type === 'negative').length,
            warning: notifications.value.filter(n => n.type === 'warning').length,
            info: notifications.value.filter(n => n.type === 'info').length,
            total: notifications.value.length
        };
    });

    return {
        notifications,
        activeNotifications,
        maxHistory,
        notify,
        success,
        error,
        warning,
        info,
        apiError,
        dismiss,
        clearAll,
        recentNotifications,
        notificationCounts
    };
});