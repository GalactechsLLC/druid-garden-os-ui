<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { get } from '@/utils/api';
import { type UserDetails } from '@/types/user';

const userStore = useUserStore();
const emit = defineEmits(['changePassword']);
const loading = ref(false);
const userDetails = ref<UserDetails | null>(null);

const displayName = computed(() => {
  return userDetails.value?.name || userDetails.value?.fullName || userStore.username || 'User';
});

const displayRole = computed(() => {
  return userStore.userRole.charAt(0).toUpperCase() + userStore.userRole.slice(1);
});

const lastLoginTime = computed(() => {
  if (userDetails.value?.lastLogin) {
    return new Date(userDetails.value.lastLogin).toLocaleString();
  }
  return 'Unknown';
});

// Fetch additional user details when component is mounted
onMounted(async () => {
  if (!userStore.isAuthenticated) {
    return;
  }

  loading.value = true;
  try {
    if (userStore.userId) {
      const response = await get(`users/${userStore.userId}`, {
        silent: true,
        retry: 1,
        errorMessage: 'Failed to load user profile details'
      });

      if (response && !response.error) {
        userDetails.value = response;
      }
    }
  } catch (error) {
    console.error('Failed to fetch user details:', error);
  } finally {
    loading.value = false;
  }
});

const handleChangePassword = () => {
  emit('changePassword');
};
</script>

<template>
  <q-card class="profile-card">
    <q-card-section class="bg-primary text-center">
      <q-avatar size="100px" class="q-mb-sm">
        <q-icon v-if="loading" name="sync" size="80px" class="text-white animate-spin" />
        <q-icon v-else name="person" size="80px" class="text-white" />
      </q-avatar>
      <div class="text-h5 q-mt-sm">{{ displayName }}</div>
      <div class="text-subtitle2">{{ displayRole }}</div>
    </q-card-section>

    <q-card-section>
      <q-list>
        <q-item>
          <q-item-section avatar>
            <q-icon name="email" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ userStore.username }}</q-item-label>
            <q-item-label caption>Email/Username</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section avatar>
            <q-icon name="perm_identity" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ userStore.userId }}</q-item-label>
            <q-item-label caption>User ID</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section avatar>
            <q-icon name="manage_accounts" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ userStore.userRole }}</q-item-label>
            <q-item-label caption>Role</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section avatar>
            <q-icon name="access_time" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ lastLoginTime }}</q-item-label>
            <q-item-label caption>Last Login</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-card-actions align="center">
      <q-btn flat color="primary" label="Change Password" @click="handleChangePassword" />
    </q-card-actions>
  </q-card>
</template>

<style scoped>
.profile-card {
  border-radius: 10px;
  overflow: hidden;
}

.profile-card .q-avatar {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>