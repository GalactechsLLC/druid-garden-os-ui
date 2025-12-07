import type {FileEntry, FileOperation, FileSystemStats} from '@/types/files'
import type {NotificationType} from "@/types/notification.ts";

/**
 * Extract filename or directory name from a path
 * @param path - The file path to extract name from
 * @returns The filename or directory name, or 'Root' for root path
 */
export function getNameFromPath(path: string): string {
    if (path === '/') return 'Root'
    return path.split('/').pop() || path
}

/**
 * Check if a file is hidden (starts with .)
 * @param name - The filename to check
 * @returns True if the file is hidden
 */
export function isFileHidden(name: string): boolean {
    return name.startsWith('.')
}

/**
 * Process file entries to add additional UI properties
 * @param entries - Array of file entries to process
 * @returns Processed file entries with additional UI properties
 */
export function processFileEntries(entries: FileEntry[]): FileEntry[] {
    if (!Array.isArray(entries)) {
        return []
    }

    return entries.map(entry => {
        const name = getNameFromPath(entry.path)

        const systemDirectories = ['bin', 'lib', 'lib64', 'sbin', 'dev', 'boot', 'etc', 'usr', 'proc', 'sys', 'var'];

        if (systemDirectories.includes(name)) {
            entry.entry_type = 'Directory';
        }

        return {
            ...entry,
            name,
            isHidden: isFileHidden(name),
            modified: new Date().toISOString(),
            permissions: entry.entry_type === 'Directory' ? 'drwxr-xr-x' : '-rw-r--r--',
            owner: 'user',
            group: 'user'
        }
    })
}

/**
 * Create a file operation entry
 * @param type - The type of file operation
 * @param source - Source path for the operation
 * @param destination - Destination path for the operation
 * @param status - Current status of the operation
 * @returns A new file operation object
 */
export function createOperationEntry(
    type: FileOperation['type'],
    source: string,
    destination?: string,
    status: FileOperation['status'] = 'completed'
): FileOperation {
    const now = new Date().toISOString()

    return {
        id: Date.now().toString(),
        type,
        source,
        destination,
        progress: status === 'completed' ? 100 : 0,
        status,
        startTime: now,
        endTime: status === 'completed' ? now : undefined
    }
}

/**
 * Get breadcrumbs from a path
 * @param path - The file path to create breadcrumbs for
 * @returns Array of breadcrumb objects with name and path
 */
export function getPathBreadcrumbs(path: string): { name: string, path: string }[] {
    const parts = path.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];

    let currentPath = '';
    for (const part of parts) {
        currentPath += '/' + part;
        breadcrumbs.push({ name: part, path: currentPath });
    }

    return breadcrumbs;
}

/**
 * Get parent directory path
 * @param path - The file path to get parent directory for
 * @returns The parent directory path
 */
export function getParentDirectory(path: string): string {
    if (path === '/') return '/';
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    return parentPath || '/';
}

/**
 * Filter and sort directory contents
 * @param entries - Array of file entries to filter and sort
 * @param showHidden - Whether to show hidden files
 * @param sortByField - Field to sort by
 * @param sortDesc - Whether to sort in descending order
 * @returns Filtered and sorted file entries
 */
export function filterAndSortEntries(
    entries: FileEntry[],
    showHidden: boolean,
    sortByField: string,
    sortDesc: boolean
): FileEntry[] {
    let filtered = [...entries];

    if (!showHidden) {
        filtered = filtered.filter(item => !(item.isHidden ?? false));
    }

    return filtered.sort((a, b) => {
        if (a.entry_type !== b.entry_type) {
            return a.entry_type === 'Directory' ? -1 : 1;
        }

        const aValue = a[sortByField as keyof FileEntry] ?? '';
        const bValue = b[sortByField as keyof FileEntry] ?? '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDesc
                ? bValue.localeCompare(aValue)
                : aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDesc
                ? bValue - aValue
                : aValue - bValue;
        }

        return 0;
    });
}

/**
 * Calculate disk usage percentage
 * @param stats - Filesystem statistics object
 * @returns Usage percentage as a number
 */
export function calculateDiskUsagePercent(stats: FileSystemStats): number {
    return Math.round((stats.usedSpace / (stats.totalSpace || 1)) * 100);
}

/**
 * Extract item name for copy/paste operations
 * @param item - File entry object
 * @param destination - Destination directory path
 * @returns The full destination path for the item
 */
