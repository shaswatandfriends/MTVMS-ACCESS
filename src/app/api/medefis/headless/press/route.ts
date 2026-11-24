import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
const MB = 'http://localhost:3003'

/** POST /api/medefis/headless/press { key } -> press a key in the headless browser */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const { key } = await req.json().catch(() => ({} as any))
  try {
    const res = await fetch(`${MB}/press`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: String(key ?? 'Enter') }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Browser service not running.' }, { status: 502 })
  }
}
