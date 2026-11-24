import { cookies } from 'next/headers'
import { db } from './db'
import { hashPassword, verifyPassword, randomToken } from './crypto'

export type Role = 'admin' | 'employee'

export interface AuthUser {
  id: string
  role: Role
  username: string
  displayName: string
}

const SESSION_COOKIE = 'pcs_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

/* ----------------------------- First-run setup ------------------------------ */

/** True when no admin account exists yet (first run). */
export async function needsSetup() {
  const count = await db.adminUser.count()
  return count === 0
}

/** Creates the first administrator. Only valid when no admin exists. */
export async function createFirstAdmin(username: string, password: string, displayName?: string) {
  if (!(await needsSetup())) {
    throw new Error('An administrator already exists.')
  }
  if (!username || !password) throw new Error('Username and password are required.')
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const admin = await db.adminUser.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      displayName: displayName?.trim() || 'System Administrator',
    },
  })
  // Immediately start a session for the new admin.
  const token = await createUserSession({
    id: admin.id,
    role: 'admin',
    username: admin.username,
    displayName: admin.displayName ?? admin.username,
  })
  return token
}

/* ------------------------------ Login --------------------------------------- */

export async function adminLogin(username: string, password: string) {
  const admin = await db.adminUser.findUnique({ where: { username } })
  if (!admin) return null
  if (!verifyPassword(password, admin.passwordHash)) return null
  return createUserSession({
    id: admin.id,
    role: 'admin',
    username: admin.username,
    displayName: admin.displayName ?? admin.username,
  })
}

export async function employeeLogin(username: string, password: string) {
  const emp = await db.employee.findUnique({ where: { username } })
  if (!emp) return null
  if (!emp.active) return null
  if (!verifyPassword(password, emp.passwordHash)) return null
  return createUserSession({
    id: emp.id,
    role: 'employee',
    username: emp.username,
    displayName: emp.displayName,
  })
}

async function createUserSession(user: AuthUser): Promise<string> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  // userId stores the AdminUser.id or Employee.id depending on role.
  // It is a plain string (no FK) so both kinds of sessions live here.
  await db.session.create({
    data: { token, userId: user.id, role: user.role, expiresAt },
  })
  return token
}

/* ------------------------------ Cookies ------------------------------------- */

export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value
}

/* ------------------------------ Current user -------------------------------- */

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionCookie()
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } })
    return null
  }
  if (session.role === 'admin') {
    const admin = await db.adminUser.findUnique({ where: { id: session.userId } })
    if (!admin) return null
    return {
      id: admin.id,
      role: 'admin',
      username: admin.username,
      displayName: admin.displayName ?? admin.username,
    }
  }
  // employee
  const emp = await db.employee.findUnique({ where: { id: session.userId } })
  if (!emp || !emp.active) return null
  return {
    id: emp.id,
    role: 'employee',
    username: emp.username,
    displayName: emp.displayName,
  }
}

/* ------------------------------ Logout -------------------------------------- */

export async function logoutCurrent() {
  const token = await getSessionCookie()
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  await clearSessionCookie()
}

/* -------------------------- Password change --------------------------------- */

/** Change the current user's own password after verifying the old one. */
export async function changeOwnPassword(
  user: AuthUser,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.')
  }
  if (user.role === 'admin') {
    const admin = await db.adminUser.findUnique({ where: { id: user.id } })
    if (!admin) return false
    if (!verifyPassword(currentPassword, admin.passwordHash)) return false
    await db.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: hashPassword(newPassword) },
    })
    return true
  }
  const emp = await db.employee.findUnique({ where: { id: user.id } })
  if (!emp) return false
  if (!verifyPassword(currentPassword, emp.passwordHash)) return false
  await db.employee.update({
    where: { id: emp.id },
    data: { passwordHash: hashPassword(newPassword) },
  })
  return true
}

/* ------------------------------ Client IP ----------------------------------- */

import { headers } from 'next/headers'
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
}
