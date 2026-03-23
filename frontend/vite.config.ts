import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const ALLOWED_JIRA_HOSTS = ['atlassian.net']

function isAllowedJiraUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_JIRA_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

/**
 * Vite dev-server middleware that proxies /api/jira to the real Jira Cloud API.
 * This mirrors the Vercel serverless function in api/jira.js, avoiding CORS
 * issues when running `npm run dev` locally.
 */
const jiraProxyPlugin: Plugin = {
  name: 'jira-proxy',
  configureServer(server) {
    server.middlewares.use('/api/jira', async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jira-Base-Url',
        })
        res.end()
        return
      }

      const rawUrl = req.url ?? '/'
      const url = new URL(rawUrl, 'http://localhost')
      const jiraPath = url.searchParams.get('path')
      const jiraBaseUrl = req.headers['x-jira-base-url'] as string | undefined
      const authorization = req.headers['authorization'] as string | undefined

      const sendError = (status: number, message: string) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: message }))
      }

      if (!jiraBaseUrl || !isAllowedJiraUrl(jiraBaseUrl)) {
        return sendError(400, 'Invalid or missing Jira base URL')
      }
      if (!jiraPath) return sendError(400, 'Missing path query parameter')
      if (!authorization) return sendError(401, 'Missing Authorization header')

      const cleanBaseUrl = jiraBaseUrl.replace(/\/+$/, '')
      const cleanPath = jiraPath.startsWith('/') ? jiraPath : `/${jiraPath}`
      const fullUrl = `${cleanBaseUrl}${cleanPath}`

      try {
        const jiraResponse = await fetch(fullUrl, {
          method: req.method ?? 'GET',
          headers: {
            Authorization: authorization,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        })

        const contentType = jiraResponse.headers.get('content-type') ?? ''
        const body = contentType.includes('application/json')
          ? JSON.stringify(await jiraResponse.json())
          : await jiraResponse.text()

        res.writeHead(jiraResponse.status, { 'Content-Type': 'application/json' })
        res.end(body)
      } catch (err) {
        console.error('[jira-proxy]', err)
        sendError(500, err instanceof Error ? err.message : 'Proxy error')
      }
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), jiraProxyPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
