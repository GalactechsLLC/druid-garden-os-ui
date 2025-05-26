<script setup lang="ts">
import { ref, watch } from 'vue';

// Define props
const props = defineProps<{
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
}>();

const bookmarks = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref('');
const saveTimeout = ref<number | null>(null);

const newBookmark = ref({ name: '', path: '' });
const showForm = ref(false);

const parseBookmarks = (configValue: string): void => {
  try {
    if (!configValue || configValue.trim() === '') {
      bookmarks.value = {};
      return;
    }

    try {
      // Accept the format as-is without trying to "fix" it
      const parsed = Function('"use strict";return (' + configValue + ')')();
      if (parsed && typeof parsed === 'object') {
        bookmarks.value = parsed;
      } else {
        bookmarks.value = {};
      }
    } catch (parseErr) {
      console.error('Error parsing bookmarks:', parseErr);

      try {
        const bookmarksObj: Record<string, string> = {};
        const matches = configValue.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g);
        let foundMatches = false;

        for (const match of matches) {
          if (match[1] && match[2]) {
            bookmarksObj[match[1]] = match[2];
            foundMatches = true;
          }
        }

        if (foundMatches) {
          bookmarks.value = bookmarksObj;
        } else {
          bookmarks.value = {};
          error.value = 'Unable to parse bookmarks data';
        }
      } catch (regexErr) {
        console.error('Regex parsing error:', regexErr);
        bookmarks.value = {};
        error.value = 'Could not process bookmarks data';
      }
    }
  } catch (err) {
    console.error('Error handling bookmarks:', err);
    bookmarks.value = {};
    error.value = 'Error processing bookmarks data';
  }
};

const formatBookmarks = (): string => {
  const entries = Object.entries(bookmarks.value);
  if (entries.length === 0) {
    return '{}';
  }

  let result = '{\n';
  entries.forEach(([key, value], index) => {
    result += `    "${key}": "${value}"`;
    if (index < entries.length - 1) {
      result += ',\n';
    } else {
      result += ',\n';
    }
  });
  result += '}';

  return result;
};

const updateBookmarks = (): void => {
  try {
    const formattedBookmarks = formatBookmarks();
    props.onChange(formattedBookmarks);

    if (saveTimeout.value !== null) {
      clearTimeout(saveTimeout.value);
    }

    saveTimeout.value = setTimeout(() => {
      saveBookmarks();
    }, 1000) as unknown as number;

    error.value = '';
  } catch (err) {
    console.error('Error updating bookmarks:', err);
    error.value = 'Failed to update bookmarks format';
  }
};

const addBookmark = (): void => {
  if (!newBookmark.value.name || !newBookmark.value.path) {
    error.value = 'Name and Path are required';
    return;
  }
  bookmarks.value[newBookmark.value.name] = newBookmark.value.path;
  newBookmark.value = { name: '', path: '' };
  showForm.value = false;

  updateBookmarks();
};

const removeBookmark = (name: string): void => {
  if (bookmarks.value[name] !== undefined) {
    const updatedBookmarks = { ...bookmarks.value };
    delete updatedBookmarks[name];
    bookmarks.value = updatedBookmarks;
    updateBookmarks();
  }
};

const saveBookmarks = async (): Promise<void> => {
  loading.value = true;
  error.value = '';

  try {
    const formattedBookmarks = formatBookmarks();
    await props.onSave(formattedBookmarks);
  } catch (err) {
    console.error('Error saving bookmarks:', err);
    error.value = 'Failed to save bookmarks';
  } finally {
    loading.value = false;
  }
};

watch(() => props.value, (newValue) => {
  parseBookmarks(newValue);
}, { immediate: true });
</script>

<template>
  <div class="bookmarks-editor q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle2">Manage Bookmarks</div>
      <q-space />
      <q-badge v-if="loading" color="primary" class="q-px-sm">
        Saving...
      </q-badge>
    </div>

    <q-banner v-if="error" class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <!-- Bookmarks List -->
    <q-list separator bordered class="rounded-borders q-mb-md">
      <q-item v-for="(path, name) in bookmarks" :key="name">
        <q-item-section>
          <q-item-label>{{ name }}</q-item-label>
          <q-item-label caption>{{ path }}</q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row items-center">
            <q-btn
                flat
                round
                dense
                color="negative"
                icon="delete"
                @click="removeBookmark(name)"
            />
          </div>
        </q-item-section>
      </q-item>

      <q-item v-if="Object.keys(bookmarks).length === 0">
        <q-item-section>
          <div class="text-center text-grey-7 q-py-sm">No bookmarks added yet</div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- New Bookmark Form -->
    <div v-if="showForm" class="q-pa-md q-mb-md bg-grey-2 rounded-borders dark-bg">
      <div class="text-subtitle2 q-mb-sm">Add New Bookmark</div>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input
              v-model="newBookmark.name"
              label="Name"
              dense
              outlined
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
              v-model="newBookmark.path"
              label="Path"
              dense
              outlined
              hint="Example: / or ~ or /media/usb"
          />
        </div>
      </div>

      <div class="row justify-end q-mt-md q-gutter-sm">
        <q-btn
            flat
            label="Cancel"
            color="grey-7"
            @click="showForm = false"
        />
        <q-btn
            label="Add"
            color="primary"
            @click="addBookmark"
        />
      </div>
    </div>

    <!-- Add Bookmark Button -->
    <div class="q-mt-md" v-if="!showForm">
      <q-btn
          outline
          color="primary"
          icon="add"
          label="Add Bookmark"
          @click="showForm = true"
      />
    </div>
  </div>
</template>

<style scoped>
.bookmarks-editor {
  width: 100%;
}

.q-item {
  transition: all 0.3s;
}

.q-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.dark .q-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dark-bg {
  background-color: rgba(0, 0, 0, 0.03);
}

.dark .dark-bg {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>