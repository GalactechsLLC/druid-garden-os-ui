export type NotificationType = 'positive' | 'negative' | 'warning' | 'info';

export interface NotificationAction {
    label: string;
    color?: string;
    handler: () => void;
}

export interface NotificationOptions {
    caption?: string;
    details?: string;
    icon?: string;
    timeout?: number;
    closable?: boolean;
    actions?: NotificationAction[];
    onDismiss?: (() => void) | null;
}

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    caption?: string;
    details?: string;
    icon?: string;
    timeout?: number;
    closable?: boolean;
    actions?: NotificationAction[];
    onDismiss?: (() => void) | null;
    timestamp: number;
    visible: boolean;
}

export const defaultIcons: Record<NotificationType, string> = {
    positive: 'check_circle',
    negative: 'error',
    warning: 'warning',
    info: 'info'
};

export const defaultTimeouts: Record<NotificationType, number> = {
    positive: 3000,
    negative: 5000,
    warning: 4000,
    info: 3000
};