import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/activity -> recent activity log (admin only) */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { employee: { select: { username: true, displayName: true } } },
  })

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      actor: l.actor,
      role: l.role,
      action: l.action,
      detail: l.detail,
      ip: l.ip,
      createdAt: l.createdAt,
      employee: l.employee
        ? { username: l.employee.username, displayName: l.employee.displayName }
        : null,
    })),
  })
}
