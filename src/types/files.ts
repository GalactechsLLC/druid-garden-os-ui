/**
 * File or directory entry information
 */
export interface FileEntry {
    path: string;
    entry_type: 'Directory' | 'File';
    /** Size in bytes */
    size: number;
    name?: string;
    /** ISO date string */
    modified?: string;
    /** Unix-style permissions (e.g., "rwxr-xr-x") */
    permissions?: string;
    owner?: string;
    group?: string;
    mimetype?: string;
    /** Whether filename starts with '.' */
    isHidden?: boolean;
}

/**
 * File contents and metadata
 */
export interface FileContents {
    contents: string;
    mime_type: string;
}

/**
 * File operation tracking
 */
export interface FileOperation {
    id: string;
    type: 'copy' | 'move' | 'delete' | 'create' | 'upload' | 'download';
    source: string;
    destination?: string;
    /** Progress percentage (0-100) */
    progress: number;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    /** ISO date string */
    startTime: string;
    /** ISO date string */
    endTime?: string;
    error?: string;
}

/**
 * Filesystem space and inode statistics
 */
export interface FileSystemStats {
    /** Total space in bytes */
    totalSpace: number;
    /** Used space in bytes */
    usedSpace: number;
    /** Free space in bytes */
    freeSpace: number;
    inodeTotal?: number;
    inodeUsed?: number;
    inodeFree?: number;
}

/**
 * User-defined bookmark for quick navigation
 */
export interface Bookmark {
    name: string;
    path: string;
    /** Material icon name */
    icon?: string;
    /** Color name or hex code */
    color?: string;
}