import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
const MB = process.env.MEDEFIS_BROWSER_URL || 'http://localhost:3003'

/** POST /api/medefis/headless/type { text } -> type into headless browser */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const { text } = await req.json().catch(() => ({} as any))
  try {
    const res = await fetch(`${MB}/type`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: String(text ?? '') }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Browser service not running.' }, { status: 502 })
  }
}
