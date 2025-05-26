<script setup lang="ts">
import {ref, onBeforeMount, computed, onMounted, onBeforeUnmount} from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Header from "@/components/layout/Header.vue"
import { useUserStore } from '@/stores/userStore'
import {checkAuth} from "@/utils/auth.ts";

const tab = ref('home')
const userStore = useUserStore()
const route = useRoute()

onBeforeMount(() => {
  userStore.refreshUserFromToken()
})

onMounted(() => {
  if (!userStore.isAuthenticated) {
    userStore.refreshUserFromToken()
  }

  const tokenCheckInterval = setInterval(() => {
    if (userStore.isAuthenticated && !checkAuth()) {
      userStore.logout()
    }
  }, 60000)

  onBeforeUnmount(() => {
    clearInterval(tokenCheckInterval)
  })
})
// Check if current route is login page
const isLoginPage = computed(() => {
  return route.path === '/login' || route.path === '/account/password'
})
</script>

<template>
  <q-layout view="hHh lpR fFf" class="">
    <Header v-if="userStore.isAuthenticated"></Header>

    <q-page-container>
      <RouterView />
    </q-page-container>
  </q-layout>
</template>

<style scoped>

</style>