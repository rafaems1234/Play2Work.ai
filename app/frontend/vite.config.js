import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy do site publicado. O GitHub Pages não deixa mandar
// cabeçalho, então ela vai como <meta> no index.html -- só no build (no `npm run
// dev` ela travaria o recarregamento automático do Vite).
//
// É o que mais protege o token do painel: mesmo que alguém consiga injetar
// texto na página, o navegador só roda script do próprio site (e do player do
// YouTube) e só conversa com a API configurada.
//   style 'unsafe-inline': os componentes usam <style> e style={...} (sem risco de script)
//   YouTube: script do player (iframe_api) e o iframe nocookie das aulas
//   connect: só o próprio site e a API (VITE_API_URL); no modo demonstração, nenhuma API
const politica = (apiUrl) => [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' data: blob:",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  `connect-src 'self'${apiUrl ? ` ${new URL(apiUrl).origin}` : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspNoBuild = (apiUrl) => ({
  name: 'csp-no-build',
  apply: 'build',
  transformIndexHtml: (html) => html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${politica(apiUrl)}" />\n    <meta name="referrer" content="no-referrer" />`,
  ),
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const demo = env.VITE_DEMO_MODE !== 'false'
  return {
    base: '/First2Work.ai/',
    plugins: [react(), cspNoBuild(demo ? '' : (env.VITE_API_URL || 'http://127.0.0.1:8000'))],
  }
})
