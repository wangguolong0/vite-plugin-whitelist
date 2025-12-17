import { defineConfig } from 'vite'
import allowlist from './src/index.ts'

export default defineConfig({
  plugins: [
    allowlist({
      // 直接指定允许的IP
      allowlist: ['172.24.108.76'],
      // 或者从根目录的 .env / .env.development 中读取 VITE_WEB_SERVER
      envFiles: ['.env', '.env.development'],
      envVar: 'VITE_WEB_SERVER',
      allowLocalhost: true
    })
  ]
})
