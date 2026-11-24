export type Role = 'admin' | 'employee'

export interface AuthUser {
  id: string
  role: Role
  username: string
  displayName: string
}

export interface Employee {
  id: string
  username: string
  displayName: string
  email: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface MedefisSessionStatus {
  hasCredentials: boolean
  hasSession: boolean
  valid: boolean
  appBaseUrl: string | null
  expiresAt: string | null
  updatedAt: string | null
  lastVerifiedAt: string | null
  lastError: string | null
  hasTokens: boolean
  hasCookies: boolean
}

export interface ActivityEntry {
  id: string
  actor: string
  role: string
  action: string
  detail: string | null
  ip: string | null
  createdAt: string
  employee: { username: string; displayName: string } | null
}
