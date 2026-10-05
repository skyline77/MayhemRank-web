import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const backend = 'http://127.0.0.1:18767'
export default defineConfig({
  plugins: [vue()],
  // @/ 指向 src，跨目录引用不必写多层 ../
  resolve: { alias: { '@': '/src' } },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': backend,
      '/snapshots': backend,
      '/snapshot-assets': backend,
      '/assets': backend,
    },
  },
})
