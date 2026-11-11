import { cpSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

function pontoPage(): Plugin {
  const file = resolve('ponto/index.html')
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path === '/ponto' || path === '/ponto/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(readFileSync(file))
      return
    }
    next()
  }
  return {
    name: 'ponto-page',
    configureServer(server) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
    closeBundle() {
      const out = resolve('dist/ponto')
      mkdirSync(out, { recursive: true })
      cpSync(file, resolve(out, 'index.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pontoPage()],
  base: process.env.VITE_BASE || '/',
})
