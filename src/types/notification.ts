/**
 * Available notification types
 */
export type NotificationType = 'positive' | 'negative' | 'warning' | 'info';

/**
 * Action button for notifications
 */
export interface NotificationAction {
    label: string;
    color?: string;
    handler: () => void;
}

/**
 * Configuration options for notifications
 */
export interface NotificationOptions {
    caption?: string;
    details?: string;
    /** Material icon name */
    icon?: string;
    /** Auto-dismiss timeout in milliseconds */
    timeout?: number;
    /** Whether user can manually close */
    closable?: boolean;
    actions?: NotificationAction[];
    onDismiss?: (() => void) | null;
}

/**
 * Complete notification object
 */
export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    caption?: string;
    details?: string;
    /** Material icon name */
    icon?: string;
    /** Auto-dismiss timeout in milliseconds */
    timeout?: number;
    /** Whether user can manually close */
    closable?: boolean;
    actions?: NotificationAction[];
    onDismiss?: (() => void) | null;
    /** Unix timestamp */
    timestamp: number;
    visible: boolean;
}

/**
 * Default icons for each notification type
 */
export const defaultIcons: Record<NotificationType, string> = {
    positive: 'check_circle',
    negative: 'error',
    warning: 'warning',
    info: 'info'
};

/**
 * Default timeouts for each notification type (in milliseconds)
 */
export const defaultTimeouts: Record<NotificationType, number> = {
    positive: 3000,
    negative: 5000,
    warning: 4000,
    info: 3000
};