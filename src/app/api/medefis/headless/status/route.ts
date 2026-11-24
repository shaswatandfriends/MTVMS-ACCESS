import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MB = 'http://localhost:3003'

/** GET /api/medefis/headless/status -> browser state (admin only) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  try {
    const res = await fetch(`${MB}/status`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false, error: 'Headless browser service is not running.' }, { status: 502 })
  }
}
