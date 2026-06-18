import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/ventas': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/v1/despachos': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    }
  }
})
