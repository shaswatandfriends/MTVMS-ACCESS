import { NextResponse } from 'next/server'
import { getCurrentUser, logoutCurrent, getClientIp } from '@/lib/auth'
import { logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getCurrentUser()
  if (user) {
    const ip = await getClientIp()
    await logActivity({
      actor: user.username,
      role: user.role,
      action: 'logout',
      detail: `${user.role} signed out`,
      ip,
    })
  }
  await logoutCurrent()
  return NextResponse.json({ ok: true })
}
