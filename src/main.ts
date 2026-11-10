import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { authService } from './services/auth.service'
import { flushOutbox, startOfflineSyncWatch } from './offline/sync'
import { apiConfig } from './config/api'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

await authService.restore()
app.use(router)
app.mount('#app')

if (apiConfig.useApi) {
  startOfflineSyncWatch()
  void flushOutbox()
}

registerSW({ immediate: true })
