import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import {
  getSessionStatus,
  saveManualCookies,
  markSessionInvalid,
  logActivity,
} from '@/lib/medefis'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET /api/medefis/session -> session status (admin sees full; employee sees boolean) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const status = await getSessionStatus()
  // Employees only see whether the session is usable, not the app URL details.
  if (user.role === 'employee') {
    return NextResponse.json({ hasSession: status.hasSession, valid: status.valid })
  }
  return NextResponse.json({ status })
}

/**
 * POST /api/medefis/session -> manual cookie paste (admin only)
 * Body: { cookies: string, appBaseUrl: string, tokens?: string }
 * `tokens` is the JSON blob from `copy(JSON.stringify({localStorage:{...localStorage}, sessionStorage:{...sessionStorage}}))`
 * and is required for OIDC-based SPAs (like Medefis) that store the
 * access_token in sessionStorage rather than in cookies.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { cookies, appBaseUrl, tokens } = await req.json().catch(() => ({} as any))
  if (!appBaseUrl) {
    return NextResponse.json({ error: 'appBaseUrl is required.' }, { status: 400 })
  }
  if (!cookies && !tokens) {
    return NextResponse.json({ error: 'Provide a cookie header and/or a tokens blob.' }, { status: 400 })
  }

  const result = await saveManualCookies(cookies ?? '', appBaseUrl, tokens)
  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'medefis.session.paste',
    detail: result.success
      ? `Pasted Medefis session for ${result.appBaseUrl}${tokens ? ' (with OIDC tokens)' : ''}`
      : `Manual session paste failed: ${result.error}`,
    ip,
  })

  const status = await getSessionStatus()
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error, status })
  }
  return NextResponse.json({ ok: true, appBaseUrl: result.appBaseUrl, status })
}

/** DELETE /api/medefis/session -> invalidate the captured Medefis session */
export async function DELETE() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  await db.medefisSession.deleteMany()
  await markSessionInvalid()
  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'medefis.session.clear',
    detail: 'Cleared captured Medefis session',
    ip,
  })
  return NextResponse.json({ ok: true })
}
