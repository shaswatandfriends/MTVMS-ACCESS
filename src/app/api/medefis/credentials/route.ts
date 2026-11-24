import { NextResponse } from 'next/server'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import {
  saveCredentials,
  clearCredentials,
  getStoredCredentials,
  getSessionStatus,
  logActivity,
} from '@/lib/medefis'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET /api/medefis/credentials -> whether credentials are stored (never returns the password) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const creds = await getStoredCredentials()
  const status = await getSessionStatus()
  return NextResponse.json({
    stored: !!creds,
    username: creds?.username ?? null,
    status,
  })
}

/** POST /api/medefis/credentials -> save (or replace) Medefis credentials */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { username, password } = await req.json().catch(() => ({} as any))
  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required.' }, { status: 400 })
  }

  await saveCredentials(username, password)
  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'medefis.credentials.save',
    detail: `Stored Medefis credentials for ${username}`,
    ip,
  })
  return NextResponse.json({ ok: true, username })
}

/** DELETE /api/medefis/credentials -> remove stored credentials */
export async function DELETE() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  await clearCredentials()
  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'medefis.credentials.clear',
    detail: 'Cleared stored Medefis credentials',
    ip,
  })
  return NextResponse.json({ ok: true })
}
