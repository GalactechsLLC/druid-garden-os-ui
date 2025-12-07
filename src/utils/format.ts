/**
 * Formats a byte value into a human-readable string with appropriate units
 * @param bytes - The number of bytes to format
 * @param decimals - The number of decimal places to include
 * @returns Formatted string with appropriate unit (B, KB, MB, GB, etc.)
 */
export function formatBytes(bytes: number | undefined, decimals = 2): string {
    if (bytes === undefined || bytes === null) {
        return '0 B';
    }

    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a numeric value as a percentage string with proper handling of edge cases
 * @param value - The value to format as a percentage
 * @param decimals - Number of decimal places to display
 * @param defaultValue - Default value to use if input is invalid
 * @returns Formatted percentage string (e.g., "75.5%")
 */
export function formatPercentage(value: any, decimals = 1, defaultValue = 0): string {
    if (value === null || value === undefined) return `${defaultValue.toFixed(decimals)}%`;

    if (typeof value !== 'number') {
        const parsed = Number(value);
        if (isNaN(parsed)) return `${defaultValue.toFixed(decimals)}%`;
        return `${parsed.toFixed(decimals)}%`;
    }

    return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate percentage from numerator and denominator with safe type conversion
 * @param numerator - The numerator value
 * @param denominator - The denominator value
 * @param defaultValue - Default value to return if calculation fails
 * @returns Calculated percentage value (0-100)
 */
export function calculatePercentage(numerator: any, denominator: any, defaultValue = 0): number {
    const safeNum = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val !== 'number') {
            const parsed = Number(val);
            return isNaN(parsed) ? 0 : parsed;
        }
        return isNaN(val) ? 0 : val;
    };

    const num = safeNum(numerator);
    const denom = safeNum(denominator);

    if (denom === 0) return defaultValue;
    return (num / denom) * 100;
}

/**
 * Get a color classification based on usage percentage thresholds
 * @param value - Usage value to classify
 * @param criticalThreshold - Threshold for critical usage (returns 'negative')
 * @param warningThreshold - Threshold for warning usage (returns 'warning')
 * @returns Color classification: 'negative', 'warning', or 'positive'
 */
export function getUsageColor(value: any, criticalThreshold = 90, warningThreshold = 75): string {
    const safeValue = (() => {
        if (value === null || value === undefined) return 0;
        if (typeof value !== 'number') {
            const parsed = Number(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return isNaN(value) ? 0 : value;
    })();

    if (safeValue > criticalThreshold) return 'negative';
    if (safeValue > warningThreshold) return 'warning';
    return 'positive';
}