import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { authService } from './services/auth.service'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

await authService.restore()
app.use(router)
app.mount('#app')
