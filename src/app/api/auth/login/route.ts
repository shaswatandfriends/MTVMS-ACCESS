import { NextResponse } from 'next/server'
import { adminLogin, employeeLogin, setSessionCookie, getCurrentUser, getClientIp } from '@/lib/auth'
import { logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login
 * Body: { role: "admin"|"employee", username, password }
 */
export async function POST(req: Request) {
  const { role, username, password } = await req.json().catch(() => ({} as any))
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }

  let token: string | null = null
  if (role === 'admin') {
    const t = await adminLogin(username, password)
    if (!t) {
      return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 })
    }
    token = t
  } else {
    const result = await employeeLogin(username, password)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    token = result.token
  }

  await setSessionCookie(token)
  const ip = await getClientIp()
  await logActivity({
    actor: username,
    role: (role as 'admin' | 'employee') ?? 'employee',
    action: 'login',
    detail: `${role} signed in`,
    ip,
  })

  const user = await getCurrentUser()
  return NextResponse.json({ ok: true, role, user })
}
