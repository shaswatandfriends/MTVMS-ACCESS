'use client'

import { useEffect, useState, useCallback } from 'react'
import { LoginScreen } from '@/components/login-screen'
import { SetupScreen } from '@/components/setup-screen'
import { AdminDashboard } from '@/components/admin-dashboard'
import { EmployeeView } from '@/components/employee-view'
import type { AuthUser } from '@/lib/types'

type Phase = 'loading' | 'setup' | 'login' | 'app'

export function AppShell() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  const refresh = useCallback(async () => {
    // Check whether first-run setup is needed.
    const setupRes = await fetch('/api/auth/setup').catch(() => null)
    if (setupRes && setupRes.ok) {
      const setupData = await setupRes.json().catch(() => ({}))
      if (setupData.needsSetup) {
        setPhase('setup')
        setUser(null)
        return
      }
    }
    // Otherwise check the current session.
    const res = await fetch('/api/auth/session', { cache: 'no-store' })
    if (!res.ok) {
      setPhase('login')
      setUser(null)
      return
    }
    const data = await res.json()
    if (data.user) {
      setUser(data.user)
      setPhase('app')
    } else {
      setUser(null)
      setPhase('login')
    }
  }, [])

  useEffect(() => {
    // One-time session/setup check on mount. setState happens after awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-emerald-600/20" />
        <p className="mt-3 text-sm text-slate-400">Loading gateway…</p>
      </div>
    )
  }

  if (phase === 'setup') {
    return <SetupScreen onComplete={refresh} />
  }

  if (phase === 'login' || !user) {
    return <LoginScreen onLoggedIn={refresh} />
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLoggedOut={refresh} />
  }

  return <EmployeeView user={user} onLoggedOut={refresh} />
}
