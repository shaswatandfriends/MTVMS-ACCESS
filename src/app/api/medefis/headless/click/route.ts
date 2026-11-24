import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
const MB = 'http://localhost:3003'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/** POST /api/medefis/headless/click { x, y } -> forward click to headless browser */
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const { x, y } = await req.json().catch(() => ({} as any))
  try {
    const res = await fetch(`${MB}/click`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x: Number(x), y: Number(y) }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Browser service not running.' }, { status: 502 })
  }
}
