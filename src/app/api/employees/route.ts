import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getClientIp } from '@/lib/auth'
import { hashPassword, randomToken } from '@/lib/crypto'
import { logActivity } from '@/lib/medefis'

export const dynamic = 'force-dynamic'

/** Admin-only guard */
async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET /api/employees -> list employees (admin only) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  const employees = await db.employee.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return NextResponse.json({ employees })
}

/** POST /api/employees -> create employee (admin only) */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { username, displayName, email, password, active } = await req.json().catch(() => ({} as any))
  if (!username || !displayName || !password) {
    return NextResponse.json({ error: 'username, displayName and password are required.' }, { status: 400 })
  }

  const exists = await db.employee.findUnique({ where: { username } })
  if (exists) {
    return NextResponse.json({ error: 'Username already exists.' }, { status: 409 })
  }

  const emp = await db.employee.create({
    data: {
      username,
      displayName,
      email: email ?? null,
      passwordHash: hashPassword(password),
      active: active ?? true,
    },
  })

  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'employee.create',
    detail: `Created employee ${username} (${displayName})`,
    ip,
  })

  return NextResponse.json({
    employee: {
      id: emp.id,
      username: emp.username,
      displayName: emp.displayName,
      email: emp.email,
      active: emp.active,
    },
  })
}

/** PATCH /api/employees -> update active flag / reset password */
export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { id, active, newPassword, displayName, email } = await req.json().catch(() => ({} as any))
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

  const emp = await db.employee.findUnique({ where: { id } })
  if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof active === 'boolean') data.active = active
  if (typeof displayName === 'string') data.displayName = displayName
  if (typeof email === 'string') data.email = email || null
  if (typeof newPassword === 'string' && newPassword) data.passwordHash = hashPassword(newPassword)

  const updated = await db.employee.update({ where: { id }, data })

  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'employee.update',
    detail: `Updated ${emp.username}`,
    ip,
  })

  return NextResponse.json({
    employee: {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      active: updated.active,
    },
  })
}

/** DELETE /api/employees?id=... -> remove employee */
export async function DELETE(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

  const emp = await db.employee.findUnique({ where: { id } })
  if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

  await db.employee.delete({ where: { id } })

  const ip = await getClientIp()
  await logActivity({
    actor: admin.username,
    role: 'admin',
    action: 'employee.delete',
    detail: `Deleted employee ${emp.username}`,
    ip,
  })

  return NextResponse.json({ ok: true })
}
