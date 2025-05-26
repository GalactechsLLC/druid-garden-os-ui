// themeStore.ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useConfigStore } from '@/stores/configStore';

export const useThemeStore = defineStore('theme', () => {
    const configStore = useConfigStore();
    const currentTheme = ref('default');
    const isDarkMode = ref(false);
    const isLoading = ref(true);

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
            console.error('Error loading theme:', error);
        } finally {
            isLoading.value = false;
        }
    };

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
            console.error('Error saving theme:', error);
            return false;
        }
    };

    const toggleDarkMode = async () => {
        const newTheme = isDarkMode.value ? 'default' : 'dark';
        return await saveTheme(newTheme);
    };

    const applyTheme = () => {
        document.body.classList.toggle('dark-mode', isDarkMode.value);
    };

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
