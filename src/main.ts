import { createApp } from 'vue'
import { locale } from './i18n/locale'
import App from './App.vue'
import './style.css'
document.documentElement.lang = locale.value
createApp(App).mount('#app')
