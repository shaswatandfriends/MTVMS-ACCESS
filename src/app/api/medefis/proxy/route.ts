import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getStoredAppBaseUrl } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/**
 * GET /api/medefis/proxy  (no path)
 * Entry point for the employee iframe. Redirects to the host-qualified
 * proxy URL for the captured Medefis app base.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const appBaseUrl = await getStoredAppBaseUrl()
  if (!appBaseUrl) {
    return NextResponse.json(
      { error: 'No active Medefis session. Ask an administrator to sign in to Medefis.' },
      { status: 503 },
    )
  }
  let host = ''
  let path = '/'
  try {
    const u = new URL(appBaseUrl)
    host = u.hostname
    path = u.pathname + u.search
  } catch {
    return NextResponse.json({ error: 'Invalid Medefis app URL.' }, { status: 500 })
  }
  // NextResponse.redirect requires an absolute URL. Build it from the
  // incoming request origin so it works behind the gateway too.
  const origin = new URL(req.url).origin
  const target = `${origin}/api/medefis/proxy/${host}${path === '/' ? '' : path}`
  return NextResponse.redirect(target, { status: 302 })
}
