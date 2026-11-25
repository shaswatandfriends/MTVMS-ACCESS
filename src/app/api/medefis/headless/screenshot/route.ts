import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MB = process.env.MEDEFIS_BROWSER_URL || 'http://localhost:3003'

/** GET /api/medefis/headless/screenshot -> PNG of the headless browser page (admin only) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const res = await fetch(`${MB}/screenshot`, { cache: 'no-store' })
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'No page available.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }
    const buf = await res.arrayBuffer()
    return new Response(buf, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Browser service not running.' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
