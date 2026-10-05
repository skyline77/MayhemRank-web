import { createApp } from 'vue'
import {locale} from './locale'
import App from './App.vue'
import './style.css'
document.documentElement.lang=locale.value
createApp(App).mount('#app')
