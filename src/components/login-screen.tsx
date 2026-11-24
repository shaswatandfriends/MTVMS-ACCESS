'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { Role } from '@/lib/types'

interface LoginScreenProps {
  onLoggedIn: () => void
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [role, setRole] = useState<Role>('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Enter username and password.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed.')
        return
      }
      if (data.bootstrap) {
        toast.success(
          `First-run admin created. Username: ${data.bootstrap.username} — change it after sign-in.`,
        )
      } else {
        toast.success(`Welcome back, ${data.user?.displayName ?? username}.`)
      }
      onLoggedIn()
      router.refresh()
    } catch (err) {
      toast.error('Network error during login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 ring-1 ring-emerald-600/20">
            <ShieldCheck className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Medefis Parent Control
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Secure gateway to your Medefis VMS. Admins hold the credentials; employees get
              controlled access.
            </p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Choose your role and enter your parent-system credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={role} onValueChange={(v) => setRole(v as Role)} className="mb-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="employee">Employee</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={role === 'admin' ? 'admin' : 'your employee username'}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" /> Sign in as {role}
                  </>
                )}
              </Button>
            </form>

            {role === 'employee' && (
              <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-slate-200">
                Employees access Medefis through this gateway without ever seeing Medefis
                credentials. If the Medefis session is inactive, contact your administrator.
              </p>
            )}
            {role === 'admin' && (
              <p className="mt-4 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 ring-1 ring-emerald-200">
                First run? A default admin is created automatically. Use username{' '}
                <span className="font-mono font-semibold">admin</span> — the one-time password is
                shown in the toast after a failed first attempt, or sign in directly if you have
                reset it.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  )
}
