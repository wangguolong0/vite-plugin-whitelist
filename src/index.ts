import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

interface Options {
  allowlist?: string[]
  envFiles?: string[]
  envVar?: string
  allowLocalhost?: boolean
}

function normalizeIp(ip?: string | null): string {
  if (!ip) return ''
  const host = String(ip).split(',')[0].trim()
  const withoutPrefix = host.replace(/^::ffff:/, '')
  return withoutPrefix.replace(/^\[|\]$/g, '')
}

function loadIpsFromEnvFiles(files: string[], envVar = 'VITE_WEB_SERVER'): string[] {
  const ips: string[] = []
  for (const f of files) {
    const p = path.resolve(process.cwd(), f)
    if (!fs.existsSync(p)) continue
    try {
      const parsed = dotenv.parse(fs.readFileSync(p))
      if (parsed[envVar]) {
        const raw = parsed[envVar]
        const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean)
        for (const part of parts) {
          const host = part.split(':')[0]
          const n = normalizeIp(host)
          if (n) ips.push(n)
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  return ips
}

export default function allowlistPlugin(options: Options = {}): Plugin {
  const {
    allowlist = [],
    envFiles = ['.env', `.env.${process.env.NODE_ENV || 'development'}`],
    envVar = 'VITE_WEB_SERVER',
    allowLocalhost = true
  } = options

  const allowed = new Set<string>()
  for (const ip of allowlist || []) {
    if (ip) allowed.add(normalizeIp(ip))
  }
  const fromEnv = loadIpsFromEnvFiles(envFiles, envVar)
  for (const ip of fromEnv) allowed.add(ip)

  return {
    name: 'vite-plugin-allowlist',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage & { url?: string }, res: ServerResponse, next: (err?: any) => void) => {
        try {
          if (req.url && (req.url.startsWith('/__vite') || req.url.startsWith('/@fs') || req.url.startsWith('/__hmr'))) {
            return next()
          }

          const headers = (req as any).headers || {}
          const xff = headers['x-forwarded-for']
          const remote = (req as any).socket && (req as any).socket.remoteAddress
          const candidate = xff ? String(xff).split(',')[0].trim() : remote
          const ip = normalizeIp(candidate)

          if (allowLocalhost && (ip === '127.0.0.1' || ip === '::1')) {
            return next()
          }

          if (allowed.size === 0) {
            return next()
          }

          if (allowed.has(ip)) return next()

          res.statusCode = 403
          res.end('Forbidden')
        } catch (e) {
          next()
        }
      })
    }
  }
}
