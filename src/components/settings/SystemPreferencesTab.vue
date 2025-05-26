<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useThemeStore } from '@/stores/themeStore';
import type { Config, ConfigValues } from '@/types/settings';
import { themeOptions} from '@/types/settings';
import * as SettingsUtils from '@/utils/settings';
import BookmarksEditor from './BookmarksEditor.vue';

const configStore = useConfigStore();
const notificationStore = useNotificationStore();
const themeStore = useThemeStore();

const configValues = reactive<ConfigValues>({});

const jsonDialogOpen = ref(false);
const jsonEditorValue = ref('');
const selectedConfig = ref<Config | null>(null);
const jsonEditorError = ref<string | undefined>(undefined);

const bookmarksChanged = ref(false);

const updateConfig = async (key: string, value: any, last_value: string): Promise<void> => {
  try {
    const stringValue = typeof value === 'object' ?
        (value !== null ? value.value || String(value) : '') :
        String(value);

    await configStore.updateConfig(key, stringValue, last_value);
    notificationStore.success(`Setting "${key}" updated successfully`);

    if (key === 'theme') {
      await themeStore.saveTheme(stringValue);
    }
  } catch (error) {
    notificationStore.error(`Error updating config ${key}`);
    console.error(`Error updating config ${key}:`, error);
  }
};

const updateTheme = async (key: string, value: any, last_value: string): Promise<void> => {
  const themeValue = typeof value === 'object' ? value.value : value;
  await updateConfig(key, themeValue, last_value);
};

const handleBookmarkChange = (value: string) => {
  if (!configValues['bookmarks']) return;
  configValues['bookmarks'] = value;
  bookmarksChanged.value = true;
};

const saveBookmarks = async (value: string) => {
  try {
    const bookmarkConfig = configStore.configs.find(c => c.key === 'bookmarks');
    if (bookmarkConfig) {
      await updateConfig('bookmarks', value, bookmarkConfig.value);
      bookmarksChanged.value = false;
    }
  } catch (err) {
    console.error('Error saving bookmarks:', err);
    notificationStore.error('Failed to save bookmarks');
  }
};

const formatJSONEditor = (): void => {
  try {
    jsonEditorValue.value = SettingsUtils.formatJSONEditor(jsonEditorValue.value);
    jsonEditorError.value = undefined;
  } catch (err) {
    jsonEditorError.value = err instanceof Error ? err.message : 'Invalid JSON format';
  }
};

const getConfigsByCategory = (category: string): Config[] => {
  switch(category) {
    case 'appearance':
      return configStore.configs.filter(config =>
          config.key === 'theme' ||
          config.key.includes('theme') ||
          config.key.includes('color') ||
          config.key.includes('display')
      );

    case 'general':
      return configStore.configs.filter(config =>
          config.key.includes('bookmark') ||
          config.key.includes('navigation')
      );

    default:
      return configStore.configs.filter(config => config.category === category);
  }
};

const handleToggle = (key: string, value: boolean, last_value: string): void => {
  const stringValue = value ? 'true' : 'false';
  configValues[key] = stringValue;
  updateConfig(key, stringValue, last_value);
};

const saveJsonEditor = async (): Promise<void> => {
  if (!selectedConfig.value) return;

  try {
    JSON.parse(jsonEditorValue.value);

    configValues[selectedConfig.value.key] = jsonEditorValue.value;

    await updateConfig(
        selectedConfig.value.key,
        jsonEditorValue.value,
        selectedConfig.value.value
    );

    jsonDialogOpen.value = false;
  } catch (err) {
    jsonEditorError.value = err instanceof Error ? err.message : 'Invalid JSON format';
  }
};

const openJsonEditor = (config: Config): void => {
  selectedConfig.value = config;
  jsonEditorValue.value = config.value;
  jsonEditorError.value = undefined;
  jsonDialogOpen.value = true;
};

const initConfigValues = (): void => {
  configStore.configs.forEach((config: Config) => {
    if (config.type === 'boolean') {
      configValues[config.key] = config.value === 'true' ? 'true' : 'false';
    } else if (config.type === 'number') {
      configValues[config.key] = Number(config.value);
    } else {
      configValues[config.key] = config.value;
    }
  });
};

watch(() => configStore.configs, () => {
  initConfigValues();
}, { immediate: true });

