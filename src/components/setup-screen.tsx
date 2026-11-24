'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface SetupScreenProps {
  onComplete: () => void
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [username, setUsername] = useState('admin')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Username and password are required.')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, displayName }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Setup failed.')
        return
      }
      toast.success('Administrator account created. You are now signed in.')
      onComplete()
    } catch {
      toast.error('Network error during setup.')
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
              Create your admin account
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              This one-time setup creates the administrator who owns the Medefis credentials.
            </p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">First-run setup</CardTitle>
            <CardDescription>
              Pick a username and a strong password. You can change these later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="su-username">Admin username</Label>
                <Input
                  id="su-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-display">Display name</Label>
                <Input
                  id="su-display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="System Administrator"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password">Password (min 8 chars)</Label>
                <Input
                  id="su-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-confirm">Confirm password</Label>
                <Input
                  id="su-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" /> Create admin & sign in
                  </>
                )}
              </Button>
            </form>
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 ring-1 ring-emerald-200">
              Your password is hashed with scrypt before storage. Medefis credentials you add
              later are encrypted at rest with AES-256-GCM.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
