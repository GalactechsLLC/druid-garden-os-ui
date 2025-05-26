<template>
  <q-page class="flex flex-center">
    <q-card class="login-card">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">Login</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="login" class="q-gutter-md">
          <q-input
              v-model="loginForm.username"
              label="Username"
              :rules="[val => !!val || 'Username is required']"
          />

          <q-input
              v-model="loginForm.password"
              label="Password"
              type="password"
              :rules="[val => !!val || 'Password is required']"
          />

          <div class="q-mt-md">
            <q-btn
                type="submit"
                color="primary"
                label="Login"
                class="full-width"
                :loading="loading"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>

  <Notification />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUserStore } from '@/stores/userStore';
import { useRouter } from 'vue-router';
import Notification from "@/components/Notification.vue";


interface LoginForm {
  username: string;
  password: string;
}

const userStore = useUserStore();
const router = useRouter();

const loading = computed(() => userStore.loading);

const loginForm = ref<LoginForm>({
  username: '',
  password: ''
});

const login = async () => {
  try {
    const success = await userStore.login(loginForm.value.username, loginForm.value.password);

    if (success) {
      await router.push('/');
    }
  } catch (error) {
    console.error('Login error:', error);
  }
};
</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
}
</style>