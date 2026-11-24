import { NextResponse } from 'next/server'
import { needsSetup, createFirstAdmin, setSessionCookie, getCurrentUser, getClientIp } from '@/lib/auth'
import { logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/** GET /api/auth/setup -> { needsSetup } */
export async function GET() {
  return NextResponse.json({ needsSetup: await needsSetup() })
}

/** POST /api/auth/setup -> create the first admin (only valid when needsSetup) */
export async function POST(req: Request) {
  if (!(await needsSetup())) {
    return NextResponse.json({ error: 'Setup already complete.' }, { status: 409 })
  }
  const { username, password, displayName } = await req.json().catch(() => ({} as any))
  try {
    const token = await createFirstAdmin(username, password, displayName)
    await setSessionCookie(token)
    const user = await getCurrentUser()
    const ip = await getClientIp()
    await logActivity({
      actor: username,
      role: 'admin',
      action: 'admin.create',
      detail: `Initial admin account created (${displayName || 'System Administrator'})`,
      ip,
    })
    return NextResponse.json({ ok: true, user })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Setup failed.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