watch(() => themeStore.currentTheme, (newTheme) => {
  if (configValues['theme'] !== newTheme) {
    configValues['theme'] = newTheme;
  }
});

onMounted(async () => {
  await configStore.fetchConfigs();
  initConfigValues();
  await themeStore.initialize();
  if (configValues['theme'] !== themeStore.currentTheme) {
    configValues['theme'] = themeStore.currentTheme;
  }
});
</script>

<template>
  <div>
    <div class="text-h6 q-mb-md">System Preferences</div>

    <q-card class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Appearance</div>

        <!-- Theme setting -->
        <div v-if="getConfigsByCategory('appearance').length > 0">
          <q-list>
            <q-item v-for="config in getConfigsByCategory('appearance')" :key="config.key">
              <q-item-section>
                <q-item-label>{{ SettingsUtils.formatConfigLabel(config.key) }}</q-item-label>
                <q-item-label caption v-if="config.description">{{ config.description }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-if="config.type === 'boolean'"
                          :model-value="configValues[config.key] === 'true'"
                          @update:model-value="handleToggle(config.key, $event, config.value)"
                />
                <q-select v-else-if="config.key === 'theme'"
                          v-model="configValues[config.key]"
                          :options="themeOptions"
                          dense
                          options-dense
                          emit-value
                          map-options
                          @update:model-value="updateTheme(config.key, $event, config.value)"
                />
                <q-input v-else
                         v-model="configValues[config.key]"
                         dense
                         @update:model-value="updateConfig(config.key, $event, config.value)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
        <div v-else class="text-grey-7 q-pa-md text-center">No appearance settings found</div>
      </q-card-section>
    </q-card>

    <q-card class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Bookmarks & Navigation</div>
        <div v-if="getConfigsByCategory('general').length > 0">
          <q-list>
            <template v-for="config in getConfigsByCategory('general')" :key="config.key">
              <!-- Bookmark settings -->
              <q-item v-if="config.key === 'bookmarks'" class="column">
                <BookmarksEditor
                    :value="configValues[config.key] as string"
                    :on-change="handleBookmarkChange"
                    :on-save="saveBookmarks"
                />
              </q-item>

              <!-- Other settings -->
              <q-item v-else>
                <q-item-section>
                  <q-item-label>{{ SettingsUtils.formatConfigLabel(config.key) }}</q-item-label>
                  <q-item-label caption v-if="config.description">{{ config.description }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-if="config.type === 'boolean'"
                            :model-value="configValues[config.key] === 'true'"
                            @update:model-value="handleToggle(config.key, $event, config.value)"
                  />
                  <div v-else-if="config.type === 'json'" class="row items-center">
                    <q-btn flat dense color="primary" icon="code" @click="openJsonEditor(config)" label="Edit JSON" />
                  </div>
                  <q-input v-else
                           v-model="configValues[config.key]"
                           dense
                           @update:model-value="updateConfig(config.key, $event, config.value)"
                  />
                </q-item-section>
              </q-item>
            </template>
          </q-list>
        </div>
        <div v-else class="text-grey-7 q-pa-md text-center">No bookmark settings found</div>
      </q-card-section>
    </q-card>

    <!-- JSON Editor Dialog -->
    <q-dialog v-model="jsonDialogOpen" persistent>
      <q-card style="width: 800px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">Edit {{ selectedConfig ? SettingsUtils.formatConfigLabel(selectedConfig.key) : 'JSON' }}</div>
        </q-card-section>

        <q-card-section>
          <q-input
              v-model="jsonEditorValue"
              type="textarea"
              autogrow
              rows="10"
              :error="!!jsonEditorError"
              :error-message="jsonEditorError || undefined"
              class="monospace"
          />
          <div class="row justify-end q-gutter-sm q-mt-sm">
            <q-btn
                flat
                color="info"
                label="Format JSON"
                @click="formatJSONEditor"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="negative" v-close-popup />
          <q-btn flat label="Save" color="primary" @click="saveJsonEditor" :disable="!!jsonEditorError" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.monospace {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.q-card {
  transition: box-shadow 0.3s ease;
}

.q-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.q-item {
  transition: background-color 0.2s ease;
}

.q-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.dark .q-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

@media (max-width: 600px) {
  .q-item {
    flex-direction: column;
    align-items: stretch;
  }

  .q-item-section.side {
    padding-top: 8px;
    justify-content: flex-start;
  }
}
</style>