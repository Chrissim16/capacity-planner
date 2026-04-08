import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { randomBytes } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'

function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  const bytes = randomBytes(16)
  let password = ''
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length]
  }
  return password
}

function normalizeCreateUserError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('already registered')) return 'A user with this email already exists.'
  if (lower.includes('password')) return 'Supabase rejected the temporary password. Please try again.'
  return 'Failed to create the user. Please try again.'
}

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

/**
 * Vite dev-server middleware that mirrors the Vercel /api/admin function so
 * invite/remove flows work locally without falling through to index.html.
 */
const adminProxyPlugin: Plugin = {
  name: 'admin-proxy',
  configureServer(server) {
    server.middlewares.use('/api/admin', async (req: IncomingMessage, res: ServerResponse) => {
      const sendJson = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        })
        res.end()
        return
      }

      if (req.method !== 'POST') {
        return sendJson(405, { error: 'Method not allowed' })
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[admin-proxy] Missing Supabase configuration')
        return sendJson(500, { error: 'Server configuration error' })
      }

      const authorization = req.headers.authorization
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return sendJson(401, { error: 'Missing or invalid Authorization header' })
      }

      const rawBody = await new Promise<string>((resolve, reject) => {
        let body = ''
        req.on('data', (chunk) => {
          body += String(chunk)
        })
        req.on('end', () => resolve(body))
        req.on('error', reject)
      }).catch(() => '')

      let parsedBody: { action?: string; email?: string; role?: string; userId?: string } = {}
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {}
      } catch {
        return sendJson(400, { error: 'Invalid JSON body' })
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      try {
        const callerJwt = authorization.slice(7)
        const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(callerJwt)
        if (authError || !callerUser) {
          return sendJson(401, { error: 'Invalid or expired token' })
        }

        const { data: roleRow, error: roleError } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', callerUser.id)
          .maybeSingle()

        if (roleError) {
          console.error('[admin-proxy] Role lookup error:', roleError.message)
          return sendJson(500, { error: 'Failed to verify permissions' })
        }
        if (!roleRow || roleRow.role !== 'system_admin') {
          return sendJson(403, { error: 'Forbidden: system_admin role required' })
        }

        const { action, email, role, userId } = parsedBody

        if (action === 'invite') {
          if (!email || typeof email !== 'string') {
            return sendJson(400, { error: 'email is required' })
          }

          const validRoles = ['system_admin', 'project_manager', 'read_only']
          const assignedRole = validRoles.includes(role ?? '') ? role : 'project_manager'

          const temporaryPassword = generateTemporaryPassword()
          const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
          })
          if (createUserError || !createdUserData?.user?.id) {
            const message = createUserError?.message ?? 'Unknown createUser error'
            const msg = normalizeCreateUserError(message)
            console.error('[admin-proxy] Create user error:', createUserError)
            return sendJson(400, {
              error: msg,
              details: message,
              diagnostics: createUserError ? {
                name: createUserError.name ?? null,
                message: createUserError.message ?? null,
                status: (createUserError as { status?: number }).status ?? null,
                code: (createUserError as { code?: string }).code ?? null,
                error_code: (createUserError as { error_code?: string }).error_code ?? null,
              } : null,
            })
          }

          const createdUserId = createdUserData.user.id
          const { error: upsertError } = await adminClient
            .from('user_roles')
            .upsert({ user_id: createdUserId, role: assignedRole }, { onConflict: 'user_id' })
          if (upsertError) {
            console.error('[admin-proxy] Failed to pre-assign role:', upsertError.message)
            await adminClient.auth.admin.deleteUser(createdUserId)
            return sendJson(500, {
              error: 'Failed to assign the user role.',
              details: upsertError.message,
            })
          }

          return sendJson(200, { success: true, temporaryPassword, userId: createdUserId })
        }

        if (action === 'remove') {
          if (!userId || typeof userId !== 'string') {
            return sendJson(400, { error: 'userId is required' })
          }
          if (userId === callerUser.id) {
            return sendJson(400, { error: 'You cannot remove your own account.' })
          }

          const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
          if (deleteError) {
            console.error('[admin-proxy] Delete user error:', deleteError.message)
            return sendJson(500, { error: 'Failed to remove user. Please try again.' })
          }

          return sendJson(200, { success: true })
        }

        return sendJson(400, { error: `Unknown action: ${String(action)}` })
      } catch (err) {
        console.error('[admin-proxy] Unexpected error:', err)
        return sendJson(500, { error: 'An unexpected error occurred.' })
      }
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), jiraProxyPlugin, adminProxyPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
