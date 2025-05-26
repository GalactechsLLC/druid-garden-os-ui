/**
 * Formats a byte value into a human-readable string with appropriate units
 * @param bytes The number of bytes to format
 * @param decimals The number of decimal places to include (default: 2)
 * @returns Formatted string with appropriate unit (B, KiB, MiB, GiB, etc.)
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
 * Convert from one unit to another
 * @param value The value to convert
 * @param fromUnit The source unit
 * @param toUnit The target unit
 * @returns The converted value
 */
export function convertUnits(value: number, fromUnit: string, toUnit: string): number {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
    const fromIndex = units.indexOf(fromUnit)
    const toIndex = units.indexOf(toUnit)

    if (fromIndex === -1 || toIndex === -1) {
        throw new Error(`Invalid unit. Must be one of: ${units.join(', ')}`)
    }

    // Convert to bytes first, then to target unit
    const bytes = value * Math.pow(1024, fromIndex)
    return bytes / Math.pow(1024, toIndex)
}

/**
 * Formats a date string into a human-readable format
 * @param dateString ISO date string to format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
    if (!dateString) return 'N/A'

    try {
        const date = new Date(dateString)
        const now = new Date()

        const diffMs = now.getTime() - date.getTime()
        const diffSecs = Math.floor(diffMs / 1000)
        const diffMins = Math.floor(diffSecs / 60)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)
        const diffMonths = Math.floor(diffDays / 30)
        const diffYears = Math.floor(diffDays / 365)

        // Return relative time for recent dates
        if (diffSecs < 60) {
            return 'just now'
        } else if (diffMins < 60) {
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
        } else if (diffHours < 24) {
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
        } else if (diffDays < 30) {
            return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
        } else if (diffMonths < 12) {
            return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
        } else {
            return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
        }
    } catch (e) {
        // Fallback to basic formatting if date parsing fails
        return dateString
    }
}

/**
 * Formats file permissions string into a more readable form
 * @param permissions Unix-style permission string (e.g., 'drwxr-xr-x')
 * @returns Formatted permission information
 */
export function formatPermissions(permissions: string): string {
    if (!permissions || permissions.length !== 10) {
        return permissions || 'Unknown'
    }

    const type = permissions[0] === 'd' ? 'Directory' :
        permissions[0] === 'l' ? 'Link' :
            permissions[0] === 'b' ? 'Block Device' :
                permissions[0] === 'c' ? 'Character Device' :
                    permissions[0] === 'p' ? 'Pipe' :
                        permissions[0] === 's' ? 'Socket' : 'File'

    const owner = (permissions[1] === 'r' ? 'r' : '-') +
        (permissions[2] === 'w' ? 'w' : '-') +
        (permissions[3] === 'x' ? 'x' : '-')

    const group = (permissions[4] === 'r' ? 'r' : '-') +
        (permissions[5] === 'w' ? 'w' : '-') +
        (permissions[6] === 'x' ? 'x' : '-')

    const other = (permissions[7] === 'r' ? 'r' : '-') +
        (permissions[8] === 'w' ? 'w' : '-') +
        (permissions[9] === 'x' ? 'x' : '-')

    return `${type} [${owner} ${group} ${other}]`
}

/**
 * Determines the appropriate icon for a file based on its mimetype and extension
 * @param mimetype File mimetype
 * @param filename Filename with extension
 * @returns Material icon name
 */
export function getFileIcon(mimetype: string, filename: string): string {
    // Default icon
    let icon = 'insert_drive_file'

    // Check by mimetype
    if (mimetype) {
        if (mimetype.startsWith('image/')) icon = 'image'
        else if (mimetype.startsWith('video/')) icon = 'movie'
        else if (mimetype.startsWith('audio/')) icon = 'audiotrack'
        else if (mimetype === 'application/pdf') icon = 'picture_as_pdf'
        else if (mimetype.includes('spreadsheet')) icon = 'table_chart'
        else if (mimetype.includes('presentation')) icon = 'slideshow'
        else if (mimetype.includes('document')) icon = 'description'
        else if (mimetype.includes('zip') || mimetype.includes('compress')) icon = 'archive'
    }

    // Check by extension if icon is still default
    if (icon === 'insert_drive_file' && filename) {
        const ext = filename.split('.').pop()?.toLowerCase()

        if (ext) {
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) icon = 'image'
            else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) icon = 'movie'
            else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) icon = 'audiotrack'
            else if (ext === 'pdf') icon = 'picture_as_pdf'
            else if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) icon = 'table_chart'
            else if (['pptx', 'ppt', 'odp'].includes(ext)) icon = 'slideshow'
            else if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) icon = 'description'
            else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) icon = 'archive'
            else if (['html', 'htm'].includes(ext)) icon = 'html'
            else if (ext === 'css') icon = 'css'
            else if (['js', 'ts'].includes(ext)) icon = 'javascript'
            else if (ext === 'json') icon = 'data_object'
            else if (['md', 'markdown'].includes(ext)) icon = 'article'
            else if (['sh', 'bash'].includes(ext)) icon = 'terminal'
            else if (ext === 'py') icon = 'code'
            else if (['java', 'c', 'cpp', 'h', 'cs', 'php'].includes(ext)) icon = 'code'
        }
    }

    return icon
}

/**
 * Gets an appropriate color for file icon based on file type
 * @param mimetype File mimetype
 * @param filename Filename with extension
 * @returns Color name for icon
 */
export function getFileColor(mimetype: string, filename: string): string {
    // Default color
    let color = 'grey'

    // Check by mimetype
    if (mimetype) {
        if (mimetype.startsWith('image/')) color = 'green'
        else if (mimetype.startsWith('video/')) color = 'red'
        else if (mimetype.startsWith('audio/')) color = 'purple'
        else if (mimetype === 'application/pdf') color = 'red'
        else if (mimetype.includes('spreadsheet')) color = 'green'
        else if (mimetype.includes('presentation')) color = 'orange'
        else if (mimetype.includes('document')) color = 'blue'
        else if (mimetype.includes('zip') || mimetype.includes('compress')) color = 'brown'
    }

    // Check by extension if color is still default
    if (color === 'grey' && filename) {
        const ext = filename.split('.').pop()?.toLowerCase()

        if (ext) {
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) color = 'green'
            else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) color = 'red'
            else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) color = 'purple'
            else if (ext === 'pdf') color = 'red'
            else if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) color = 'green'
            else if (['pptx', 'ppt', 'odp'].includes(ext)) color = 'orange'
            else if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) color = 'blue'
            else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) color = 'brown'
            else if (['html', 'htm'].includes(ext)) color = 'orange'
            else if (ext === 'css') color = 'blue'
            else if (['js', 'ts'].includes(ext)) color = 'yellow-8'
            else if (ext === 'json') color = 'teal'
            else if (['md', 'markdown'].includes(ext)) color = 'blue-grey'
            else if (['sh', 'bash'].includes(ext)) color = 'grey-9'
            else if (ext === 'py') color = 'blue-9'
            else if (['java', 'c', 'cpp', 'h', 'cs', 'php'].includes(ext)) color = 'deep-purple'
        }
    }

    return color
}
/**
 * Helper function to format a percentage value
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
 * Helper function to calculate percentage
 */
export function calculatePercentage(numerator: any, denominator: any, defaultValue = 0): number {
    // Handle null, undefined, or non-numeric values
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
 * Helper function to get color based on usage value
 */
export function getUsageColor(value: any, criticalThreshold = 90, warningThreshold = 75): string {
    // Safe conversion to number
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

/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number, decimals = 0): string {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}