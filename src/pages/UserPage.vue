<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useRouter } from 'vue-router';
import UserProfileCard from '@/components/user/UserProfileCard.vue';
import PasswordChangeDialog from '@/components/user/PasswordChangeDialog.vue';

// Initialize the stores and router
const userStore = useUserStore();
const notificationStore = useNotificationStore();
const router = useRouter();

// UI state
const showChangePasswordDialog = ref(false);

// Methods
const editProfile = () => {
  notificationStore.info('Edit profile functionality to be implemented');
};

// Check authentication on mount
onMounted(async () => {
  let isAuthenticated = false; // Initialize the variable

  try {
    isAuthenticated = await userStore.refreshUserFromToken();
  } catch (error) {
    console.error('Authentication check failed:', error);
    isAuthenticated = false;
  }

  if (!isAuthenticated) {
    await router.push('/login');
    return;
  }

  if (userStore.passwordUpdateRequired) {
    setTimeout(() => {
      showChangePasswordDialog.value = true;
    }, 500);
  } else {
    try {
      const requiresUpdate = await userStore.checkPasswordUpdateRequired(userStore.username);
      if (requiresUpdate) {
        setTimeout(() => {
          showChangePasswordDialog.value = true;
        }, 500);
      }
    } catch (error) {
      console.error('Error checking password update requirement:', error);
    }
  }
});
</script>

<template>
  <q-page padding>
    <div class="q-pa-md">
      <!-- Password Change Alert -->
      <q-banner v-if="userStore.passwordUpdateRequired" class="bg-warning text-white q-mb-lg">
        <template v-slot:avatar>
          <q-icon name="warning" />
        </template>
        <div class="text-body1">
          You are using the default admin password. For security reasons, please change your password immediately.
        </div>
        <template v-slot:action>
          <q-btn flat label="Change Password" color="white" @click="showChangePasswordDialog = true" />
        </template>
      </q-banner>

      <div class="row q-col-gutter-lg">
        <!-- User Profile Card -->
        <div class="col-12 col-md-4">
          <UserProfileCard
              @change-password="showChangePasswordDialog = true"
              @edit-profile="editProfile"
          />
        </div>
      </div>
    </div>

    <!-- Change Password Dialog -->
    <PasswordChangeDialog
        v-model="showChangePasswordDialog"
        :forced="userStore.passwordUpdateRequired"
    />
  </q-page>
</template>