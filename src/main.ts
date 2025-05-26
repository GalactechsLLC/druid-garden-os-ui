import './assets/styles/main.css'

import {createApp, defineAsyncComponent, h} from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import router from '@/router'
import VueApexCharts from 'vue3-apexcharts'

import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import {initializeAuth, setupAuthMonitoring} from "@/utils/auth.ts";

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Quasar, {
    plugins: {},
})

// eslint-disable-next-line vue/multi-word-component-names
app.component('apexchart', VueApexCharts)

initializeAuth();
setupAuthMonitoring();

app.mount('#app')

