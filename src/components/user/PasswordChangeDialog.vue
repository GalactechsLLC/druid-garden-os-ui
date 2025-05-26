<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue';
import { useUserStore } from '@/stores/userStore';
import {useNotificationStore} from "@/stores/notificationStore.ts";

interface PasswordFormRef {
  validate: () => Promise<boolean>;
  reset: () => void;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  forced: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const userStore = useUserStore();
const notificationStore = useNotificationStore();
const showDialog = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
  showDialog.value = newVal;
});

watch(showDialog, (newVal) => {
  emit('update:modelValue', newVal);
});

const passwordVisibility = ref({
  current: false,
  new: false,
  confirm: false
});

const passwordForm = ref<PasswordFormRef | null>(null);
const passwordData = ref<PasswordData>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const changePassword = async () => {
  // Validate form
  if (passwordForm.value) {
    const isValid = await passwordForm.value.validate();
    if (!isValid) return;
  }
  userStore.loading = true;

  try {
    const success = await userStore.updatePassword(
        passwordData.value.currentPassword,
        passwordData.value.newPassword
    );

    if (success) {
      notificationStore.notify('positive', 'Password updated successfully',{});

      passwordData.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };

      if (!props.forced) {
        showDialog.value = false;
      }
    }
  } catch (error) {
    console.error('Password change error:', error);
    notificationStore.notify('negative', 'Failed to update password',{});
  } finally {
    userStore.loading = false;
  }
};
</script>

<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center">
        <div class="text-h6">Change Password</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup
               :disable="forced" />
      </q-card-section>

      <q-card-section>
        <q-form @submit="changePassword" ref="passwordForm">
          <q-input
              v-model="passwordData.currentPassword"
              label="Current Password"
              :type="passwordVisibility.current ? 'text' : 'password'"
              :rules="[val => !!val || 'Current password is required']"
          >
            <template v-slot:append>
              <q-icon
                  :name="passwordVisibility.current ? 'visibility' : 'visibility_off'"
                  class="cursor-pointer"
                  @click="passwordVisibility.current = !passwordVisibility.current"
              />
            </template>
          </q-input>

          <q-input
              v-model="passwordData.newPassword"
              label="New Password"
              :type="passwordVisibility.new ? 'text' : 'password'"
              :rules="[
                val => !!val || 'New password is required',
                val => val.length >= 8 || 'Password must be at least 8 characters',
                val => val !== passwordData.currentPassword || 'New password must be different'
              ]"
          >
            <template v-slot:append>
              <q-icon
                  :name="passwordVisibility.new ? 'visibility' : 'visibility_off'"
                  class="cursor-pointer"
                  @click="passwordVisibility.new = !passwordVisibility.new"
              />
            </template>
          </q-input>

          <q-input
              v-model="passwordData.confirmPassword"
              label="Confirm New Password"
              :type="passwordVisibility.confirm ? 'text' : 'password'"
              :rules="[
                val => !!val || 'Please confirm your password',
                val => val === passwordData.newPassword || 'Passwords do not match'
              ]"
          >
            <template v-slot:append>
              <q-icon
                  :name="passwordVisibility.confirm ? 'visibility' : 'visibility_off'"
                  class="cursor-pointer"
                  @click="passwordVisibility.confirm = !passwordVisibility.confirm"
              />
            </template>
          </q-input>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup
               :disable="forced" />
        <q-btn
            label="Change Password"
            color="primary"
            @click="changePassword"
            :loading="userStore.loading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>