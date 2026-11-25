import { NextResponse } from 'next/server'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import { saveManualCookies, logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'
const MB = process.env.MEDEFIS_BROWSER_URL || 'http://localhost:3003'

/**
 * GET /api/medefis/headless/extract
 * Pulls cookies + OIDC tokens from the headless browser's current page
 * (after the admin has manually completed MFA) and stores them as the
 * shared session.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  try {
    const res = await fetch(`${MB}/extract`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({ ok: false, error: 'Bad response.' }))
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.error || 'Extraction failed.' }, { status: 400 })
    }
    const result = await saveManualCookies(data.cookies, data.appBaseUrl, JSON.stringify(data.tokens))
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error })
    }
    const ip = await getClientIp()
    await logActivity({
      actor: user.username,
      role: 'admin',
      action: 'medefis.headless.extract',
      detail: `Extracted Medefis session after manual login for ${data.appBaseUrl}`,
      ip,
    })
    return NextResponse.json({ ok: true, appBaseUrl: data.appBaseUrl, pageUrl: data.pageUrl })
  } catch {
    return NextResponse.json({ error: 'Browser service not running.' }, { status: 502 })
  }
}
