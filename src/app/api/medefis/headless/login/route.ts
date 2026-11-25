import { NextResponse } from 'next/server'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import { getStoredCredentials, saveManualCookies, logActivity, setCredentialError } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

const MB = process.env.MEDEFIS_BROWSER_URL || 'http://localhost:3003'

/**
 * POST /api/medefis/headless/login
 * Body: { entryUrl?: string }  (falls back to the stored entry URL)
 *
 * Drives the headless browser to log into Medefis using the stored
 * credentials. On success, captures cookies + OIDC tokens and stores them
 * as the shared session. On MFA/captcha, returns needManual so the admin
 * can finish via the live view (screenshot/click/type).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const creds = await getStoredCredentials()
  if (!creds) {
    return NextResponse.json({ error: 'No Medefis credentials stored. Add them first.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({} as any))
  const entryUrl = (body.entryUrl as string) || creds.entryUrl
  if (!entryUrl) {
    return NextResponse.json({ error: 'No entry URL configured. Add your Medefis vendor portal link.' }, { status: 400 })
  }

  let mbRes: Response
  try {
    mbRes = await fetch(`${MB}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entryUrl, username: creds.username, password: creds.password }),
    })
  } catch {
    return NextResponse.json({ error: 'Headless browser service is not running.' }, { status: 502 })
  }

  const data = await mbRes.json().catch(() => ({ ok: false, error: 'Bad response from browser service.' }))

  if (data.ok && data.cookies && data.tokens) {
    // Store the captured session (cookies + OIDC tokens).
    const result = await saveManualCookies(data.cookies, data.appBaseUrl, JSON.stringify(data.tokens))
    const ip = await getClientIp()
    await logActivity({
      actor: user.username,
      role: 'admin',
      action: 'medefis.headless.login',
      detail: `Automated Medefis login succeeded for ${data.appBaseUrl}`,
      ip,
    })
    await setCredentialError(null)
    return NextResponse.json({ ok: true, appBaseUrl: data.appBaseUrl, pageUrl: data.pageUrl })
  }

  // needManual or error
  if (data.needManual) {
    const ip = await getClientIp()
    await logActivity({
      actor: user.username,
      role: 'admin',
      action: 'medefis.headlogin.manual',
      detail: `Automated login needs manual completion: ${data.reason}`,
      ip,
    })
    return NextResponse.json({ ok: false, needManual: true, reason: data.reason, url: data.url })
  }

  await setCredentialError(data.error || 'Automated login failed.')
  return NextResponse.json({ ok: false, error: data.error || 'Automated login failed.' })
}
