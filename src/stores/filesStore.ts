import { defineStore } from 'pinia'
import {ref, computed, onMounted, watch} from 'vue'
import type { FileEntry, FileOperation, FileSystemStats, Bookmark } from '@/types/files'
import * as FileUtils from '@/utils/files'
import * as FileServices from '@/services/files'
import {useNotificationStore} from "@/stores/notificationStore.ts";
import {useConfigStore} from "@/stores/configStore.ts";


export const useFilesStore = defineStore('files', () => {
    const configStore = useConfigStore();
    const notificationStore = useNotificationStore();

    console.log("Initial configs in filesStore:", configStore.configs);
    if (configStore.configs.length === 0) {
        console.log("Config store empty on initialization, trying to fetch");
        configStore.fetchConfigs().then(() => {
            console.log("Configs loaded on initialization:", configStore.configs.length);
            const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');
            if (bookmarkConfig) {
                console.log("Found bookmark config on init:", bookmarkConfig.key, bookmarkConfig.value?.substring(0, 100));
            } else {
                console.log("No bookmark config found after initialization");
            }
        }).catch(err => {
            console.error("Error fetching configs on initialization:", err);
        });
    } else {
        const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');
        if (bookmarkConfig) {
            console.log("Found bookmark config immediately:", bookmarkConfig.key, bookmarkConfig.value?.substring(0, 100));
        } else {
            console.log("No bookmark config found initially");
        }
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

    function saveBookmarksToStorage(bookmarksData: any[]) {
        try {
            localStorage.setItem('file_manager_bookmarks', JSON.stringify(bookmarksData));
            console.log('Saved bookmarks to localStorage:', bookmarksData);
            return true;
        } catch (err) {
            console.error('Failed to save bookmarks to localStorage:', err);
            return false;
        }
    }

    function loadBookmarksFromStorage() {
        try {
            const data = localStorage.getItem('file_manager_bookmarks');
            if (data) {
                const parsed = JSON.parse(data);
                console.log('Loaded bookmarks from localStorage:', parsed);
                return parsed;
            }
        } catch (err) {
            console.error('Failed to load bookmarks from localStorage:', err);
        }
        return null;
    }

    async function fetchDirectoryContents(dirPath: string = currentDirectory.value) {
        try {
            loading.value = true
            error.value = null

            const entries = await FileServices.fetchDirectoryContents(dirPath)
            directoryContents.value = entries

            currentDirectory.value = dirPath

            if (fileHistory.value[historyIndex.value] !== dirPath) {
                fileHistory.value = fileHistory.value.slice(0, historyIndex.value + 1)
                fileHistory.value.push(dirPath)
                historyIndex.value = fileHistory.value.length - 1
            }

            loading.value = false
            return entries
        } catch (err) {
            console.error('Failed to fetch directory contents:', err)
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
            console.error('Failed to open file:', err);

            if (file.entry_type === 'Directory') {
                error.value = err instanceof Error ? err.message : 'Unknown error occurred';
            } else {
                error.value = null;

                const errorDetail = err instanceof Error ? err.message :
                    (typeof err === 'string' ? err :
                        (err && typeof err === 'object' ? JSON.stringify(err) : 'Unknown error'));

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
            console.error('Failed to save file:', err)
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
            console.error('Failed to create directory:', err)
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
            console.error('Failed to create file:', err)
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
            console.error('Failed to delete items:', err)
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



    async function pasteFromClipboard(destination: string = currentDirectory.value) {
        if (!clipboardItems.value.items.length || !clipboardItems.value.operation) {
            return false
        }

        try {
            loading.value = true
            error.value = null

            const items = clipboardItems.value.items
            const operation = clipboardItems.value.operation

            console.log(`Pasting ${items.length} items with operation: ${operation}`)

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

            if (operation === 'cut') {
                clipboardItems.value = { items: [], operation: null }
            }

            await fetchDirectoryContents(currentDirectory.value)

            loading.value = false
            return true
        } catch (err) {
            console.error('Failed to paste items:', err)
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
            console.error('Failed to rename item:', err)
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
            console.error('Failed to search files:', err)
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
            console.error('Failed to fetch disk stats:', err)
            error.value = err instanceof Error ? err.message : 'Unknown error occurred'
            return diskStats.value
        }
    }

    function loadBookmarksFromConfig(): void {
        console.log("Loading bookmarks from config...");

        try {
            const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');

            console.log("Bookmark config found:", bookmarkConfig);

            if (bookmarkConfig && bookmarkConfig.value) {
                console.log('Bookmark config value:', bookmarkConfig.value);
                let bookmarksObj: Record<string, string> = {};
                let parseSuccess = false;
                try {
                    bookmarksObj = JSON.parse(bookmarkConfig.value);
                    console.log('Successfully parsed bookmarks using JSON.parse:', bookmarksObj);
                    parseSuccess = true;
                } catch (jsonError) {
                    console.warn('Standard JSON parse failed:', jsonError);

                    try {
                        const cleanValue = bookmarkConfig.value
                            .replace(/'/g, '"')
                            .replace(/,\s*}/g, '}')
                            .replace(/,\s*\]/g, ']');

                        bookmarksObj = JSON.parse(cleanValue);
                        console.log('Successfully parsed with cleaned JSON:', bookmarksObj);
                        parseSuccess = true;
                    } catch (cleanError) {
                        console.warn('Cleaned JSON parse failed:', cleanError);
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
                            console.log('Extracted bookmarks using regex:', bookmarksObj);
                        } catch (regexError) {
                            console.warn('Regex parsing failed:', regexError);
                        }
                    }
                }

                if (parseSuccess && Object.keys(bookmarksObj).length > 0) {
                    const newBookmarks: Bookmark[] = [];

                    Object.entries(bookmarksObj).forEach(([name, path]) => {
                        let icon = 'bookmark';
                        let color = 'blue';

                        if (path === '/') {
                            icon = 'folder';
                            color = 'deep-orange';
                        } else if (path === '~') {
                            icon = 'home';
                            color = 'primary';
                        }
                        newBookmarks.push({
                            name,
                            path,
                            icon,
                            color
                        });
                    });

                    console.log('Loaded bookmarks from config:', newBookmarks);
                    bookmarks.value = newBookmarks;
                    localStorage.setItem('file_manager_bookmarks', JSON.stringify(newBookmarks));
                    return;
                }
            }

            console.log('No valid bookmarks config found in database, checking localStorage');

            const savedBookmarks = localStorage.getItem('file_manager_bookmarks');
            if (savedBookmarks) {
                try {
                    const parsedBookmarks = JSON.parse(savedBookmarks);
                    if (Array.isArray(parsedBookmarks) && parsedBookmarks.length > 0) {
                        console.log('Using bookmarks from localStorage:', parsedBookmarks);
                        bookmarks.value = parsedBookmarks;
                        return;
                    }
                } catch (err) {
                    console.error('Failed to parse localStorage bookmarks:', err);
                }
            }

            console.log('No bookmarks found anywhere, using defaults');

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
            }).catch(err => {
                console.error('Failed to save default bookmarks to config:', err);
            });
        } catch (err) {
            console.error('Error loading bookmarks from config:', err);

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

    async function saveBookmarksToConfig(bookmarksObj?: Record<string, string> | null): Promise<boolean> {
        try {
            const bookmarksToSave: Record<string, string> = bookmarksObj || {};

            if (!bookmarksObj) {
                bookmarks.value.forEach(bookmark => {
                    bookmarksToSave[bookmark.name] = bookmark.path;
                });
                console.log('Saving current bookmarks to config:', bookmarksToSave);
            }

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

            console.log('Formatted JSON to save:', formattedJson);

            const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');

            if (bookmarkConfig) {
                console.log('Updating existing bookmarks config:', bookmarkConfig.key);
                await configStore.updateConfig('bookmarks', formattedJson, bookmarkConfig.value);
                console.log('Successfully updated bookmarks config');
                return true;
            } else {
                console.log('No existing bookmarks config found, creating new one');

                if (configStore.configs.length === 0) {
                    console.log("Config store empty, fetching configs first");
                    await configStore.fetchConfigs();
                }

                try {
                    const newConfig = await configStore.createConfig({
                        key: 'bookmarks',
                        value: formattedJson,
                        category: 'files',
                        system: 0
                    });

                    console.log('Successfully created bookmarks config:', newConfig);

                    await configStore.fetchConfigs();
                    const verifyConfig = configStore.configs.find(c => c.key === 'bookmarks');
                    if (verifyConfig) {
                        console.log("Verified config was created successfully");
                    } else {
                        console.warn("Config creation succeeded but verification failed");
                    }

                    return true;
                } catch (createErr) {
                    console.error('Failed to create bookmarks config:', createErr);

                    try {
                        localStorage.setItem('file_manager_bookmarks', JSON.stringify(bookmarks.value));
                        console.log('Saved bookmarks to localStorage as fallback');
                    } catch (lsErr) {
                        console.error('Failed to save to localStorage:', lsErr);
                    }

                    return false;
                }
            }
        } catch (err) {
            console.error('Failed to save bookmarks to config:', err);
            return false;
        }
    }

    function addBookmark(path: string, name: string, icon: string = 'bookmark', color: string = 'blue'): boolean {
        if (bookmarks.value.some(b => b.path === path)) {
            return false;
        }

        console.log(`Adding bookmark: ${name} -> ${path}`);

        bookmarks.value.push({ name, path, icon, color });

        saveBookmarksToStorage(bookmarks.value);

        saveBookmarksToConfig()
            .then(success => {
                if (success) {
                    console.log(`Successfully saved bookmark: ${name}`);

                    configStore.fetchConfigs().then(() => {
                        console.log('Config refreshed after bookmark addition');
                        loadBookmarksFromConfig();
                        notificationStore.success(`Added "${name}" to bookmarks`);
                    }).catch(err => {
                        console.error('Error refreshing configs after bookmark addition:', err);
                        notificationStore.success(`Added "${name}" to bookmarks`);
                    });
                } else {
                    console.warn('Failed to save bookmark to config, but saved to localStorage');
                    notificationStore.warning('Bookmark may not persist in all sessions');
                }
            })
            .catch(err => {
                console.error('Error saving bookmark to config:', err);
                notificationStore.success(`Bookmark added to current session`);
            });

        return true;
    }

    function removeBookmark(path: string): boolean {
        const index = bookmarks.value.findIndex(b => b.path === path)
        if (index >= 0) {
            console.log(`Removing bookmark: ${bookmarks.value[index].name}`);

            const bookmarkName = bookmarks.value[index].name;

            bookmarks.value.splice(index, 1);

            saveBookmarksToStorage(bookmarks.value);

            saveBookmarksToConfig()
                .then(success => {
                    if (success) {
                        console.log('Successfully removed bookmark from config');

                        configStore.fetchConfigs().then(() => {
                            console.log('Config refreshed after bookmark removal');
                            loadBookmarksFromConfig();
                            notificationStore.success(`Bookmark "${bookmarkName}" removed`);
                        }).catch(err => {
                            console.error('Error refreshing configs after bookmark removal:', err);
                            notificationStore.success(`Bookmark "${bookmarkName}" removed`);
                        });
                    } else {
                        console.warn('Failed to remove bookmark from config, but removed from localStorage');
                        notificationStore.warning('Bookmark may not persist in all sessions');
                    }
                })
                .catch(err => {
                    console.error('Error removing bookmark from config:', err);
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

    onMounted(async () => {
        console.log("Files store mounted, loading configs and bookmarks");

        if (configStore.configs.length === 0) {
            console.log("Config store empty, loading configs first");
            try {
                await configStore.fetchConfigs();
                console.log("Configs loaded, count:", configStore.configs.length);
                console.log("Available configs:", configStore.configs.map(c => c.key));
            } catch (err) {
                console.error("Error loading configs:", err);
            }
        } else {
            console.log("Config store already loaded, count:", configStore.configs.length);
        }

        loadBookmarksFromConfig();

        fetchDirectoryContents();
        fetchDiskStats();
    });

    watch(() => configStore.configs, (newConfigs) => {
        console.log("Config store updated, new count:", newConfigs.length);
        const bookmarkConfig = newConfigs.find(c => c.key === 'bookmarks');
        if (bookmarkConfig) {
            console.log("Bookmark config found in updated configs:", bookmarkConfig.value?.substring(0, 100));

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