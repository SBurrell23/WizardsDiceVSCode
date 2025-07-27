import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '',
  server: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Prevent caching of JSON files by adding hash to filename
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.json')) {
            return 'assets/[name].[hash][extname]'
          }
          return 'assets/[name].[hash][extname]'
        }
      }
    }
  }
})
