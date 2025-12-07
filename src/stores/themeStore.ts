import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useConfigStore } from '@/stores/configStore';

/**
 * Theme management store handling dark/light mode
 */
export const useThemeStore = defineStore('theme', () => {
    const configStore = useConfigStore();
    const currentTheme = ref('default');
    const isDarkMode = ref(false);
    const isLoading = ref(true);

    /**
     * Load theme from config store and apply to DOM
     * Ensures config is fetched if not already loaded
     */
    const loadTheme = async () => {
        isLoading.value = true;
        try {
            if (configStore.configs.length === 0) {
                await configStore.fetchConfigs();
            }

            const themeConfig = configStore.configs.find(c => c.key === 'theme');

            if (themeConfig) {
                currentTheme.value = themeConfig.value;
                isDarkMode.value = themeConfig.value === 'dark';
                applyTheme();
            }
        } catch (error) {
            // Silently fail to default theme
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Save theme preference to config and apply immediately
     * Updates both local state and persisted configuration
     */
    const saveTheme = async (theme: string) => {
        try {
            const themeConfig = configStore.configs.find(c => c.key === 'theme');

            if (themeConfig) {
                currentTheme.value = theme;
                isDarkMode.value = theme === 'dark';

                applyTheme();

                await configStore.updateConfig('theme', theme, themeConfig.value);

                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    /**
     * Toggle between dark and default themes
     */
    const toggleDarkMode = async () => {
        const newTheme = isDarkMode.value ? 'default' : 'dark';
        return await saveTheme(newTheme);
    };

    /**
     * Apply current theme to document body by toggling CSS class
     */
    const applyTheme = () => {
        document.body.classList.toggle('dark-mode', isDarkMode.value);
    };

    /**
     * Initialize store by loading saved theme preference
     */
    const initialize = async () => {
        await loadTheme();
    };

    return {
        currentTheme,
        isDarkMode,
        isLoading,
        loadTheme,
        saveTheme,
        toggleDarkMode,
        applyTheme,
        initialize
    };
});