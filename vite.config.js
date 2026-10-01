import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import QRCode from 'qrcode'
import { fileURLToPath } from 'node:url'

/**
 * Where the production site lives (GitHub Pages custom domain, DNS at Hostinger).
 * Change this one line to move domains; the base path, canonical URL,
 * link previews and QR code all follow it.
 */
const SITE_URL = 'https://findtherattle.com/'

/** Static article pages, each a folder with an index.html (built as extra entries) */
const GUIDES = ['how-to-find-a-rattle-in-your-car']

const DESCRIPTION =
  'Find rattles and buzzes in your car. Free test tones that sweep through your car speakers so you can make a rattle happen on demand and track it down.'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? new URL(SITE_URL).pathname : '/',
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ['main', fileURLToPath(new URL('./index.html', import.meta.url))],
        ...GUIDES.map((g) => [
          g,
          fileURLToPath(new URL(`./${g}/index.html`, import.meta.url)),
        ]),
      ]),
    },
  },
  plugins: [
    tailwindcss(),
    svelte(),
    {
      // Fill %SITE_URL% / %DESCRIPTION% placeholders in the HTML pages
      name: 'html-site-meta',
      transformIndexHtml: (html) =>
        html
          .replaceAll('%SITE_URL%', SITE_URL)
          .replaceAll('%DESCRIPTION%', DESCRIPTION),
    },
    {
      // robots.txt and a sitemap of the app and guide pages, all under SITE_URL
      name: 'robots-sitemap',
      generateBundle() {
        const lastmod = new Date().toISOString().slice(0, 10)
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`,
        })
        const urls = ['', ...GUIDES.map((g) => `${g}/`)].map(
          (path) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
`
        )
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}</urlset>
`,
        })
      },
    },
    {
      // `import qrSvg from 'virtual:site-qr'`: QR code of SITE_URL as an SVG string
      name: 'site-qr',
      resolveId: (id) =>
        id === 'virtual:site-qr' ? '\0virtual:site-qr' : null,
      async load(id) {
        if (id !== '\0virtual:site-qr') return null
        const svg = await QRCode.toString(SITE_URL, {
          type: 'svg',
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        })
        return `export default ${JSON.stringify(svg)}`
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Find The Rattle',
        short_name: 'Find Rattle',
        description: DESCRIPTION,
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        categories: ['utilities', 'productivity'],
        // The artwork sits inside the maskable safe zone, so every size works for both
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Only needed by link-preview crawlers, not offline use
        globIgnores: ['**/og-image.png'],
        // The app is one page; never answer guide URLs with the app shell
        navigateFallbackDenylist: GUIDES.map((g) => new RegExp(`^/${g}`)),
      },
    }),
  ],
}))
