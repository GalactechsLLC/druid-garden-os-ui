import type {FileContents, FileEntry, FileSystemStats} from "@/types/files.ts";
import {del, get, post, put} from "@/utils/api.ts";
import {processFileEntries} from "@/utils/files.ts";

/**
 * Fetch directory contents from API
 */
export async function fetchDirectoryContents(dirPath: string): Promise<FileEntry[]> {
    try {
        console.log('Fetching directory contents for:', dirPath)

        const response = await post('api/files/list', { path: dirPath }, {
            errorMessage: `Failed to fetch contents of ${dirPath}`
        })

        console.log('API response:', response)

        let entries = [];
        if (Array.isArray(response)) {
            entries = response;
        } else if (response && typeof response === 'object') {
            if (Array.isArray(response.entries)) {
                entries = response.entries;
            } else if (Array.isArray(response.data)) {
                entries = response.data;
            } else if (Array.isArray(response.files)) {
                entries = response.files;
            } else {
                console.error('Unexpected API response format:', response);
                entries = [];
            }
        } else {
            console.error('Unexpected API response format:', response);
            entries = [];
        }

        return processFileEntries(entries)
    } catch (err) {
        console.error('Failed to fetch directory contents:', err)
        throw err
    }
}

/**
 * Open a file and get its contents
 */
export async function openFile(filePath: string): Promise<FileContents> {
    try {
        console.log('Opening file:', filePath)

        return await post('api/files/file', { path: filePath }, {
            errorMessage: `Failed to open file: ${filePath}`,
            showErrorNotification: false
        })
    } catch (err) {
        console.error('Failed to open file:', err)
        throw err
    }
}

/**
 * Save file contents
 */
export async function saveFile(path: string, content: string): Promise<boolean> {
    try {
        console.log('Saving file:', path)

        const encoder = new TextEncoder()
        const contentBytes = Array.from(encoder.encode(content))

        await put('api/files/file/save', {
            path,
            contents: contentBytes
        }, {
            successMessage: `File ${path} saved successfully`,
            showSuccessNotification: true,
            errorMessage: `Failed to save file: ${path}`
        })

        return true
    } catch (err) {
        console.error('Failed to save file:', err)
        throw err
    }
}

/**
 * Create a new directory
 */
export async function createDirectory(name: string, parentDir: string): Promise<boolean> {
    try {
        const fullPath = `${parentDir}/${name}`.replace(/\/\//g, '/')
        console.log('Creating directory:', fullPath)

        await post('api/files/directory', {
            path: fullPath
        }, {
            successMessage: `Directory ${name} created successfully`,
            showSuccessNotification: true,
            errorMessage: `Failed to create directory: ${name}`
        })

        return true
    } catch (err) {
        console.error('Failed to create directory:', err)
        throw err
    }
}

/**
 * Create a new file
 */
export async function createFile(name: string, content: string = '', parentDir: string): Promise<boolean> {
    try {
        const fullPath = `${parentDir}/${name}`.replace(/\/\//g, '/')
        console.log('Creating file:', fullPath)

        const encoder = new TextEncoder()
        const contentBytes = Array.from(encoder.encode(content))

        await post('api/files/file/create', {
            path: fullPath,
            contents: contentBytes
        }, {
            successMessage: `File ${name} created successfully`,
            showSuccessNotification: true,
            errorMessage: `Failed to create file: ${name}`
        })

        return true
    } catch (err) {
        console.error('Failed to create file:', err)
        throw err
    }
}

/**
 * Delete file or directory
 */
export async function deleteItem(path: string): Promise<boolean> {
    try {
        console.log('Deleting item:', path)

        await del('api/files/remove', {
            body: { path },
            successMessage: `Item deleted successfully`,
            showSuccessNotification: true,
            errorMessage: `Failed to delete item: ${path}`
        })

        return true
    } catch (err) {
        console.error('Failed to delete item:', err)
        throw err
    }
}

/**
 * Rename file or directory
 */
export async function renameItem(oldPath: string, newName: string): Promise<boolean> {
    try {
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'))
        const newPath = `${parentDir}/${newName}`.replace(/\/\//g, '/')

        console.log(`Renaming from ${oldPath} to ${newPath}`)

        await post('api/files/rename', {
            from: oldPath,
            to: newPath
        }, {
            successMessage: `Item renamed successfully`,
            showSuccessNotification: true,
            errorMessage: `Failed to rename item`
        })

        return true
    } catch (err) {
        console.error('Failed to rename item:', err)
        throw err
    }
}

/**
 * Get file system stats (disk usage)
 *
 */
export async function fetchDiskStats(): Promise<FileSystemStats> {
    try {
        const disks = await get('api/disks/list', {
            errorMessage: 'Failed to fetch disk information',
            showErrorNotification: false
        })

        let totalSpace = 0
        let usedSpace = 0

        if (Array.isArray(disks) && disks.length > 0) {
            for (const disk of disks) {
                if (disk.size) totalSpace += disk.size
                if (disk.size_used) usedSpace += disk.size_used
            }
        }
        const freeSpace = totalSpace - usedSpace

        return {
            totalSpace,
            usedSpace,
            freeSpace
        }
    } catch (err) {
        console.error('Failed to fetch disk stats:', err)

        return {
            totalSpace: 0,
            usedSpace: 0,
            freeSpace: 0
        }
    }
}

/**
 * Search for files and directories
 * Note: This is a placeholder - your backend needs a proper search endpoint
 */
export async function searchFiles(query: string, path: string = '/'): Promise<FileEntry[]> {
    try {
        if (!query.trim()) {
            return []
        }

        // Note: When your backend implements a search endpoint, you can replace this with:
        // const results = await post('files/search', { query, path }, {
        //   errorMessage: `Failed to search for "${query}"`
        // })

        // For now, use the client-side implementation:
        const files = await fetchDirectoryContents(path)

        // Filter files that match the query
        return files.filter(file =>
            file.name?.toLowerCase().includes(query.toLowerCase())
        )
    } catch (err) {
        console.error('Failed to search files:', err)
        throw err
    }
}
