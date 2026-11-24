import { NextResponse } from 'next/server'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import { performMedefisLogin, logActivity, getSessionStatus } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/**
 * POST /api/medefis/login
 * Body: { signin?: string }
 * Performs a server-side Medefis login using stored credentials and
 * captures the session cookies. Returns the resulting session status.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { signin } = await req.json().catch(() => ({} as any))
  const result = await performMedefisLogin(typeof signin === 'string' ? signin : undefined)

  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'medefis.login',
    detail: result.success
      ? `Medefis login succeeded; app=${result.appBaseUrl}`
      : `Medefis login failed: ${result.error}`,
    ip,
  })

  const status = await getSessionStatus()
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error, status }, { status: 200 })
  }
  return NextResponse.json({ ok: true, appBaseUrl: result.appBaseUrl, status })
}
