export interface FileEntry {
    path: string;
    entry_type: 'Directory' | 'File';
    size: number;
    name?: string;
    modified?: string;
    permissions?: string;
    owner?: string;
    group?: string;
    mimetype?: string;
    isHidden?: boolean;
}

export interface FileContents {
    contents: string;
    mime_type: string;
}

export interface FileOperation {
    id: string;
    type: 'copy' | 'move' | 'delete' | 'create' | 'upload' | 'download';
    source: string;
    destination?: string;
    progress: number;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    startTime: string;
    endTime?: string;
    error?: string;
}

export interface FileSystemStats {
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    inodeTotal?: number;
    inodeUsed?: number;
    inodeFree?: number;
}

export interface Bookmark {
    name: string;
    path: string;
    icon?: string;
    color?: string;
}
