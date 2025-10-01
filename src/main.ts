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

// Initialize transaction service (WebSocket/Kafka) once at app startup so we try to connect immediately
const txService = useTransactionService()
txService.ensureInitialized()

// Initialize global transaction tracking hook
// This will automatically track ALL transactions sent via TransactionService
console.log('🚀 [main.ts] Calling initializeGlobalTransactionTracking...')
initializeGlobalTransactionTracking()
console.log('✅ [main.ts] initializeGlobalTransactionTracking completed')

// Expose to window for debugging in non-production environments
try {
	// Only attach in dev-like environments to avoid leaking internals in production
	const env = import.meta.env?.MODE || process.env.NODE_ENV || 'development'
	if (typeof window !== 'undefined' && env !== 'production') {
		// Provide a minimal safe wrapper
		;(window as any).__TX_SERVICE = {
			getKafkaEventLog: txService.getKafkaEventLog,
			clearKafkaEventLog: txService.clearKafkaEventLog,
			isConnected: txService.isConnected,
		}
	}
} catch (e) {
	// ignore failures attaching to window
}
app.mount('#app')