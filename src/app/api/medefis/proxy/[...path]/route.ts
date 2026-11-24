import { getCurrentUser } from '@/lib/auth'
import { proxyRequest, getStoredAppBaseUrl, markSessionInvalid } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/**
 * Catch-all reverse proxy: /api/medefis/proxy/<host>/<path...>
 *
 * Any authenticated user (admin or employee) can use the proxy. The
 * upstream Medefis session cookies are injected server-side, so employees
 * never see Medefis credentials. URLs in the response are rewritten so the
 * whole Medefis application appears to live inside our origin.
 */

async function handle(req: Request, params: { path: string[] }) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const parts = params.path || []
  if (!parts.length) {
    return new Response(JSON.stringify({ error: 'Host required in proxy path.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const host = parts[0]
  const pathWithSearch = '/' + parts.slice(1).join('/') + extractSearch(req.url)

  // If the session is gone, mark invalid and let the employee see a notice.
  const appBaseUrl = await getStoredAppBaseUrl()
  if (!appBaseUrl) {
    await markSessionInvalid()
    return new Response(
      JSON.stringify({ error: 'No active Medefis session. An administrator must sign in to Medefis first.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? Buffer.from(await req.arrayBuffer())
      : null

  try {
    const result = await proxyRequest(host, pathWithSearch, req.method, req.headers, body)
    const headers = new Headers()
    for (const [k, v] of Object.entries(result.headers)) {
      headers.set(k, v)
    }
    return new Response(result.body as unknown as BodyInit, {
      status: result.status,
      headers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: 'Proxy error: ' + msg }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }
}

function extractSearch(url: string): string {
  try {
    const u = new URL(url)
    return u.search
  } catch {
    return ''
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
export async function OPTIONS(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, await ctx.params)
}
