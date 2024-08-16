import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  server: {
    host: true, // expose to network
    https: {
      key: fs.readFileSync('certs/server.key'),
      cert: fs.readFileSync('certs/server.cert'),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      }

    }
  },
})