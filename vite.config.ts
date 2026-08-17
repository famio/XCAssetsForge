import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Cross-origin isolation unlocks SharedArrayBuffer, which is what lets the
 * OxiPNG wasm build use every core instead of one. Safe here because the app
 * loads no cross-origin resources at all.
 *
 * Applied as a front-most middleware rather than via `server.headers`, because
 * that option does not reach 304 responses — and a worker script served as 304
 * without these headers is refused with ERR_BLOCKED_BY_RESPONSE.
 */
function crossOriginIsolation(): Plugin {
  const headers: Plugin['configureServer'] = (server) => {
    server.middlewares.use((_request, response, next) => {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  }
  return {
    name: 'cross-origin-isolation',
    configureServer: headers,
    configurePreviewServer: headers as Plugin['configurePreviewServer'],
  }
}

export default defineConfig({
  plugins: [react(), crossOriginIsolation()],
  // jSquash ships wasm alongside its ESM entry points; pre-bundling mangles the
  // wasm URLs, so these have to reach the browser untouched.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/resize', '@jsquash/oxipng'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
})
