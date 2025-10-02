import 'regenerator-runtime/runtime';

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { useTransactionService } from './composables/useTransactionService'
import { initializeGlobalTransactionTracking } from './setupGlobalTransactionTracking'
import filters from './plugins/filters';

import './assets/css/tailwind.css';
import './assets/css/steemauth.css';

const app = createApp(App)
const pinia = createPinia()
app.use(router)
app.use(pinia)
app.use(filters)

const txService = useTransactionService()
txService.ensureInitialized()

initializeGlobalTransactionTracking()

app.mount('#app')