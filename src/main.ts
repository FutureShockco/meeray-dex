import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

import './assets/css/steemauth.css';

import filters from './plugins/filters';

const app = createApp(App)
const pinia = createPinia()
app.use(router)
app.use(pinia)
app.use(filters)
app.mount('#app')