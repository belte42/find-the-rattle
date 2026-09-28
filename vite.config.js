import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

/**
 * Where the production site lives. Change this one line to move domains,
 * e.g. to 'https://findtherattle.com/' once the custom domain is set up.
 */
const SITE_URL = 'https://belte42.github.io/rattle-finder/'

const DESCRIPTION =
  'Find rattles and buzzes in your car. Free test tones that sweep through your car speakers so you can make a rattle happen on demand and track it down.'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? new URL(SITE_URL).pathname : '/',
  plugins: [
    tailwindcss(),
    svelte(),
    {
      // Fill %SITE_URL% / %DESCRIPTION% placeholders in index.html
      name: 'html-site-meta',
      transformIndexHtml: (html) =>
        html
          .replaceAll('%SITE_URL%', SITE_URL)
          .replaceAll('%DESCRIPTION%', DESCRIPTION),
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Find The Rattle',
        short_name: 'Find Rattle',
        description: DESCRIPTION,
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Only needed by link-preview crawlers, not offline use
        globIgnores: ['**/og-image.png'],
      },
    }),
  ],
}))
