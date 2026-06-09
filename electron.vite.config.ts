import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': path.resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': path.resolve('src/shared') } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer'),
        '@shared': path.resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
