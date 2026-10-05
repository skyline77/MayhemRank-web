import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const backend='http://127.0.0.1:18767'
export default defineConfig({plugins:[vue()],server:{host:'127.0.0.1',proxy:{'/api':backend,'/snapshots':backend,'/snapshot-assets':backend,'/assets':backend}}})
