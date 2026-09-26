import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Cores do manifest: manter em sincronia com src/styles/tokens.css
// (--cor-tema e --cor-papel).
const COR_TEMA = '#221e1a'
const COR_FUNDO = '#f4efe6'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registrado em src/pwa.ts
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'RA Funcional',
        short_name: 'RA Funcional',
        description: 'Check-in das aulas de treinamento funcional.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: COR_TEMA,
        background_color: COR_FUNDO,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só o "app shell" (HTML/JS/CSS/fontes/ícones) é pré-cacheado.
        // NÃO há runtimeCaching: respostas da API do Supabase nunca são cacheadas.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5173 },
})
