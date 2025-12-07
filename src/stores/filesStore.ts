import { defineStore } from 'pinia'
import {ref, computed, onMounted, watch} from 'vue'
import type { FileEntry, FileOperation, FileSystemStats, Bookmark } from '@/types/files'
import * as FileUtils from '@/utils/files'
import * as FileServices from '@/services/files'
import {useNotificationStore} from "@/stores/notificationStore.ts";
import {useConfigStore} from "@/stores/configStore.ts";

/**
 * File manager store handling navigation, operations, and bookmarks
 * Integrates with config store for persistent bookmark storage
 */
export const useFilesStore = defineStore('files', () => {
    const configStore = useConfigStore();
    const notificationStore = useNotificationStore();

    // Initialize configs if empty
    if (configStore.configs.length === 0) {
        configStore.fetchConfigs().catch(() => {
            // Silently handle config fetch errors on initialization
        });
    }

    const currentDirectory = ref<string>('/')
    const directoryContents = ref<FileEntry[]>([])
    const selectedItems = ref<FileEntry[]>([])
    const clipboardItems = ref<{ items: FileEntry[], operation: 'copy' | 'cut' | null }>({
        items: [],
        operation: null
    })
    const fileOperations = ref<FileOperation[]>([])
    const loading = ref<boolean>(false)
    const error = ref<string | null>(null)
    const fileBeingEdited = ref<FileEntry | null>(null)
    const fileContent = ref<string>('')
    const searchResults = ref<FileEntry[]>([])
    const searchQuery = ref<string>('')
    const isSearching = ref<boolean>(false)
    const diskStats = ref<FileSystemStats>({
        totalSpace: 0,
        usedSpace: 0,
        freeSpace: 0
    })
    const bookmarks = ref<Bookmark[]>([])
    const fileHistory = ref<string[]>(['/'])
    const historyIndex = ref<number>(0)
    const sortBy = ref<string>('name')
    const sortDesc = ref<boolean>(false)
    const showHiddenFiles = ref<boolean>(false)
    const viewMode = ref<'list' | 'grid'>('list')
    const operationsTab = ref('active')

    const filteredContents = computed(() =>
        FileUtils.filterAndSortEntries(
            directoryContents.value,
            showHiddenFiles.value,
            sortBy.value,
            sortDesc.value
        )
    )

    const canGoBack = computed(() => historyIndex.value > 0)

    const canGoForward = computed(() => historyIndex.value < fileHistory.value.length - 1)

    const currentDirectoryBreadcrumbs = computed(() =>
        FileUtils.getPathBreadcrumbs(currentDirectory.value)
    )

    const activeFileOperations = computed(() =>
        FileUtils.filterActiveOperations(fileOperations.value)
    )

    const completedFileOperations = computed(() =>
        FileUtils.filterCompletedOperations(fileOperations.value)
    )

    const hasActiveOperations = computed(() => activeFileOperations.value.length > 0)

    const diskUsagePercentage = computed(() =>
        FileUtils.calculateDiskUsagePercent(diskStats.value)
    )

    function clearOperationHistory() {
        fileOperations.value = fileOperations.value.filter(op =>
            op.status === 'pending' || op.status === 'in-progress'
        )
    }

    function clearSelectedItems() {
        selectedItems.value = []
    }

    /**
     * Save bookmarks to localStorage as fallback storage
     */
    function saveBookmarksToStorage(bookmarksData: any[]) {
        try {
            localStorage.setItem('file_manager_bookmarks', JSON.stringify(bookmarksData));
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Load bookmarks from localStorage fallback storage
     */
    function loadBookmarksFromStorage() {
        try {
            const data = localStorage.getItem('file_manager_bookmarks');
            if (data) {
                const parsed = JSON.parse(data);
                return parsed;
            }
        } catch (err) {
            // Silently handle parsing errors
        }
        return null;
    }

    /**
     * Fetch directory contents and update navigation history
     */
    async function fetchDirectoryContents(dirPath: string = currentDirectory.value) {
        try {
            loading.value = true
            error.value = null

            const entries = await FileServices.fetchDirectoryContents(dirPath)
            directoryContents.value = entries

            currentDirectory.value = dirPath

            // Update navigation history
            if (fileHistory.value[historyIndex.value] !== dirPath) {
                fileHistory.value = fileHistory.value.slice(0, historyIndex.value + 1)
                fileHistory.value.push(dirPath)
                historyIndex.value = fileHistory.value.length - 1
            }

            loading.value = false
            return entries
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            directoryContents.value = []
            throw err
        }
    }

    async function navigateToDirectory(dirPath: string) {
        return fetchDirectoryContents(dirPath)
    }

    function navigateBack() {
        if (canGoBack.value) {
            historyIndex.value--
            fetchDirectoryContents(fileHistory.value[historyIndex.value])
        }
    }

    function navigateForward() {
        if (canGoForward.value) {
            historyIndex.value++
            fetchDirectoryContents(fileHistory.value[historyIndex.value])
        }
    }

    function navigateUp() {
        const parentPath = FileUtils.getParentDirectory(currentDirectory.value)
        navigateToDirectory(parentPath)
    }

    /**
     * Select item and optionally open it (directory navigation or file editing)
     */
    async function selectItem(item: FileEntry, multiple: boolean = false, openItem: boolean = true) {
        if (!multiple) {
            selectedItems.value = [item]

            if (openItem) {
                if (item.entry_type === 'Directory') {
                    navigateToDirectory(item.path)
                } else if (item.entry_type === 'File') {
                    await openFile(item)
                }
            }
        } else {
            const index = selectedItems.value.findIndex(i => i.path === item.path)
            if (index >= 0) {
                selectedItems.value.splice(index, 1)
            } else {
                selectedItems.value.push(item)
            }
        }
    }

    /**
     * Open file for editing with enhanced error handling for different file types
     */
    async function openFile(file: FileEntry) {
        try {
            loading.value = true;
            error.value = null;

            const response = await FileServices.openFile(file.path);

            fileBeingEdited.value = file;
            fileContent.value = response.contents;

            loading.value = false;
            return response.contents;
        } catch (err) {
            if (file.entry_type === 'Directory') {
                error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            } else {
                error.value = null;

                const errorDetail = err instanceof Error ? err.message :
                    (typeof err === 'string' ? err :
                        (err && typeof err === 'object' ? JSON.stringify(err) : 'Unknown error'));

                // Provide user-friendly error messages for common file issues
                let errorMessage = `Failed to open file: ${file.name}`;
                if (errorDetail.includes('stream did not contain valid UTF-8')) {
                    errorMessage = `"${file.name}" contains binary data and cannot be displayed as text`;
                } else if (errorDetail.includes('IsADirectory') || errorDetail.includes('Cannot open Directory as File')) {
                    errorMessage = `"${file.name}" is a directory, not a file`;
                } else if (errorDetail.includes('InvalidData')) {
                    errorMessage = `Cannot display "${file.name}": invalid data format`;
                }

                notificationStore.error(errorMessage, {
                    timeout: 10000,
                    closable: true
                });
            }

            loading.value = false;
            throw err;
        }
    }

    async function saveFile(path: string, content: string) {
        try {
            loading.value = true
            error.value = null

            await FileServices.saveFile(path, content)
            fileContent.value = content

            const newOperation = FileUtils.createOperationEntry('create', path)
            fileOperations.value.unshift(newOperation)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    function closeFile() {
        fileBeingEdited.value = null
        fileContent.value = ''
    }

    async function createDirectory(name: string, parentDir: string = currentDirectory.value) {
        try {
            loading.value = true
            error.value = null

            const fullPath = `${parentDir}/${name}`.replace(/\/\//g, '/')
            await FileServices.createDirectory(name, parentDir)

            const newOperation = FileUtils.createOperationEntry('create', fullPath)
            fileOperations.value.unshift(newOperation)

            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    async function createFile(name: string, content: string = '', parentDir: string = currentDirectory.value) {
        try {
            loading.value = true
            error.value = null

            const fullPath = `${parentDir}/${name}`.replace(/\/\//g, '/')
            await FileServices.createFile(name, content, parentDir)

            const newOperation = FileUtils.createOperationEntry('create', fullPath)
            fileOperations.value.unshift(newOperation)

            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    async function deleteItems(items: FileEntry[]) {
        try {
            loading.value = true
            error.value = null

            for (const item of items) {
                await FileServices.deleteItem(item.path)

                const newOperation = FileUtils.createOperationEntry('delete', item.path)
                fileOperations.value.unshift(newOperation)
            }
            selectedItems.value = []
            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    function copyToClipboard(items: FileEntry[]) {
        clipboardItems.value = {
            items: [...items],
            operation: 'copy'
        }
    }

    function cutToClipboard(items: FileEntry[]) {
        clipboardItems.value = {
            items: [...items],
            operation: 'cut'
        }
    }

    /**
     * Paste clipboard items with support for copy/cut operations
     * Handles both files and directories with appropriate operations
     */
    async function pasteFromClipboard(destination: string = currentDirectory.value) {
        if (!clipboardItems.value.items.length || !clipboardItems.value.operation) {
            return false
        }

        try {
            loading.value = true
            error.value = null

            const items = clipboardItems.value.items
            const operation = clipboardItems.value.operation

            for (const item of items) {
                const destPath = FileUtils.getPasteDestinationPath(item, destination)

                if (operation === 'copy') {
                    if (item.entry_type === 'File') {
                        const fileData = await FileServices.openFile(item.path)
                        const itemName = item.name || FileUtils.getNameFromPath(item.path)

                        await FileServices.createFile(itemName, fileData.contents, destination)
                    } else if (item.entry_type === 'Directory') {
                        const itemName = item.name || FileUtils.getNameFromPath(item.path)
                        await FileServices.createDirectory(itemName, destination)
                        // TODO: Copy directory contents recursively
                    }
                } else if (operation === 'cut') {
                    const newName = destPath.substring(destPath.lastIndexOf('/') + 1)
                    await FileServices.renameItem(item.path, newName)
                }

                const newOperation = FileUtils.createOperationEntry(
                    operation === 'copy' ? 'copy' : 'move',
                    item.path,
                    destPath
                )
                fileOperations.value.unshift(newOperation)
            }

            // Clear clipboard after cut operation
            if (operation === 'cut') {
                clipboardItems.value = { items: [], operation: null }
            }

            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    async function renameItem(item: FileEntry, newName: string) {
        try {
            loading.value = true
            error.value = null

            const newPath = FileUtils.getNewPathAfterRename(item.path, newName)
            await FileServices.renameItem(item.path, newName)

            const newOperation = FileUtils.createOperationEntry('move', item.path, newPath)
            fileOperations.value.unshift(newOperation)

            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            loading.value = false
            throw err
        }
    }

    async function searchFiles(query: string, path: string = '/') {
        if (!query.trim()) {
            searchResults.value = []
            isSearching.value = false
            return []
        }

        try {
            isSearching.value = true
            searchQuery.value = query

            const results = await FileServices.searchFiles(query, path)
            searchResults.value = results

            isSearching.value = false
            return results
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            isSearching.value = false
            searchResults.value = []
            throw err
        }
    }

    async function clearSearch() {
        searchQuery.value = ''
        searchResults.value = []
        isSearching.value = false
    }

    async function fetchDiskStats() {
        try {
            const stats = await FileServices.fetchDiskStats()
            diskStats.value = stats
            return stats
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            return diskStats.value
        }
    }

    /**
     * Load bookmarks from config store with fallback parsing strategies
     * Handles various JSON formats and provides localStorage fallback
     */
    function loadBookmarksFromConfig(): void {
        try {
            const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');

            if (bookmarkConfig && bookmarkConfig.value) {
                let bookmarksObj: Record<string, string> = {};
                let parseSuccess = false;

                // Try standard JSON parse first
                try {
                    bookmarksObj = JSON.parse(bookmarkConfig.value);
                    parseSuccess = true;
                } catch (jsonError) {
                    // Try cleaning malformed JSON
                    try {
                        const cleanValue = bookmarkConfig.value
                            .replace(/'/g, '"')
                            .replace(/,\s*}/g, '}')
                            .replace(/,\s*\]/g, ']');

                        bookmarksObj = JSON.parse(cleanValue);
                        parseSuccess = true;
                    } catch (cleanError) {
                        // Last resort: regex extraction
                        try {
                            const pairs = bookmarkConfig.value.match(/"([^"]+)"\s*:\s*"([^"]+)"/g) || [];
                            pairs.forEach(pair => {
                                const keyMatch = pair.match(/"([^"]+)"\s*:/);
                                const valueMatch = pair.match(/:\s*"([^"]+)"/);
                                if (keyMatch && keyMatch[1] && valueMatch && valueMatch[1]) {
                                    bookmarksObj[keyMatch[1]] = valueMatch[1];
                                    parseSuccess = true;
                                }
                            });
                        } catch (regexError) {
                            // All parsing methods failed
                        }
                    }
                }

                if (parseSuccess && Object.keys(bookmarksObj).length > 0) {
                    const newBookmarks: Bookmark[] = [];

                    Object.entries(bookmarksObj).forEach(([name, path]) => {
                        let icon = 'bookmark';
                        let color = 'blue';

                        // Set appropriate icons for common paths
                        if (path === '/') {
                            icon = 'folder';
                            color = 'deep-orange';
                        } else if (path === '~') {
                            icon = 'home';
                            color = 'primary';
                        }
                        newBookmarks.push({ name, path, icon, color });
                    });

                    bookmarks.value = newBookmarks;
                    localStorage.setItem('file_manager_bookmarks', JSON.stringify(newBookmarks));
                    return;
                }
            }

            // Fallback to localStorage
            const savedBookmarks = localStorage.getItem('file_manager_bookmarks');
            if (savedBookmarks) {
                try {
                    const parsedBookmarks = JSON.parse(savedBookmarks);
                    if (Array.isArray(parsedBookmarks) && parsedBookmarks.length > 0) {
                        bookmarks.value = parsedBookmarks;
                        return;
                    }
                } catch (err) {
                    // Failed to parse localStorage bookmarks
                }
            }

            // Use default bookmarks
            const defaultBookmarks = [
                {
                    name: 'Root',
                    path: '/',
                    icon: 'folder',
                    color: 'deep-orange'
                },
                {
                    name: 'Home',
                    path: '/home',
                    icon: 'home',
                    color: 'primary'
                }
            ];

            bookmarks.value = defaultBookmarks;
            localStorage.setItem('file_manager_bookmarks', JSON.stringify(defaultBookmarks));

            saveBookmarksToConfig({
                'Root': '/',
                'Home': '/home'
            }).catch(() => {
                // Silently handle save failure
            });
        } catch (err) {
            // Fallback to minimal default
            const defaultBookmarks = [
                {
                    name: 'Root',
                    path: '/',
                    icon: 'folder',
                    color: 'deep-orange'
                }
            ];

            bookmarks.value = defaultBookmarks;
            localStorage.setItem('file_manager_bookmarks', JSON.stringify(defaultBookmarks));
        }
    }

    /**
     * Save bookmarks to config store with formatted JSON
     * Creates new config entry if none exists
     */
    async function saveBookmarksToConfig(bookmarksObj?: Record<string, string> | null): Promise<boolean> {
        try {
            const bookmarksToSave: Record<string, string> = bookmarksObj || {};

            if (!bookmarksObj) {
                bookmarks.value.forEach(bookmark => {
                    bookmarksToSave[bookmark.name] = bookmark.path;
                });
            }

            // Format JSON with proper indentation
            let formattedJson = '{\n';
            const entries = Object.entries(bookmarksToSave);

            if (entries.length === 0) {
                formattedJson = '{}';
            } else {
                entries.forEach(([key, value], index) => {
                    formattedJson += `    "${key}": "${value}"`;
                    if (index < entries.length - 1) {
                        formattedJson += ',\n';
                    } else {
                        formattedJson += '\n';
                    }
                });
                formattedJson += '}';
            }

            const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');

            if (bookmarkConfig) {
                await configStore.updateConfig('bookmarks', formattedJson, bookmarkConfig.value);
                return true;
            } else {
                // Create new config if none exists
                if (configStore.configs.length === 0) {
                    await configStore.fetchConfigs();
                }

                try {
                    await configStore.createConfig({
                        key: 'bookmarks',
                        value: formattedJson,
                        category: 'files',
                        system: 0
                    });

                    await configStore.fetchConfigs();
                    return true;
                } catch (createErr) {
                    // Save to localStorage as fallback
                    try {
                        localStorage.setItem('file_manager_bookmarks', JSON.stringify(bookmarks.value));
                    } catch (lsErr) {
                        // Complete storage failure
                    }
                    return false;
                }
            }
        } catch (err) {
            return false;
        }
    }

    /**
     * Add new bookmark with duplicate path checking
     */
    function addBookmark(path: string, name: string, icon: string = 'bookmark', color: string = 'blue'): boolean {
        if (bookmarks.value.some(b => b.path === path)) {
            return false;
        }

        bookmarks.value.push({ name, path, icon, color });

        saveBookmarksToStorage(bookmarks.value);

        saveBookmarksToConfig()
            .then(success => {
                if (success) {
                    configStore.fetchConfigs().then(() => {
                        loadBookmarksFromConfig();
                        notificationStore.success(`Added "${name}" to bookmarks`);
                    }).catch(() => {
                        notificationStore.success(`Added "${name}" to bookmarks`);
                    });
                } else {
                    notificationStore.warning('Bookmark may not persist in all sessions');
                }
            })
            .catch(() => {
                notificationStore.success(`Bookmark added to current session`);
            });

        return true;
    }

    /**
     * Remove bookmark by path
     */
    function removeBookmark(path: string): boolean {
        const index = bookmarks.value.findIndex(b => b.path === path)
        if (index >= 0) {
            const bookmarkName = bookmarks.value[index].name;

            bookmarks.value.splice(index, 1);

            saveBookmarksToStorage(bookmarks.value);

            saveBookmarksToConfig()
                .then(success => {
                    if (success) {
                        configStore.fetchConfigs().then(() => {
                            loadBookmarksFromConfig();
                            notificationStore.success(`Bookmark "${bookmarkName}" removed`);
                        }).catch(() => {
                            notificationStore.success(`Bookmark "${bookmarkName}" removed`);
                        });
                    } else {
                        notificationStore.warning('Bookmark may not persist in all sessions');
                    }
                })
                .catch(() => {
                    notificationStore.success(`Bookmark removed from current session`);
                });

            return true;
        }
        return false;
    }

    function setSortingOptions(by: string, descending: boolean) {
        sortBy.value = by
        sortDesc.value = descending
    }

    function toggleHiddenFiles() {
        showHiddenFiles.value = !showHiddenFiles.value
    }

    function changeViewMode(mode: 'list' | 'grid') {
        viewMode.value = mode
    }

    /**
     * Initialize store by loading configs and setting up initial state
     */
    onMounted(async () => {
        if (configStore.configs.length === 0) {
            try {
                await configStore.fetchConfigs();
            } catch (err) {
                // Continue with initialization even if config fetch fails
            }
        }

        loadBookmarksFromConfig();
        fetchDirectoryContents();
        fetchDiskStats();
    });

    /**
     * Watch for config changes and reload bookmarks accordingly
     */
    watch(() => configStore.configs, (newConfigs) => {
        const bookmarkConfig = newConfigs.find(c => c.key === 'bookmarks');
        if (bookmarkConfig) {
            loadBookmarksFromConfig();
        }
    }, { deep: true });

    return {
        operationsTab,
        currentDirectory,
        directoryContents,
        selectedItems,
        clipboardItems,
        fileOperations,
        loading,
        error,
        fileBeingEdited,
        fileContent,
        searchResults,
        searchQuery,
        isSearching,
        diskStats,
        bookmarks,
        fileHistory,
        historyIndex,
        sortBy,
        sortDesc,
        showHiddenFiles,
        viewMode,
        filteredContents,
        canGoBack,
        canGoForward,
        currentDirectoryBreadcrumbs,
        activeFileOperations,
        completedFileOperations,
        hasActiveOperations,
        diskUsagePercentage,
        clearSelectedItems,
        fetchDirectoryContents,
        navigateToDirectory,
        navigateBack,
        navigateForward,
        navigateUp,
        selectItem,
        openFile,
        saveFile,
        closeFile,
        createDirectory,
        createFile,
        deleteItems,
        copyToClipboard,
        cutToClipboard,
        pasteFromClipboard,
        renameItem,
        searchFiles,
        clearSearch,
        fetchDiskStats,
        addBookmark,
        removeBookmark,
        loadBookmarksFromConfig,
        setSortingOptions,
        toggleHiddenFiles,
        changeViewMode,
        clearOperationHistory
    }
})