import { NextResponse } from 'next/server'
import { getCurrentUser, changeOwnPassword, getClientIp } from '@/lib/auth'
import { logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/** POST /api/auth/password -> change the current user's own password */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const { currentPassword, newPassword } = await req.json().catch(() => ({} as any))
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required.' }, { status: 400 })
  }
  try {
    const ok = await changeOwnPassword(user, currentPassword, newPassword)
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 })
    }
    const ip = await getClientIp()
    await logActivity({
      actor: user.username,
      role: user.role,
      action: 'password.change',
      detail: `${user.role} changed own password`,
      ip,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Password change failed.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