export function getPasteDestinationPath(item: FileEntry, destination: string): string {
    const itemName = item.name || getNameFromPath(item.path);
    return `${destination}/${itemName}`.replace(/\/\//g, '/');
}

/**
 * Extract parent directory from a path
 * @param path - The file path to get parent from
 * @returns The parent directory path
 */
export function getParentPath(path: string): string {
    return path.substring(0, path.lastIndexOf('/'));
}

/**
 * Get new path after rename
 * @param oldPath - The original file path
 * @param newName - The new filename
 * @returns The new file path after rename
 */
export function getNewPathAfterRename(oldPath: string, newName: string): string {
    const parentDir = getParentPath(oldPath);
    return `${parentDir}/${newName}`.replace(/\/\//g, '/');
}

/**
 * Filter active file operations
 * @param operations - Array of file operations
 * @returns Array of active (pending or in-progress) operations
 */
export function filterActiveOperations(operations: FileOperation[]): FileOperation[] {
    return operations.filter(op => op.status === 'pending' || op.status === 'in-progress');
}

/**
 * Filter completed file operations
 * @param operations - Array of file operations
 * @returns Array of completed or failed operations
 */
export function filterCompletedOperations(operations: FileOperation[]): FileOperation[] {
    return operations.filter(op => op.status === 'completed' || op.status === 'failed');
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size with appropriate unit
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1000;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date for display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Get icon for file/directory based on type or extension
 * @param item - File entry object
 * @returns Material icon name
 */
export function getItemIcon(item: FileEntry): string {
    if (item.entry_type === 'Directory') {
        return 'folder';
    }

    const name = item.name || '';
    const extension = name.split('.').pop()?.toLowerCase() || '';

    switch (extension) {
        case 'pdf':
            return 'picture_as_pdf';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
            return 'image';
        case 'mp3':
        case 'wav':
        case 'ogg':
            return 'audio_file';
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'mkv':
            return 'movie';
        case 'doc':
        case 'docx':
        case 'txt':
        case 'md':
            return 'description';
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'table_chart';
        case 'ppt':
        case 'pptx':
            return 'slideshow';
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz':
            return 'archive';
        case 'js':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
        case 'html':
        case 'css':
        case 'php':
            return 'code';
        default:
            return 'insert_drive_file';
    }
}

/**
 * Get color for file type based on extension or type
 * @param item - File entry object
 * @returns Color name
 */
export function getItemColor(item: FileEntry): string {
    if (item.entry_type === 'Directory') {
        return 'primary';
    }

    const name = item.name || '';
    const extension = name.split('.').pop()?.toLowerCase() || '';

    switch (extension) {
        case 'pdf':
            return 'red';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
            return 'green';
        case 'mp3':
        case 'wav':
        case 'ogg':
            return 'purple';
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'mkv':
            return 'deep-purple';
        case 'doc':
        case 'docx':
        case 'txt':
        case 'md':
            return 'blue';
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'teal';
        case 'ppt':
        case 'pptx':
            return 'orange';
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz':
            return 'brown';
        case 'js':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
        case 'html':
        case 'css':
        case 'php':
            return 'indigo';
        default:
            return 'grey';
    }
}

/**
 * Get icon for file operation
 * @param operation - File operation object
 * @returns Material icon name
 */
export function getOperationIcon(operation: FileOperation): string {
    switch (operation.type) {
        case 'copy':
            return 'content_copy';
        case 'move':
            return 'drive_file_move';
        case 'delete':
            return 'delete';
        case 'create':
            return 'add';
        case 'upload':
            return 'upload_file';
        case 'download':
            return 'download';
        default:
            return 'help';
    }
}

/**
 * Get color for file operation
 * @param operation - File operation object
 * @returns Color name
 */
export function getOperationColor(operation: FileOperation): string {
    if (operation.status === 'failed') {
        return 'negative';
    }

    switch (operation.type) {
        case 'copy':
            return 'blue';
        case 'move':
            return 'teal';
        case 'delete':
            return 'red';
        case 'create':
            return 'positive';
        case 'upload':
            return 'purple';
        case 'download':
            return 'green';
        default:
            return 'grey';
    }
}

/**
 * Handle file upload from input element
 * @param event - File input change event
 * @param createFile - Function to create file
 * @param notify - Function to show notifications
 */
export async function handleFileUpload(
    event: Event,
    createFile: (name: string, content: string, parentDir?: string) => Promise<boolean>,
    notify: (type: NotificationType, message: string, options?: NotificationOptions) => void
): Promise<void> {
    if (!event.target || !(event.target as HTMLInputElement).files || (event.target as HTMLInputElement).files!.length === 0) {
        return;
    }

    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        if (!e.target || !e.target.result) {
            notify('negative', 'Failed to read file', { icon: 'error' });
            return;
        }

        const content = e.target.result.toString();

        try {
            await createFile(file.name, content);
            notify('positive', `File "${file.name}" uploaded successfully`, { icon: 'check_circle' });

            if (event.target) {
                (event.target as HTMLInputElement).value = '';
            }
        } catch (error) {
            notify('negative', `Failed to upload file: ${error}`, { icon: 'error' });
        }
    };

    reader.onerror = () => {
        notify('negative', 'Error reading file', { icon: 'error' });
    };

    reader.readAsText(file);
}