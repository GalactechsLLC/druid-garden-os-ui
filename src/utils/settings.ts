
/**
 * Format config key to display label by converting dot notation to readable text
 * @param key - The configuration key (e.g., "system.theme")
 * @returns Formatted display label (e.g., "Theme")
 */
export const formatConfigLabel = (key: string): string => {
    const parts = key.split('.');
    return parts[parts.length - 1]
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Format JSON string with proper indentation for editor display
 * @param json - Raw JSON string to format
 * @returns Formatted JSON string with 2-space indentation
 */
export const formatJSONEditor = (json: string): string => {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
};